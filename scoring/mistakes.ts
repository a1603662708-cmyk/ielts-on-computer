import { identity, isObjective, type HistoryEntry } from "@/storage/history";
import { groupQuestionNumbers } from "@/lib/schema";
export function aggregateMistakes(history: HistoryEntry[]) {
  const errors = new Map<
    string,
    {
      book: string;
      test: number;
      type: string;
      section: string;
      n: number;
      wrong: number;
      attempts: number;
      given: string;
      expected: string;
      entryId: string;
    }
  >();
  for (const entry of [...history].sort((a, b) => a.date - b.date)) {
    if (!isObjective(entry)) continue;
    const info = identity(entry);
    for (const q of entry.report.questions) {
      const group = entry.session.test.parts
        .flatMap((p) => p.groups)
        .find((g) => groupQuestionNumbers(g).includes(q.n));
      const type = group?.questionType ?? q.groupType;
      const key = `${info.libraryId}:${entry.section}:${q.n}`;
      const current = errors.get(key) ?? {
        book: info.book,
        test: info.test,
        type,
        section: entry.section,
        n: q.n,
        wrong: 0,
        attempts: 0,
        given: "",
        expected: q.expected,
        entryId: entry.id,
      };
      current.attempts++;
      if (!q.correct) {
        current.wrong++;
        current.given = q.given;
        current.expected = q.expected;
        current.entryId = entry.id;
      }
      errors.set(key, current);
    }
  }
  return [...errors.values()]
    .filter((e) => e.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong);
}
export function aggregateTypes(history: HistoryEntry[]) {
  const types = new Map<
    string,
    { type: string; attempts: number; wrong: number }
  >();
  for (const entry of history) {
    if (!isObjective(entry)) continue;
    for (const q of entry.report.questions) {
      const group = entry.session.test.parts
        .flatMap((p) => p.groups)
        .find((g) => groupQuestionNumbers(g).includes(q.n));
      const type = group?.questionType ?? q.groupType;
      const stats = types.get(type) ?? { type, attempts: 0, wrong: 0 };
      stats.attempts++;
      if (!q.correct) stats.wrong++;
      types.set(type, stats);
    }
  }
  return [...types.values()].sort(
    (a, b) => b.wrong / b.attempts - a.wrong / a.attempts,
  );
}
