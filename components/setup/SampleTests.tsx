"use client";

import { DownloadLink } from "@/components/DownloadLink";
import { useState } from "react";
import type { TestType } from "@/lib/schema";

const SAMPLES_ON_GITHUB =
  "https://github.com/aknahin/ielts-on-computer/tree/main/public/samples";

export type SampleFiles = {
  questions: { text: string; filename: string };
  answers: { text: string; filename: string };
};

/**
 * Offers the bundled demo test three ways: loaded straight into the form,
 * downloaded as files to edit, or browsed on GitHub. The demo files are served
 * from `public/samples`, so this is a plain fetch with no bundling involved.
 */
export function SampleTests({
  type,
  onLoad,
}: {
  type: TestType;
  onLoad: (files: SampleFiles) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questionsFile = `demo-${type}.questions.json`;
  const answersFile = `demo-${type}.answers.json`;

  async function loadDemo() {
    setBusy(true);
    setError(null);
    try {
      const [q, a] = await Promise.all([
        fetch(`/samples/${questionsFile}`),
        fetch(`/samples/${answersFile}`),
      ]);
      if (!q.ok || !a.ok)
        throw new Error("the sample files could not be fetched");
      onLoad({
        questions: { text: await q.text(), filename: questionsFile },
        answers: { text: await a.text(), filename: answersFile },
      });
    } catch (e) {
      setError(`Could not load the demo test — ${(e as Error).message}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-5">
      <h2 className="font-semibold">No test file yet?</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {type === "reading"
          ? "Load the bundled demo — a complete 12-question Reading test that uses every supported question type."
          : "Load the bundled Listening template. It shows the file structure, but you'll need to point its “audio” entries at your own recordings before it will start."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={loadDemo}
          disabled={busy}
          className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
        >
          {busy ? "Loading…" : "Load demo test"}
        </button>

        <span className="text-sm text-[var(--muted)]">
          or download to edit:
        </span>

        <DownloadLink
          href={`/samples/${questionsFile}`}
          filename={questionsFile}
          className="rounded border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium"
        >
          Questions ↓
        </DownloadLink>
        <DownloadLink
          href={`/samples/${answersFile}`}
          filename={answersFile}
          className="rounded border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium"
        >
          Answers ↓
        </DownloadLink>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--incorrect)]">{error}</p>}

      <p className="mt-4 text-sm text-[var(--muted)]">
        <a
          href={SAMPLES_ON_GITHUB}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Browse all samples on GitHub
        </a>
        {" · "}
        <a
          href="https://github.com/aknahin/ielts-on-computer/blob/main/docs/FORMAT.md"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Read the file format spec
        </a>
      </p>
    </section>
  );
}
