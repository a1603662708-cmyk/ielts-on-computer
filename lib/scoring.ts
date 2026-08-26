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

/** Loose comparison form: case, whitespace, quotes, dashes, trailing period. */
function normalise(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "")
    .toLowerCase();
}

/** Strict form: exactly what the key says, only whitespace-normalised. */
function strict(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * IELTS accepts an answer with or without a leading article when the article
 * is not part of the tested phrase, so `art gallery` and `the art gallery`
 * both pass. Only applied in the loose pass.
 */
function stripArticle(value: string): string {
  return value.replace(/^(a|an|the)\s+/, "");
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

function matches(given: string, candidates: string[]): { hit: boolean; lenient: boolean } {
  const g = strict(given);
  if (g.length === 0) return { hit: false, lenient: false };

  if (candidates.some((c) => c === g)) return { hit: true, lenient: false };

  const gn = normalise(g);
  const gna = stripArticle(gn);
  for (const c of candidates) {
    const cn = normalise(c);
    if (cn === gn || stripArticle(cn) === gna) return { hit: true, lenient: true };
  }
  return { hit: false, lenient: false };
}

/** Set comparison for "choose TWO letters" groups. Order-insensitive. */
function matchesSet(given: string[], candidates: string[]): boolean {
  const g = new Set(given.map(normalise).filter(Boolean));
  const c = new Set(candidates.map(normalise));
  if (g.size !== c.size) return false;
  for (const item of g) if (!c.has(item)) return false;
  return true;
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

export function score(test: Test, key: AnswerKey, responses: ResponseMap): ScoreReport {
  const questions: QuestionResult[] = [];

  for (const part of test.parts) {
    for (const group of part.groups) {
      const numbers = groupQuestionNumbers(group);

      if (group.type === "mcq-multi") {
        // The whole group is one selection graded across its question numbers.
        const given = responses[numbers[0]];
        const selected = Array.isArray(given) ? given : given ? [given] : [];
        const expectedAll = numbers.flatMap((n) => accepted(key.answers[String(n)]));
        const ok = expectedAll.length > 0 && matchesSet(selected, expectedAll);

        numbers.forEach((n, i) => {
          questions.push({
            n,
            part: part.part,
            groupType: group.type,
            given: selected[i] ?? (i === 0 ? selected.join(", ") : ""),
            expected: expectedAll[i] ?? "—",
            // All-or-nothing: the set is right or it isn't.
            correct: ok,
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
        const { hit, lenient } = matches(given, candidates);

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
