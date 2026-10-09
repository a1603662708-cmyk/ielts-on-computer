import { toBand } from "./bandTables";
import {
  groupQuestionNumbers,
  type AnswerKey,
  type Group,
  type Test,
} from "./schema";

export type ResponseMap = Record<number, string | string[] | undefined>;

export type QuestionResult = {
  n: number;
  part: number;
  groupType: Group["type"];
  /** What the candidate entered, display-ready. */
  given: string;
  /** All accepted answers, display-ready. */
  expected: string;
  correct: boolean;
  /** True when the answer only matched after normalisation (case, spacing…). */
  lenient: boolean;
  /** True when the candidate left it blank. */
  blank: boolean;
};

export type PartResult = { part: number; correct: number; total: number };

export type ScoreReport = {
  raw: number;
  total: number;
  band: number;
  questions: QuestionResult[];
  parts: PartResult[];
};

/* ---------------------------------------------------------------------------
 * Normalisation
 * ------------------------------------------------------------------------- */

function normalise(
  value: string,
  options?: AnswerKey["normalization"],
): string {
  let result = value;
  if (options?.trimWhitespace !== false)
    result = result.replace(/\s+/g, " ").trim();
  if (options?.caseInsensitive !== false) result = result.toLowerCase();
  return result;
}
function strict(value: string): string {
  return value;
}

/**
 * Answer keys are commonly written `verandas / verandahs`, so a spaced slash
 * separates alternatives. The space is required: `km/h` stays one answer.
 */
function accepted(key: string | string[] | undefined): string[] {
  if (key === undefined) return [];
  return (Array.isArray(key) ? key : [key])
    .flatMap((entry) => entry.split(/\s+\/\s*|\s*\/\s+/))
    .map(strict)
    .filter((s) => s.length > 0);
}

function matches(
  given: string,
  candidates: string[],
  options?: AnswerKey["normalization"],
): { hit: boolean; lenient: boolean } {
  const g = strict(given);
  if (g.trim().length === 0) return { hit: false, lenient: false };

  if (candidates.some((c) => c === g)) return { hit: true, lenient: false };

  const gn = normalise(g, options);
  for (const c of candidates) {
    const cn = normalise(c, options);
    if (cn === gn) return { hit: true, lenient: true };
  }
  return { hit: false, lenient: false };
}

/* ---------------------------------------------------------------------------
 * Marking
 * ------------------------------------------------------------------------- */

function displayGiven(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value.join(", ") : value;
}

function displayExpected(key: string | string[] | undefined): string {
  if (key === undefined) return "—";
  return Array.isArray(key) ? key.join(" / ") : key;
}

export function score(
  test: Test,
  key: AnswerKey,
  responses: ResponseMap,
): ScoreReport {
  const questions: QuestionResult[] = [];

  for (const part of test.parts) {
    for (const group of part.groups) {
      const numbers = groupQuestionNumbers(group);

      if (group.type === "mcq-multi") {
        // The whole group is one selection graded across its question numbers.
        const given = responses[numbers[0]];
        const selected = Array.isArray(given) ? given : given ? [given] : [];
        const pool = [
          ...new Set(
            selected
              .slice(0, group.pick)
              .map((s) => normalise(s, key.normalization)),
          ),
        ];
        const candidates = numbers.map((n) =>
          accepted(key.answers[String(n)]).map((a) =>
            normalise(a, key.normalization),
          ),
        );
        // Maximum matching avoids losing a mark when accepted alternatives overlap.
        const owner = new Map<number, number>();
        function assign(question: number, visited: Set<number>): boolean {
          for (let choice = 0; choice < pool.length; choice++) {
            if (
              visited.has(choice) ||
              !candidates[question].includes(pool[choice])
            )
              continue;
            visited.add(choice);
            const previous = owner.get(choice);
            if (previous === undefined || assign(previous, visited)) {
              owner.set(choice, question);
              return true;
            }
          }
          return false;
        }
        numbers.forEach((_, i) => assign(i, new Set()));
        const matched = numbers.map((_, i) => {
          const choice = [...owner].find(([, q]) => q === i)?.[0];
          return choice === undefined ? undefined : pool[choice];
        });
        const unused = pool.filter((_, i) => !owner.has(i));

        numbers.forEach((n, i) => {
          questions.push({
            n,
            part: part.part,
            groupType: group.type,
            given: matched[i] ?? unused.shift() ?? "",
            expected: displayExpected(key.answers[String(n)]),
            // One mark per matched answer; no duplicate selection can score twice.
            correct: matched[i] !== undefined,
            lenient: false,
            blank: selected.length === 0,
          });
        });
        continue;
      }

      for (const n of numbers) {
        const raw = responses[n];
        const given = displayGiven(raw);
        const candidates = accepted(key.answers[String(n)]);
        const { hit, lenient } = matches(given, candidates, key.normalization);

        questions.push({
          n,
          part: part.part,
          groupType: group.type,
          given,
          expected: displayExpected(key.answers[String(n)]),
          correct: hit,
          lenient,
          blank: strict(given).length === 0,
        });
      }
    }
  }

  questions.sort((a, b) => a.n - b.n);

  const raw = questions.filter((q) => q.correct).length;
  const total = questions.length;

  const byPart = new Map<number, PartResult>();
  for (const q of questions) {
    const entry = byPart.get(q.part) ?? { part: q.part, correct: 0, total: 0 };
    entry.total += 1;
    if (q.correct) entry.correct += 1;
    byPart.set(q.part, entry);
  }

  return {
    raw,
    total,
    band: toBand(raw, total, test.type),
    questions,
    parts: [...byPart.values()].sort((a, b) => a.part - b.part),
  };
}
