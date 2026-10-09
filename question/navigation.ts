import { navEntries } from "@/lib/progress";
import type { Test } from "@/lib/schema";
export function nextQuestion(test: Test, current: number, delta: number) {
  const entries = navEntries(test);
  const index = Math.max(
    0,
    entries.findIndex((e) => e.n === current),
  );
  return entries[Math.max(0, Math.min(entries.length - 1, index + delta))];
}
