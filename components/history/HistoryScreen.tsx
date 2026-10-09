"use client";
import { useEffect, useState } from "react";
import { ReviewPassage } from "./ReviewPassage";
import { LocalNav } from "@/components/library/LocalNav";
import {
  identity,
  isObjective,
  loadHistory,
  type HistoryEntry,
  type ObjectiveHistory,
} from "@/storage/history";
import { wordCount, exportEssay } from "@/exam/workStore";
import { RecordingPlayer } from "@/components/speaking/RecordingPlayer";
import { groupQuestionNumbers } from "@/lib/schema";
import { QuestionReference } from "@/components/questions/QuestionReference";
import { AudioReview } from "./MediaReview";
export function HistoryScreen() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void loadHistory()
      .then(setHistory)
      .catch((e) => setError(String(e)));
  }, []);
  return (
    <>
      <LocalNav />
      <main className="local-shell">
        <p className="muted uppercase tracking-widest">Saved on this Mac</p>
        <h1>Exam history</h1>
        <p className="muted">
          Every submitted section is preserved. Full Mock results appear after
          Writing is submitted.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!history.length && (
          <p className="notice my-8">
            No submitted exams yet. Start a test from Library; completed work
            will appear here.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="review-table my-6">
            <thead>
              <tr>
                <th>Test</th>
                <th>Date</th>
                <th>Section</th>
                <th>Result</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const name = identity(entry);
                return (
                  <tr key={entry.id}>
                    <td>
                      {name.book} / Test {name.test}
                    </td>
                    <td>{new Date(entry.date).toLocaleString()}</td>
                    <td className="capitalize">{entry.section}</td>
                    <td>
                      {isObjective(entry)
                        ? `${entry.report.raw}/${entry.report.total} · Estimated Band ${entry.report.band.toFixed(1)}`
                        : entry.work.kind === "writing"
                          ? `${wordCount(entry.work.essays[0])} / ${wordCount(entry.work.essays[1])} words`
                          : `${entry.work.recordings.length} recordings`}
                    </td>
                    <td>
                      <button onClick={() => setSelected(entry)}>Review</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selected && (
          <div className="border-t-2 border-[var(--border-strong)] pt-4">
            <div className="flex justify-between">
              <h2 className="capitalize">{selected.section} review</h2>
              <button onClick={() => setSelected(null)}>Close review</button>
            </div>
            {isObjective(selected) ? (
              <ObjectiveReview entry={selected} />
            ) : selected.work.kind === "writing" ? (
              <>
                <p>
                  Time used:{" "}
                  {Math.max(
                    0,
                    Math.round(
                      ((selected.work.completedAt ?? selected.date) -
                        selected.work.startedAt) /
                        60000,
                    ),
                  )}{" "}
                  minutes. No IELTS band assigned.
                </p>
                <div className="actions my-4">
                  <button
                    onClick={() => {
                      if (
                        !isObjective(selected) &&
                        selected.work.kind === "writing"
                      )
                        exportEssay(selected.work, "txt");
                    }}
                  >
                    Export TXT
                  </button>
                  <button
                    onClick={() => {
                      if (
                        !isObjective(selected) &&
                        selected.work.kind === "writing"
                      )
                        exportEssay(selected.work, "md");
                    }}
                  >
                    Export Markdown
                  </button>
                </div>
                {selected.work.essays.map((essay, i) => (
                  <section className="local-row" key={i}>
                    <h3 className="font-bold">
                      Task {i + 1} · {wordCount(essay)} words ·{" "}
                      {wordCount(essay) >= (i === 0 ? 150 : 250)
                        ? "Minimum reached"
                        : "Below recommended length"}
                    </h3>
                    {!isObjective(selected) &&
                      selected.work.kind === "writing" && (
                        <p className="muted my-3 whitespace-pre-wrap">
                          {selected.work.paper.tasks[i].prompt}
                        </p>
                      )}
                    <p className="whitespace-pre-wrap">{essay || "(Blank)"}</p>
                  </section>
                ))}
              </>
            ) : (
              <>
                <p>
                  No IELTS band assigned. These are your original recordings.
                </p>
                <p className="notice whitespace-pre-wrap">
                  Preparation notes: {selected.work.notes || "None"}
                </p>
                {selected.work.recordings.map((r) => (
                  <section className="local-row" key={r.id}>
                    <h3>{r.question}</h3>
                    <RecordingPlayer entry={r} />
                  </section>
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
export function ObjectiveReview({ entry }: { entry: ObjectiveHistory }) {
  const [wrongOnly, setWrongOnly] = useState(true);
  const { session, report } = entry;
  return (
    <>
      <p>
        {report.raw}/{report.total} · Estimated Band {report.band.toFixed(1)}
        {report.total !== 40
          ? " (scaled from a short practice test; not a full-test estimate)"
          : ""}
      </p>
      {session.incident && <p role="alert">{session.incident}</p>}
      <label className="block my-5">
        <input
          type="checkbox"
          checked={wrongOnly}
          onChange={(e) => setWrongOnly(e.target.checked)}
        />{" "}
        Wrong answers only
      </label>
      {session.test.audio?.map((track, i) => (
        <AudioReview key={i} url={track.url} label={`Part ${track.part}`} />
      ))}
      {report.questions
        .filter((q) => !wrongOnly || !q.correct)
        .map((q) => {
          const part = session.test.parts.find((p) => p.part === q.part);
          const group = part?.groups.find((g) =>
            groupQuestionNumbers(g).includes(q.n),
          );
          const prompt =
            group?.type === "mcq-multi"
              ? group.prompt
              : group?.questions.find((p) => p.n === q.n)?.prompt;
          return (
            <article className="local-row" key={q.n}>
              <h3 className="font-bold">
                {q.correct ? "✓" : "✕"} Question {q.n} · Part {q.part} ·{" "}
                {group?.questionType ?? q.groupType}
              </h3>
              <p>
                {prompt ?? "Complete the blank in the original question below."}
              </p>
              <div className="grid grid-cols-2 gap-4 my-3">
                <p>
                  Your answer: <strong>{q.given || "(Blank)"}</strong>
                </p>
                <p>
                  Correct answer: <strong>{q.expected}</strong>
                </p>
              </div>
              <details>
                <summary>View passage and original question</summary>
                {part?.passage && (
                  <ReviewPassage
                    passage={part.passage}
                    part={part.part}
                    session={session}
                  />
                )}
                {group && <QuestionReference group={group} />}
              </details>
            </article>
          );
        })}
      {session.notes.length > 0 && (
        <section className="local-row">
          <h3 className="font-bold">Saved notes</h3>
          {session.notes.map((n) => (
            <p key={n.id}>
              Passage {n.part ?? 1}: {n.text || "(Empty note)"}
            </p>
          ))}
        </section>
      )}
      <p className="muted mt-5">
        {session.highlights.length} highlight ranges saved with this exam.
      </p>
    </>
  );
}
