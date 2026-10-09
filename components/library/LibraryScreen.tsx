"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportLibraryBundle } from "@/storage/bundle";
import { loadLibrary } from "@/storage/library";
import { type LibraryTest, type Mode, type Section } from "@/types/exam";
import { hydrateStore, useTestStore } from "@/lib/store";
import { hydrateWork, useWorkStore } from "@/exam/workStore";
import { prepareAudio } from "@/exam/audio";
import { LocalNav } from "./LocalNav";
import { enterFullscreen } from "@/lib/useFullscreen";
import { SaveStatus } from "@/components/SaveStatus";
import { startFullMock, type MockRun } from "@/exam/mock";
import { readRecord } from "@/storage/db";
import { Modal } from "@/components/test/Modal";
export function LibraryScreen() {
  const [tests, setTests] = useState<LibraryTest[]>([]);
  const [selected, setSelected] = useState<LibraryTest | null>(null);
  const [mode, setMode] = useState<Mode>("practice");
  const [part, setPart] = useState(0);
  const [untimed, setUntimed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [run, setRun] = useState<MockRun | null>(null);
  const [full, setFull] = useState(false);
  const router = useRouter();
  const objective = useTestStore((s) =>
    s.phase === "running" ? s.session : null,
  );
  const work = useWorkStore((s) =>
    s.session && !s.session.finished ? s.session : null,
  );
  useEffect(() => {
    void Promise.all([
      loadLibrary(),
      hydrateStore(),
      hydrateWork(),
      readRecord<MockRun>("mock.run"),
    ])
      .then(([list, , , mock]) => {
        setTests(list);
        setRun(mock ?? null);
        setMode(
          new URLSearchParams(window.location.search).get("mode") === "mock"
            ? "mock"
            : "practice",
        );
      })
      .catch((e) => setError(String(e)));
  }, []);
  async function start(section: Section) {
    if (!selected || busy) return;
    setBusy(`Preparing ${section}…`);
    setError("");
    try {
      const options = {
        libraryId: selected.id,
        book: selected.book,
        testNumber: selected.test,
        mode,
        untimed: mode === "practice" && untimed,
      };
      if (mode === "mock") void enterFullscreen();
      if (section === "reading" || section === "listening") {
        const entry = selected.sections[section];
        if (!entry) throw new Error("Section unavailable.");
        let paper = entry.paper;
        if (mode === "practice" && part) {
          paper = {
            ...paper,
            parts: paper.parts.filter((p) => p.part === part),
            audio: paper.audio?.filter((a) => a.part === part),
          };
          if (!paper.parts.length)
            throw new Error("This part does not exist. Choose all parts.");
        }
        if (mode === "mock")
          paper = {
            ...paper,
            durationSeconds:
              section === "reading" ? 3600 : paper.durationSeconds,
          };
        const prepared = await prepareAudio(paper);
        useTestStore.getState().start(prepared, entry.key, options);
        router.push("/test");
      } else if (section === "writing") {
        const paper = selected.sections.writing;
        if (!paper) throw new Error("Writing is missing.");
        useWorkStore.getState().startWriting(paper, options);
        router.push("/writing");
      } else {
        const paper = selected.sections.speaking;
        if (!paper) throw new Error("Speaking is missing.");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
        useWorkStore.getState().startSpeaking(paper, options);
        router.push("/speaking");
      }
      void navigator.storage?.persist?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <LocalNav />
      <main className="local-shell">
        <div className="flex items-start justify-between">
          <div>
            <p className="muted uppercase tracking-widest">
              Computer-delivered · Academic
            </p>
            <h1>IELTS Local Test Simulator</h1>
            <p className="muted">
              Your papers. Exam conditions. Everything stays on this Mac.
            </p>
          </div>
          <button onClick={() => setHelp(true)}>Help</button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {(objective || work || (run && run.stage !== "complete")) && (
          <div className="notice my-6">
            <strong>An exam is in progress.</strong>{" "}
            <Link
              className="underline"
              href={
                run && run.stage !== "complete"
                  ? "/mock"
                  : objective
                    ? "/test"
                    : work?.kind === "writing"
                      ? "/writing"
                      : "/speaking"
              }
            >
              Resume saved exam →
            </Link>
            <p className="muted">
              Finish the active exam before starting another. Mock time
              continues while this page is closed.
            </p>
          </div>
        )}
        <div className="actions mt-8 mb-6">
          <button
            className={mode === "practice" ? "primary" : ""}
            onClick={() => {
              setMode("practice");
              setFull(false);
            }}
          >
            Practice
          </button>
          <button
            className={mode === "mock" ? "primary" : ""}
            onClick={() => setMode("mock")}
          >
            Mock Test
          </button>
          <span className="muted">
            {mode === "practice"
              ? "Pause, repeat and review individual parts."
              : "Strict timing. No answers or replay during the exam."}
          </span>
        </div>
        <h2>
          Library <span className="muted">/ {tests.length} tests</span>
        </h2>
        {!tests.length && !error && <p>Loading local library…</p>}
        {tests.map((test) => (
          <section className="local-row" key={test.id}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {test.book} <span className="muted">/ Test {test.test}</span>
                </h3>
                <p className="muted">{test.title}</p>
                <p className="muted">
                  {Object.keys(test.sections)
                    .map((s) => s[0].toUpperCase() + s.slice(1))
                    .join(" · ")}
                </p>
              </div>
              <button
                className={selected?.id === test.id ? "primary" : ""}
                onClick={() => {
                  setSelected(test);
                  setPart(0);
                  setFull(false);
                }}
              >
                {selected?.id === test.id ? "Selected" : "Choose test →"}
              </button>
            </div>
            {selected?.id === test.id && (
              <div className="mt-6 border-t border-[var(--border)] pt-5">
                <div className="actions mb-4">
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setBusy("Exporting portable bundle…");
                      void exportLibraryBundle(test)
                        .catch((e) => setError(String(e)))
                        .finally(() => setBusy(""));
                    }}
                  >
                    Export test + media ZIP
                  </button>
                </div>
                {test.id === "original-demo" && (
                  <p className="notice text-sm mb-4">
                    Original interface demo with short computer-generated
                    recordings. It is not a Cambridge paper or a representative
                    full-length IELTS test.
                  </p>
                )}
                {mode === "practice" && (
                  <div className="actions mb-4">
                    <label>
                      Part / Passage{" "}
                      <select
                        className="border p-2 ml-2"
                        value={part}
                        onChange={(e) => setPart(Number(e.target.value))}
                      >
                        <option value={0}>All parts</option>
                        {[1, 2, 3, 4].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={untimed}
                        onChange={(e) => setUntimed(e.target.checked)}
                      />{" "}
                      Untimed Listening / Reading / Writing
                    </label>
                  </div>
                )}
                <div className="actions">
                  {(
                    ["listening", "reading", "writing", "speaking"] as const
                  ).map((section) => (
                    <button
                      disabled={
                        !test.sections[section] ||
                        Boolean(
                          busy ||
                          objective ||
                          work ||
                          (run && run.stage !== "complete"),
                        )
                      }
                      key={section}
                      onClick={() => void start(section)}
                    >
                      {section[0].toUpperCase() + section.slice(1)}
                      {!test.sections[section] ? " · Not imported" : ""}
                    </button>
                  ))}
                  {mode === "mock" && (
                    <button
                      className="primary"
                      disabled={Boolean(
                        busy ||
                        objective ||
                        work ||
                        (run && run.stage !== "complete"),
                      )}
                      onClick={() => setFull(true)}
                    >
                      Full Mock: L → R → W
                    </button>
                  )}
                </div>
                {full && <FullMockStart test={test} onError={setError} />}{" "}
                {busy && (
                  <p role="status" className="my-4">
                    {busy} Audio is checked before the clock starts.
                  </p>
                )}
              </div>
            )}
          </section>
        ))}
        <div className="mt-8 flex flex-wrap justify-between gap-4">
          <p className="muted">
            Cambridge papers appear after you import your own lawfully held
            files.
          </p>
          <Link className="local-btn" href="/import">
            Import your test →
          </Link>
        </div>
        <footer className="mt-12 border-t border-[var(--border)] pt-5 muted">
          <SaveStatus />
          <p className="mt-2">
            Independent practice software. Not affiliated with IELTS, the
            British Council, IDP or Cambridge. Writing and Speaking receive no
            invented band scores.
          </p>
          <Link className="underline mr-4" href="/setup/reading">
            Original JSON Reading setup
          </Link>
          <Link className="underline" href="/setup/listening">
            Original JSON Listening setup
          </Link>
        </footer>
      </main>
      {help && (
        <Modal title="Local simulator" onClose={() => setHelp(false)}>
          <p>
            Choose a test and a mode. Import your own files using Import.
            Answers, essays, recordings, notes and history are stored in
            IndexedDB for this browser and address. Use the same address each
            time. Clearing browser site data removes local work. Alt/Option + N
            / P: next / previous question. Alt/Option + F: flag. Shortcuts do
            not intercept text input.
          </p>
        </Modal>
      )}
    </>
  );
}
function FullMockStart({
  test,
  onError,
}: {
  test: LibraryTest;
  onError: (error: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="notice mt-4">
      <p>
        Listening → Reading → Writing. No pause, no answer review between
        sections. Speaking is taken separately. All audio is checked before the
        exam starts.
      </p>
      <button
        className="primary mt-3"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void enterFullscreen();
          void startFullMock(test)
            .then(() => router.push("/mock"))
            .catch((e) => {
              onError(String(e));
              setBusy(false);
            });
        }}
      >
        {busy ? "Checking audio…" : "Start Fullscreen Mock"}
      </button>
    </div>
  );
}
