import { groupQuestionNumbers, type Test } from "./schema";
import type { ResponseMap } from "./scoring";

export type NavEntry = { n: number; part: number };

/** Every question number in the test, with the part it belongs to. */
export function navEntries(test: Test): NavEntry[] {
  return test.parts
    .flatMap((part) =>
      part.groups.flatMap((group) =>
        groupQuestionNumbers(group).map((n) => ({ n, part: part.part })),
      ),
    )
    .sort((a, b) => a.n - b.n);
}

/**
 * Which questions count as answered, for the nav-bar underline (video 0:55).
 *
 * `mcq-multi` stores one array against the first number in its range, so the
 * whole range lights up together once the required number of options is
 * chosen — the group is not partially answerable.
 */
export function answeredSet(test: Test, responses: ResponseMap): Set<number> {
  const answered = new Set<number>();

  for (const part of test.parts) {
    for (const group of part.groups) {
      const numbers = groupQuestionNumbers(group);

      if (group.type === "mcq-multi") {
        const value = responses[numbers[0]];
        const chosen = Array.isArray(value) ? value.length : 0;
        if (chosen >= group.pick) for (const n of numbers) answered.add(n);
        continue;
      }

      for (const n of numbers) {
        const value = responses[n];
        const filled = Array.isArray(value)
          ? value.length > 0
          : typeof value === "string" && value.trim().length > 0;
        if (filled) answered.add(n);
      }
    }
  }

  return answered;
}
