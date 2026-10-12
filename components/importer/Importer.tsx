"use client";
import { useEffect, useState } from "react";
import { DownloadLink } from "@/components/DownloadLink";
import { LocalNav } from "@/components/library/LocalNav";
import { PaperPreview } from "./PaperPreview";
import { extractText } from "@/importer/extract";
import { draftSection, emptyLibrary } from "@/importer/draft";
import { parseLibrary, type LibraryTest, type Section } from "@/types/exam";
import { importLibraryBundle } from "@/storage/bundle";
import { putAsset } from "@/storage/db";
import { loadLibrary, saveLibrary } from "@/storage/library";
import {
  TestSchema,
  AnswerKeySchema,
  testQuestionNumbers,
  validateTestInternals,
  validateAgainstAnswers,
} from "@/lib/schema";
import Link from "next/link";
import { FullTestImporter } from "./FullTestImporter";

export function Importer() {
  const [mode, setMode] = useState<"single" | "full">("full");
  return (
    <>
      <LocalNav />
      <main className="local-shell">
        <h1>Import a test</h1>
        <p className="muted">
          Import IELTS papers and media locally. Nothing leaves this device.
        </p>
        <div className="import-tabs" role="tablist" aria-label="Import mode">
          <button
            id="import-tab-full"
            role="tab"
            type="button"
            aria-selected={mode === "full"}
            aria-controls="import-panel-full"
            onClick={() => setMode("full")}
          >
            Full test
          </button>
          <button
            id="import-tab-single"
            role="tab"
            type="button"
            aria-selected={mode === "single"}
            aria-controls="import-panel-single"
            onClick={() => setMode("single")}
          >
            Single section
          </button>
        </div>
        {mode === "full" ? (
          <div
            id="import-panel-full"
            role="tabpanel"
            aria-labelledby="import-tab-full"
          >
            <FullTestImporter />
          </div>
        ) : (
          <div
            id="import-panel-single"
            role="tabpanel"
            aria-labelledby="import-tab-single"
          >
            <SingleSectionImporter />
          </div>
        )}
      </main>
    </>
  );
}

function SingleSectionImporter() {
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState("");
  const [section, setSection] = useState<Section>("reading");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LibraryTest | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [library, setLibrary] = useState<LibraryTest[]>([]);
  const duplicate = preview && library.some((t) => t.id === preview.id);
  const [media, setMedia] = useState<
    { name: string; ref: string; kind: "audio" | "image"; part: number }[]
  >([]);
  useEffect(() => {
    void loadLibrary()
      .then((list) => {
        setLibrary(list);
        setDraft(
          (previous) => previous || JSON.stringify(emptyLibrary(), null, 2),
        );
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);
  function changeDraft(value: string) {
    setDraft(value);
    setPreview(null);
    setConfirmed(false);
    setSaved(false);
    setReplaceExisting(false);
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setError("");
    const notices: string[] = [];
    let next = draft;
    let targetSection = section;
    const texts: string[] = [];
    const assets: typeof media = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > 300 * 1024 * 1024)
          throw new Error(
            `${file.name} is larger than 300 MB. Split it before import.`,
          );
        if (file.name.toLowerCase().endsWith(".zip")) {
          next = JSON.stringify(await importLibraryBundle(file), null, 2);
          continue;
        }
        if (
          /\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name) ||
          /\.(png|jpe?g|webp|gif)$/i.test(file.name)
        ) {
          assets.push({
            name: file.name,
            ref: await putAsset(file),
            kind: /\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name)
              ? "audio"
              : "image",
            part: assets.length + 1,
          });
          continue;
        }
        const result = await extractText(file);
        notices.push(...result.warnings);
        if (file.name.toLowerCase().endsWith(".json")) {
          const raw: unknown = JSON.parse(result.text);
          if (
            typeof raw === "object" &&
            raw !== null &&
            "formatVersion" in raw &&
            raw.formatVersion === 2
          )
            next = JSON.stringify(parseLibrary(raw), null, 2);
          else {
            const old = JSON.parse(next) as LibraryTest;
            const paper = TestSchema.safeParse(raw);
            const key = AnswerKeySchema.safeParse(raw);
            if (paper.success) {
              old.sections[paper.data.type] = {
                paper: paper.data,
                key: old.sections[paper.data.type]?.key ?? {
                  formatVersion: 1,
                  answers: {},
                },
              };
              setSection(paper.data.type);
              targetSection = paper.data.type;
            } else if (
              key.success &&
              (targetSection === "reading" || targetSection === "listening")
            ) {
              const entry = old.sections[targetSection];
              if (!entry)
                throw new Error("Load questions first, then the answer key.");
              entry.key = key.data;
            } else
              throw new Error(
                "JSON does not match metadata, questions, or answer-key format.",
              );
            next = JSON.stringify(old, null, 2);
          }
        } else texts.push(result.text);
      }
      changeDraft(next);
      if (texts.length) setSource(texts.join("\n\n"));
      setMedia((m) => [...m, ...assets]);
      setWarnings([
        ...notices,
        ...(assets.some((a) => a.kind === "image")
          ? [
              "Images are attached as visuals. OCR is not implemented; transcribe or paste any required text.",
            ]
          : []),
      ]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function makeDraft() {
    try {
      const current = JSON.parse(draft) as LibraryTest;
      current.sections = {
        ...current.sections,
        ...draftSection(source, section),
      };
      changeDraft(JSON.stringify(current, null, 2));
      setWarnings((w) => [
        ...w,
        "LOW CONFIDENCE: numbered lines and A–H options only. Check passage boundaries, question types, part numbers, answer key and word limits manually.",
      ]);
    } catch (e) {
      setError(String(e));
    }
  }
  function attachMedia() {
    try {
      const current = JSON.parse(draft) as LibraryTest;
      for (const item of media) {
        if (item.kind === "audio") {
          const entry = current.sections.listening;
          if (!entry)
            throw new Error(
              "Add Listening questions before associating audio.",
            );
          entry.paper.audio = [
            ...(entry.paper.audio ?? []).filter((a) => a.part !== item.part),
            { part: item.part, url: item.ref },
          ].sort((a, b) => a.part - b.part);
        } else if (section === "writing") {
          const writing = current.sections.writing;
          if (!writing) throw new Error("Add Writing first.");
          writing.tasks[item.part === 2 ? 1 : 0].image = item.ref;
        } else if (section === "reading" || section === "listening") {
          const group = current.sections[section]?.paper.parts.find(
            (p) => p.part === item.part,
          )?.groups[0];
          if (!group)
            throw new Error(
              `Part ${item.part} is missing. Edit the JSON part numbers first.`,
            );
          group.image = item.ref;
          group.imageAlt = item.name;
        } else
          throw new Error(
            "Choose Writing, Reading or Listening to attach images.",
          );
      }
      changeDraft(JSON.stringify(current, null, 2));
    } catch (e) {
      setError(String(e));
    }
  }
  function validate() {
    try {
      const current = parseLibrary(JSON.parse(draft));
      const notices: string[] = [];
      for (const type of ["reading", "listening"] as const) {
        const entry = current.sections[type];
        if (entry) {
          notices.push(
            ...validateTestInternals(entry.paper)
              .concat(validateAgainstAnswers(entry.paper, entry.key))
              .filter((i) => i.level === "warning")
              .map((i) => i.message),
          );
          const missing = testQuestionNumbers(entry.paper).filter(
            (n) => !entry.key.answers[n],
          );
          if (missing.length)
            notices.push(
              `${type}: missing answers for ${missing.join(", ")}. These are marked incorrect until you supply the key.`,
            );
        }
      }
      setPreview(current);
      setWarnings((w) => [...new Set([...w, ...notices])]);
      setError("");
    } catch (e) {
      setPreview(null);
      setError(String(e));
    }
  }
  async function save() {
    if (!preview || !confirmed || busy || (duplicate && !replaceExisting))
      return;
    setBusy(true);
    try {
      await saveLibrary(preview);
      setSaved(true);
      setLibrary(await loadLibrary());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <label className="field">
        Add to an existing test, or start a new one
        <select
          onChange={(e) => {
            const found = library.find((t) => t.id === e.target.value);
            changeDraft(JSON.stringify(found ?? emptyLibrary(), null, 2));
          }}
        >
          <option value="">New test</option>
          {library.map((t) => (
            <option key={t.id} value={t.id}>
              {t.book} / Test {t.test}
            </option>
          ))}
        </select>
      </label>
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2>1. Source files & text</h2>
          <label className="field">
            Section
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as Section)}
            >
              {["reading", "listening", "writing", "speaking"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            PDF · DOCX · TXT · JSON · ZIP · images · MP3 / M4A / WAV
            <input
              aria-label="Source files"
              type="file"
              multiple
              accept=".zip,.pdf,.docx,.txt,.md,.json,.png,.jpg,.jpeg,.webp,.gif,.mp3,.m4a,.wav,.webm,.ogg"
              disabled={busy || !ready}
              onChange={(e) => void upload(e.target.files)}
            />
          </label>
          <label className="field">
            Extracted text — editable
            <textarea
              aria-label="Extracted text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              style={{ minHeight: 260 }}
            />
          </label>
            <button onClick={makeDraft} disabled={!ready || !source.trim() || busy}>
            Create section draft
          </button>
          {media.length > 0 && (
            <>
              <h3 className="mt-5 font-semibold">Associate local media</h3>
              {media.map((item, i) => (
                <label className="field" key={item.ref}>
                  {item.name} · Part / Task
                  <select
                    value={item.part}
                    onChange={(e) =>
                      setMedia((m) =>
                        m.map((v, j) =>
                          j === i ? { ...v, part: Number(e.target.value) } : v,
                        ),
                      )
                    }
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              ))}
              <button onClick={attachMedia}>Attach media to JSON</button>
              <p className="muted">
                One full recording: assign Part 1. Separate recordings: assign
                Parts 1–4. Images attach to the first question group of the
                selected part, or Writing Task 1/2. Edit JSON to move them.
              </p>
            </>
          )}
        </section>
        <section>
          <h2>2. Edit structured test</h2>
          <p className="muted">
            Edit book, test, title, parts, question types and answers. Existing
            v1 question/answer files are supported. See the format guide in the
            project docs.
          </p>
          <label className="field">
            metadata.json
            <textarea
              aria-label="Test JSON"
              disabled={!ready}
              spellCheck={false}
              value={draft}
              onChange={(e) => changeDraft(e.target.value)}
              className="font-mono text-xs"
              style={{ minHeight: 520 }}
            />
          </label>
          <button disabled={!ready || busy} onClick={validate}>
            Validate & preview
          </button>
          <DownloadLink
            className="local-btn ml-3"
            href="/demo/metadata.json"
            filename="metadata.json"
          >
            Download original example
          </DownloadLink>
        </section>
      </div>
      {busy && <p role="status">Processing locally…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <aside className="notice my-6">
          <strong>Manual review required</strong>
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </aside>
      )}
      {preview && (
        <section>
          <h2>3. Preview & save</h2>
          <PaperPreview test={preview} />
          {duplicate && (
            <div className="notice">
              <p>
                This test ID already exists. Saving replaces its library
                questions and media; historical attempts remain unchanged.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                />{" "}
                Replace the existing library test
              </label>
            </div>
          )}
          <label className="block my-6">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I checked all question types, numbering, passages, media and answer
            keys. I hold the rights to use these files.
          </label>
          <button
            className="primary"
            disabled={
              !confirmed || busy || Boolean(duplicate && !replaceExisting)
            }
            onClick={() => void save()}
          >
            Save to local Library
          </button>
        </section>
      )}
      {saved && (
        <p role="status" className="notice my-4">
          Saved to Library.{" "}
          <Link className="underline" href="/">
            Open Library →
          </Link>
        </p>
      )}
    </>
  );
}
