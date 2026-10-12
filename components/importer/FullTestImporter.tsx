"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  classifyFile,
  type Classification,
  type FileSection,
} from "@/importer/classifier";
import { constructFullTest, type FullFile } from "@/importer/full-test";
import { extractText } from "@/importer/extract";
import { parseLibrary, type LibraryTest, type Section } from "@/types/exam";
import { loadLibrary, saveFullLibrary } from "@/storage/library";
import { PaperPreview } from "./PaperPreview";

type Staged = FullFile & {
  id: string;
  classification: Classification;
  manuallyAssigned: boolean;
};
const sections: Section[] = ["reading", "listening", "writing", "speaking"];
const assignments = [...sections, "shared", "ignore"] as const;
const initialMetadata: Pick<LibraryTest, "book" | "test" | "title" | "module"> =
  {
    book: "My local papers",
    test: 1,
    title: "Imported test",
    module: "Academic",
  };

export function FullTestImporter() {
  const [files, setFiles] = useState<Staged[]>([]);
  const [metadata, setMetadata] = useState(initialMetadata);
  const [draft, setDraft] = useState("");
  const [assets, setAssets] = useState<{ ref: string; blob: Blob }[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<LibraryTest | null>(null);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [replace, setReplace] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void loadLibrary()
      .then((items) => setExistingIds(items.map((item) => item.id)))
      .catch((e) => setError(String(e)));
  }, []);

  function invalidate() {
    setPreview(null);
    setConfirmed(false);
    setSaved(false);
    setReplace(false);
  }
  async function stage(selected: FileList | File[]) {
    setBusy(true);
    setError("");
    try {
      const next = await Promise.all(
        Array.from(selected).map(async (file): Promise<Staged> => {
          if (file.size > 300 * 1024 * 1024)
            throw new Error(`${file.name} exceeds 300 MB.`);
          const name = file.webkitRelativePath || file.name;
          const base = {
            id: crypto.randomUUID(),
            name,
            section: "unknown" as FileSection,
            classification: {
              section: "unknown" as FileSection,
              confidence: 0,
              reason: "",
            },
            manuallyAssigned: false,
          };
          if (
            /\.(mp3|m4a|wav|webm|ogg|png|jpe?g|webp|gif)$/i.test(file.name) ||
            file.type.startsWith("audio/") ||
            file.type.startsWith("image/")
          ) {
            const classification = classifyFile(file);
            const part = Number(
              file.name.match(/(?:part|task)[- _]?([1-4])/i)?.[1] ?? 1,
            );
            return {
              ...base,
              media: file,
              part,
              section: classification.section,
              classification,
            };
          }
          const extracted = await extractText(file);
          const json: unknown = file.name.toLowerCase().endsWith(".json")
            ? JSON.parse(extracted.text)
            : undefined;
          const classification = classifyFile(file, json);
          return {
            ...base,
            text: json === undefined ? extracted.text : undefined,
            json,
            section: classification.section,
            classification,
          };
        }),
      );
      if (files.length === 0) {
        const supplied = next.find(
          (item) => item.section === "shared" && item.json,
        )?.json as Partial<LibraryTest> | undefined;
        if (supplied?.formatVersion === 2)
          setMetadata({
            book:
              typeof supplied.book === "string"
                ? supplied.book
                : initialMetadata.book,
            test:
              typeof supplied.test === "number"
                ? supplied.test
                : initialMetadata.test,
            title:
              typeof supplied.title === "string"
                ? supplied.title
                : initialMetadata.title,
            module:
              supplied.module === "General Training"
                ? "General Training"
                : "Academic",
          });
      }
      setFiles((previous) => [...previous, ...next]);
      setDraft("");
      setAssets([]);
      invalidate();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function updateFile(id: string, patch: Partial<Staged>) {
    setFiles((current) =>
      current.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    );
    setDraft("");
    setAssets([]);
    invalidate();
  }
  function updateMetadata(patch: Partial<typeof metadata>) {
    const updated = { ...metadata, ...patch };
    setMetadata(updated);
    try {
      const value = JSON.parse(draft) as LibraryTest;
      Object.assign(value, updated);
      setDraft(JSON.stringify(value, null, 2));
    } catch {
      /* A fresh draft has not yet been built. */
    }
    invalidate();
  }
  function clearFiles() {
    setFiles([]);
    setDraft("");
    setAssets([]);
    setWarnings([]);
    setError("");
    setMetadata(initialMetadata);
    invalidate();
  }
  function buildDraft() {
    try {
      const built = constructFullTest(files, metadata, false);
      setDraft(JSON.stringify(built.test, null, 2));
      setAssets(built.assets);
      setWarnings(built.warnings);
      setError("");
      invalidate();
    } catch (e) {
      setError(String(e));
    }
  }
  function validatedCandidate() {
    const unresolved = files.find(
      (file) =>
        file.section === "unknown" ||
        (!file.manuallyAssigned &&
          file.classification.confidence < 0.8 &&
          file.section !== "ignore"),
    );
    if (unresolved)
      throw new Error(
        `${unresolved.name}: classification needs review. Assign a section or Ignore.`,
      );
    const built = draft
      ? { test: JSON.parse(draft) as LibraryTest, assets, warnings }
      : constructFullTest(files, metadata, false);
    const test = parseLibrary(built.test);
    const refs = new Set(built.assets.map((asset) => asset.ref));
    const raw = JSON.stringify(test);
    for (const ref of refs)
      if (!raw.includes(ref))
        throw new Error(
          `${ref}: staged media is not attached in the edited JSON.`,
        );
    return { ...built, test };
  }
  function validate() {
    try {
      const result = validatedCandidate();
      if (!draft) {
        setDraft(JSON.stringify(result.test, null, 2));
        setAssets(result.assets);
        setWarnings(result.warnings);
      }
      setPreview(result.test);
      setError("");
    } catch (e) {
      setPreview(null);
      setError(String(e));
    }
  }
  async function importFullTest() {
    if (busy || !files.length) return;
    if (!confirmed) {
      setError(
        "Confirm that you reviewed the files and have the rights to use them.",
      );
      return;
    }
    try {
      const result = validatedCandidate();
      if (!draft) {
        setDraft(JSON.stringify(result.test, null, 2));
        setAssets(result.assets);
        setWarnings(result.warnings);
      }
      setPreview(result.test);
      if (existingIds.includes(result.test.id) && !replace)
        throw new Error(
          "This test ID already exists. Review the replacement option below.",
        );
      setBusy(true);
      await saveFullLibrary(result.test, result.assets);
      setSaved(true);
      setExistingIds((ids) => [...ids, result.test.id]);
      setError("");
    } catch (e) {
      setError(`Import failed; draft preserved. ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="import-flow">
      <section className="import-step" aria-labelledby="import-add-files">
        <div className="import-step-heading">
          <span className="import-step-number">1</span>
          <h2 id="import-add-files">Add files</h2>
        </div>
        <div
          className={`import-dropzone ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length)
              void stage(event.dataTransfer.files);
          }}
        >
          <h3>Drop your IELTS test files here</h3>
          <p className="muted">or select files from this device</p>
          <div className="import-drop-actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              Choose files
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => folderInput.current?.click()}
            >
              Choose folder
            </button>
          </div>
          <input
            ref={fileInput}
            className="import-file-input"
            aria-label="Full test files"
            type="file"
            multiple
            disabled={busy}
            accept=".pdf,.docx,.txt,.md,.json,.png,.jpg,.jpeg,.webp,.gif,.mp3,.m4a,.wav,.webm,.ogg"
            onChange={(e) => {
              if (e.target.files) void stage(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={(node) => {
              folderInput.current = node;
              node?.setAttribute("webkitdirectory", "");
            }}
            className="import-file-input"
            aria-label="Full test folder"
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => {
              if (e.target.files) void stage(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <p className="muted import-file-types">
          PDF · DOCX · TXT · JSON · ZIP · images · MP3 · M4A · WAV
        </p>
        {files.length > 0 && (
          <div className="import-file-summary" role="status">
            <strong>
              {files.length} {files.length === 1 ? "file" : "files"} added
            </strong>
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Add more files
              </button>
              <button type="button" disabled={busy} onClick={clearFiles}>
                Clear files
              </button>
            </div>
          </div>
        )}
      </section>
      {files.length > 0 && (
        <section
          className="import-step"
          aria-labelledby="import-review-sections"
        >
          <div className="import-step-heading">
            <span className="import-step-number">2</span>
            <h2 id="import-review-sections">Review detected sections</h2>
          </div>
          <p className="muted">
            Check each file. Missing sections are fine; uncertain files need
            your choice.
          </p>
          <div className="import-section-grid">
            {sections.map((section) => {
              const matching = files.filter((file) => file.section === section);
              const presentInDraft = draft
                ? (() => {
                    try {
                      return Boolean(
                        (JSON.parse(draft) as LibraryTest).sections[section],
                      );
                    } catch {
                      return false;
                    }
                  })()
                : false;
              const needsReview = matching.some(
                (file) =>
                  !file.manuallyAssigned &&
                  file.classification.confidence < 0.8,
              );
              const status =
                matching.length || presentInDraft
                  ? needsReview
                    ? "Needs review"
                    : "Ready"
                  : "Missing";
              return (
                <article
                  className="import-section-card"
                  key={section}
                  aria-label={`${section} section`}
                >
                  <div className="import-section-card-heading">
                    <h3 className="capitalize">{section}</h3>
                    <span
                      className={`import-status import-status-${status.toLowerCase().replace(" ", "-")}`}
                    >
                      {status}
                    </span>
                  </div>
                  {matching.length ? (
                    matching.map((file) => (
                      <FileRow key={file.id} file={file} update={updateFile} />
                    ))
                  ) : (
                    <p className="muted">No files assigned</p>
                  )}
                </article>
              );
            })}
          </div>
          <div className="import-unclassified">
            <h3>Unclassified files</h3>
            {files
              .filter((file) => !sections.includes(file.section as Section))
              .map((file) => (
                <FileRow key={file.id} file={file} update={updateFile} />
              ))}
            {!files.some(
              (file) => !sections.includes(file.section as Section),
            ) && <p className="muted">No unclassified files</p>}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section className="import-step" aria-labelledby="import-test-details">
          <div className="import-step-heading">
            <span className="import-step-number">3</span>
            <h2 id="import-test-details">Test details</h2>
          </div>
          <div className="import-details-grid">
            <label className="field">
              Title
              <input
                aria-label="Full test title"
                value={metadata.title}
                onChange={(e) => updateMetadata({ title: e.target.value })}
              />
            </label>
            <label className="field">
              Module
              <select
                aria-label="Full test module"
                value={metadata.module}
                onChange={(e) =>
                  updateMetadata({
                    module: e.target.value as LibraryTest["module"],
                  })
                }
              >
                <option>Academic</option>
                <option>General Training</option>
              </select>
            </label>
            <label className="field">
              Test number
              <input
                aria-label="Full test number"
                type="number"
                min={1}
                value={metadata.test}
                onChange={(e) =>
                  updateMetadata({ test: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              Book
              <input
                aria-label="Full test book"
                value={metadata.book}
                onChange={(e) => updateMetadata({ book: e.target.value })}
              />
            </label>
          </div>
          <details className="import-advanced">
            <summary>Advanced · Edit structured test data</summary>
            <p className="muted">
              Edit the complete test only if you need to correct questions,
              answers or media references.
            </p>
            {!draft && (
              <button type="button" disabled={busy} onClick={buildDraft}>
                Prepare structured test data
              </button>
            )}
            {draft && (
              <label className="field">
                Full test JSON
                <textarea
                  aria-label="Full test JSON"
                  className="font-mono text-xs"
                  style={{ minHeight: 420 }}
                  spellCheck={false}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    invalidate();
                  }}
                />
              </label>
            )}
          </details>
        </section>
      )}
      {files.length > 0 && (
        <section
          className="import-step import-final-step"
          aria-labelledby="import-finish"
        >
          <div className="import-step-heading">
            <span className="import-step-number">4</span>
            <h2 id="import-finish">Import</h2>
          </div>
          <p className="muted">
            Review the detected sections and test details, then import the test
            into your local Library.
          </p>
          {warnings.length > 0 && (
            <aside className="notice">
              <strong>Manual review required</strong>
              <ul className="list-disc pl-5">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </aside>
          )}
          {preview && (
            <details className="import-advanced">
              <summary>Validated test preview</summary>
              <PaperPreview test={preview} />
            </details>
          )}
          {preview && existingIds.includes(preview.id) && (
            <label className="import-confirm">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />{" "}
              Replace existing library test
            </label>
          )}
          <label className="import-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I checked section classification, questions, answers and media, and
            hold the rights to these files.
          </label>
          <div className="import-final-actions">
            <button type="button" disabled={busy} onClick={validate}>
              Review test preview
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void importFullTest()}
            >
              Import full test
            </button>
          </div>
          {busy && <p role="status">Processing locally…</p>}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="notice">
              Saved to Library.{" "}
              <Link href="/" className="underline">
                Open Library →
              </Link>
            </p>
          )}
        </section>
      )}
      {!files.length && busy && <p role="status">Processing locally…</p>}
      {!files.length && error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

function FileRow({
  file,
  update,
}: {
  file: Staged;
  update: (id: string, patch: Partial<Staged>) => void;
}) {
  return (
    <div className="import-file-row">
      <span className="import-file-name">{file.name}</span>
      <label className="import-file-control">
        Section{" "}
        <select
          aria-label={`${file.name} section`}
          value={file.section}
          onChange={(e) =>
            update(file.id, {
              section: e.target.value as Staged["section"],
              manuallyAssigned: true,
            })
          }
        >
          <option value="unknown">Needs review</option>
          {assignments.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
      </label>
      {file.media && (
        <label className="import-file-control">
          Part / Task{" "}
          <select
            aria-label={`${file.name} part`}
            value={file.part}
            onChange={(e) => update(file.id, { part: Number(e.target.value) })}
          >
            {[1, 2, 3, 4].map((part) => (
              <option key={part}>{part}</option>
            ))}
          </select>
        </label>
      )}
      <small
        className={`import-file-confidence ${!file.manuallyAssigned && file.classification.confidence < 0.8 ? "needs-review" : ""}`}
      >
        {file.manuallyAssigned
          ? "Manually assigned"
          : `${Math.round(file.classification.confidence * 100)}% · ${file.classification.reason}`}
      </small>
    </div>
  );
}
