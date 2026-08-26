"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatBand, isStandardLength } from "@/lib/bandTables";
import { NO_AUDIO, useTestStore } from "@/lib/store";
import type { QuestionResult } from "@/lib/scoring";

type Filter = "all" | "wrong";

export function ResultsScreen() {
  const router = useRouter();
  const hydrated = useTestStore((s) => s.hydrated);
  const report = useTestStore((s) => s.report);
  const endedBy = useTestStore((s) => s.endedBy);
  const reset = useTestStore((s) => s.reset);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    // Results are never persisted, so a refresh here legitimately goes home —
    // but only once hydration has settled.
    if (hydrated && report === null) router.replace("/");
    // Leaving fullscreen makes the review readable at a normal window size.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, [hydrated, report, router]);

  const shown = useMemo(
    () => (report ? report.questions.filter((q) => filter === "all" || !q.correct) : []),
    [report, filter],
  );

  if (!report) return null;

  const wrong = report.total - report.raw;
  const partLabel = report.parts.length === 3 ? "Passage" : "Part";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Results</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {endedBy === "time"
              ? "Time expired and the test was submitted automatically."
              : "Submitted early from the options menu."}
          </p>
        </div>
        <div className="no-print flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            Print / save PDF
          </button>
          <Link
            href="/"
            onClick={reset}
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
          >
            Back to home
          </Link>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tile label="Band score" value={formatBand(report.band)} big />
        <Tile label="Raw score" value={`${report.raw} / ${report.total}`} big />
        <Tile label="Incorrect" value={String(wrong)} big />
      </section>

      {!isStandardLength(report.total) && (
        <p className="mt-3 text-sm text-[var(--muted)]">
          This test has {report.total} questions rather than 40, so the raw score was scaled to 40
          before converting to a band. Treat the band as indicative.
        </p>
      )}

      <section className="mt-6 rounded-lg border border-[var(--border)] p-4">
        <h2 className="font-semibold">By {partLabel.toLowerCase()}</h2>
        <ul className="mt-3 space-y-2">
          {report.parts.map((p) => (
            <li key={p.part} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 font-medium">
                {partLabel} {p.part}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded bg-[var(--bg-panel)]">
                <span
                  className="block h-full rounded"
                  style={{
                    width: `${(p.correct / p.total) * 100}%`,
                    background: "var(--correct)",
                  }}
                />
              </span>
              <span className="w-14 shrink-0 text-right tabular-nums">
                {p.correct}/{p.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <AudioReplay />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Answer review</h2>
          <div className="no-print flex gap-1 rounded border border-[var(--border)] p-0.5 text-sm">
            {(["all", "wrong"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1 font-medium ${
                  filter === f ? "bg-[var(--accent)] text-[var(--accent-fg)]" : ""
                }`}
              >
                {f === "all" ? `All ${report.total}` : `Incorrect (${wrong})`}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="mt-4 text-[var(--muted)]">Nothing to show — every answer was correct.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {shown.map((q) => (
              <Row key={q.n} q={q} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * The one place audio is pausable and seekable. During the test it isn't —
 * this exists so you can re-listen to whatever you missed.
 */
function AudioReplay() {
  const audio = useTestStore((s) => s.session?.test.audio ?? NO_AUDIO);
  if (audio.length === 0) return null;

  return (
    <section className="no-print mt-6 rounded-lg border border-[var(--border)] p-4">
      <h2 className="font-semibold">Replay the recordings</h2>
      <p className="mt-0.5 text-sm text-[var(--muted)]">
        Now that the test is over you can pause, seek and replay freely.
      </p>
      <ul className="mt-3 space-y-3">
        {audio.map((track) => (
          <li key={`${track.part}-${track.url}`}>
            <p className="mb-1 text-sm font-medium">Part {track.part}</p>
            <audio controls preload="none" src={track.url} className="w-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-5 py-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-bold tabular-nums ${big ? "text-3xl" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function Row({ q }: { q: QuestionResult }) {
  return (
    <li className="grid grid-cols-[2.5rem_1.5rem_1fr_1fr] items-baseline gap-3 py-2.5 text-sm">
      <span className="font-bold tabular-nums">{q.n}</span>
      <span
        aria-label={q.correct ? "correct" : "incorrect"}
        style={{ color: q.correct ? "var(--correct)" : "var(--incorrect)" }}
        className="text-base font-bold"
      >
        {q.correct ? "✓" : "✕"}
      </span>
      <span className="min-w-0">
        <span className="text-[var(--muted)]">You: </span>
        {q.blank ? (
          <em className="text-[var(--muted)]">blank</em>
        ) : (
          <span className="break-words">{q.given}</span>
        )}
        {q.lenient && q.correct && (
          <span className="ml-2 text-xs text-[var(--muted)]">(accepted)</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="text-[var(--muted)]">Answer: </span>
        <span className="break-words font-medium">{q.expected}</span>
      </span>
    </li>
  );
}
