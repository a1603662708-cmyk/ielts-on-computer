import { assertStoredSession } from "./validate-session";
import type { Session } from "@/lib/store";
import type { ScoreReport } from "@/lib/scoring";
import type { WorkSession } from "@/exam/workStore";
import type { MockRun } from "@/exam/mock";
import { listRecords, readRecord } from "./db";
export type ObjectiveHistory = {
  id: string;
  section: "reading" | "listening";
  date: number;
  session: Session;
  report: ScoreReport;
  endedBy: "time" | "manual";
};
export type WorkHistory = {
  id: string;
  section: "writing" | "speaking";
  date: number;
  work: WorkSession;
};
export type HistoryEntry = ObjectiveHistory | WorkHistory;
export function isObjective(entry: HistoryEntry): entry is ObjectiveHistory {
  return "session" in entry;
}
export async function loadHistory() {
  const [all, run] = await Promise.all([
    listRecords<HistoryEntry>("history:"),
    readRecord<MockRun>("mock.run"),
  ]);
  for (const entry of all) {
    if (!entry || typeof entry !== "object" || typeof entry.date !== "number")
      throw new Error(
        "Stored history is invalid. Your data has been kept; restore a backup before continuing.",
      );
    assertStoredSession(
      isObjective(entry) ? entry.session : entry.work,
      isObjective(entry) ? "objective" : "work",
    );
    if (
      isObjective(entry) &&
      (!entry.report || !Array.isArray(entry.report.questions))
    )
      throw new Error(
        "Stored history score is invalid. Your original answers have been kept.",
      );
  }
  return all
    .filter((e) => {
      const id = isObjective(e) ? e.session.mockRunId : e.work.mockRunId;
      return !id || !run || run.id !== id || run.stage === "complete";
    })
    .sort((a, b) => b.date - a.date);
}
export function identity(entry: HistoryEntry) {
  const s = isObjective(entry) ? entry.session : entry.work;
  return {
    book: s.book ?? "Imported",
    test: s.testNumber ?? 1,
    libraryId: s.libraryId ?? "legacy",
  };
}
