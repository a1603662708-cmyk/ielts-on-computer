"use client";
import { useEffect, useState } from "react";
import { LocalNav } from "@/components/library/LocalNav";
import { loadHistory, isObjective, type HistoryEntry } from "@/storage/history";
import { aggregateMistakes, aggregateTypes } from "@/scoring/mistakes";
import { ObjectiveReview } from "./HistoryScreen";
export function MistakesScreen() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [book, setBook] = useState("");
  const [test, setTest] = useState("");
  const [type, setType] = useState("");
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void loadHistory()
      .then(setHistory)
      .catch((e) => setError(String(e)));
  }, []);
  const all = aggregateMistakes(history);
  const filtered = all.filter(
    (e) =>
      (!book || e.book === book) &&
      (!test || String(e.test) === test) &&
      (!type || e.type === type),
  );
  const selected = history.find((e) => e.id === review);
  return (
    <>
      <LocalNav />
      <main className="local-shell">
        <p className="muted uppercase tracking-widest">Listening & Reading</p>
        <h1>Mistake notebook</h1>
        <p className="muted">
          Errors are counted across submitted attempts. Filter by book, test and
          question type.
        </p>
        {error && <p role="alert">{error}</p>}
        <section className="notice my-6">
          <strong>Question types with the highest error rate</strong>
          <div className="actions mt-3">
            {aggregateTypes(history).map((t) => (
              <span key={t.type}>
                {t.type}: {Math.round((t.wrong / t.attempts) * 100)}% ({t.wrong}
                /{t.attempts})
              </span>
            ))}
          </div>
        </section>
        <div className="actions my-6">
          {[
            {
              label: "Book",
              value: book,
              set: setBook,
              options: [...new Set(all.map((e) => e.book))],
            },
            {
              label: "Test",
              value: test,
              set: setTest,
              options: [...new Set(all.map((e) => String(e.test)))],
            },
            {
              label: "Question type",
              value: type,
              set: setType,
              options: [...new Set(all.map((e) => e.type))],
            },
          ].map((f) => (
            <label key={f.label}>
              {f.label}{" "}
              <select
                className="border p-2"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              >
                <option value="">All</option>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="overflow-auto">
          <table className="review-table">
            <thead>
              <tr>
                <th>Test / Question</th>
                <th>Type</th>
                <th>Last incorrect answer</th>
                <th>Correct answer</th>
                <th>Errors / attempts</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={`${e.entryId}-${e.n}`}>
                  <td>
                    {e.book} / {e.test} · {e.section} Q{e.n}
                  </td>
                  <td>{e.type}</td>
                  <td>{e.given || "(Blank)"}</td>
                  <td>{e.expected}</td>
                  <td>
                    {e.wrong} / {e.attempts}
                  </td>
                  <td>
                    <button onClick={() => setReview(e.entryId)}>Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p className="notice my-6">No recorded errors match these filters.</p>
        )}
        {selected && isObjective(selected) && (
          <section className="mt-8">
            <h2>Exam review</h2>
            <button onClick={() => setReview("")}>Close</button>
            <ObjectiveReview entry={selected} />
          </section>
        )}
      </main>
    </>
  );
}
