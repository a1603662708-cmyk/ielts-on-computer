"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useWorkStore,
  hydrateWork,
  wordCount,
  exportEssay,
} from "@/exam/workStore";
import { clockNow } from "@/exam/clock";
import { useCountdown, formatClock } from "@/lib/useTimer";
import { WorkHeader } from "@/components/test/WorkHeader";
import { Modal } from "@/components/test/Modal";
import { MockCoordinator } from "@/components/library/MockCoordinator";
import { AssetImage } from "@/components/AssetImage";
export function WritingScreen() {
  const session = useWorkStore((s) => s.session);
  const hydrated = useWorkStore((s) => s.hydrated);
  const update = useWorkStore((s) => s.update);
  const finish = useWorkStore((s) => s.finish);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    void hydrateWork().catch((e) => setError(String(e)));
    const id = setInterval(
      () => useWorkStore.getState().update({ lastSeen: clockNow() }),
      5000,
    );
    return () => clearInterval(id);
  }, []);
  const writing = session?.kind === "writing" ? session : null;
  const remaining = useCountdown(
    writing && !writing.finished && !writing.pausedAt && !writing.untimed
      ? writing.endsAt
      : null,
    () => {
      void finish().catch((e) => setError(String(e)));
    },
  );
  useEffect(() => {
    if (hydrated && !writing) router.replace("/");
  }, [hydrated, writing, router]);
  if (!writing)
    return <p className="local-shell">{error || "Loading Writing…"}</p>;
  if (writing.finished && writing.mockRunId) return <MockCoordinator />;
  if (writing.finished)
    return (
      <main className="local-shell">
        <h1>Writing saved</h1>
        <p>
          No automated IELTS band is assigned. Your essays are available in
          History.
        </p>
        <p>
          Task 1: {wordCount(writing.essays[0])} words · Task 2:{" "}
          {wordCount(writing.essays[1])} words
        </p>
        <div className="actions">
          <button onClick={() => exportEssay(writing, "txt")}>
            Export TXT
          </button>
          <button onClick={() => exportEssay(writing, "md")}>
            Export Markdown
          </button>
          <Link className="local-btn primary" href="/history">
            View History
          </Link>
        </div>
      </main>
    );
  const active = writing.paper.tasks[writing.activeTask];
  return (
    <div className="exam-layout">
      <WorkHeader
        title={`Writing · Task ${writing.activeTask + 1}`}
        time={
          writing.untimed
            ? "Untimed"
            : writing.pausedAt
              ? "Paused"
              : formatClock(remaining)
        }
        onSubmit={() => setConfirm(true)}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="exam-body">
        <section>
          <h1 className="text-xl font-bold">
            WRITING TASK {writing.activeTask + 1}
          </h1>
          <p className="muted my-4">
            Spend about {writing.activeTask === 0 ? "20" : "40"} minutes on this
            task. Write at least {active.minWords} words.
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{active.prompt}</p>
          {active.image && (
            <AssetImage src={active.image} alt="Academic Writing task visual" />
          )}
        </section>
        <section>
          <div className="flex justify-between mb-3">
            <strong>Your answer</strong>
            <span aria-live="polite">
              Words: {wordCount(writing.essays[writing.activeTask])}
            </span>
          </div>
          <textarea
            className="essay"
            aria-label={`Task ${writing.activeTask + 1} answer`}
            value={writing.essays[writing.activeTask]}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            onChange={(e) => {
              const essays: [string, string] = [...writing.essays];
              essays[writing.activeTask] = e.target.value;
              update({ essays });
            }}
          />
        </section>
      </div>
      <footer className="exam-footer">
        {([0, 1] as const).map((i) => (
          <button
            className={writing.activeTask === i ? "primary" : ""}
            key={i}
            onClick={() => update({ activeTask: i })}
          >
            Task {i + 1} · {wordCount(writing.essays[i])} words
          </button>
        ))}
        {writing.mode === "practice" && (
          <button onClick={() => useWorkStore.getState().pause()}>Pause</button>
        )}
        <button className="ml-auto" onClick={() => setConfirm(true)}>
          Submit Writing
        </button>
      </footer>
      {writing.pausedAt && (
        <div className="pause-cover">
          Practice paused.
          <button onClick={() => useWorkStore.getState().pause()}>
            Resume
          </button>
        </div>
      )}
      {confirm && (
        <Modal
          title="Submit Writing?"
          onClose={() => setConfirm(false)}
          footer={
            <button
              className="local-btn primary"
              onClick={() => {
                void finish().catch((e) => setError(String(e)));
                setConfirm(false);
              }}
            >
              Save and submit
            </button>
          }
        >
          <p>
            Task 1: {wordCount(writing.essays[0])} words. Task 2:{" "}
            {wordCount(writing.essays[1])} words. Submission ends this section.
          </p>
        </Modal>
      )}
    </div>
  );
}
