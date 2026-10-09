import type { LibraryTest } from "@/types/exam";
import { journalWrite } from "@/storage/journal";
import { prepareAudio } from "./audio";
import { clockNow } from "./clock";
import { readRecord, saveRecord } from "@/storage/db";
import { hydrateStore, useTestStore } from "@/lib/store";
import { hydrateWork, useWorkStore } from "./workStore";
import { testQuestionNumbers } from "@/lib/schema";
export type MockRun = {
  id: string;
  test: LibraryTest;
  startedAt: number;
  stage: "listening" | "reading" | "writing" | "complete";
  stageStartedAt: number;
  completedAt?: number;
};
export function validateFullMock(test: LibraryTest) {
  if (
    !test.sections.listening ||
    !test.sections.reading ||
    !test.sections.writing
  )
    throw new Error(
      "Full Mock requires Listening, Reading and Writing. Import the missing sections.",
    );
  for (const type of ["listening", "reading"] as const) {
    const entry = test.sections[type]!;
    const nums = testQuestionNumbers(entry.paper);
    if (entry.paper.parts.some((part, index) => part.part !== index + 1))
      throw new Error(
        `${type}: Part numbers must be sequential, starting at 1.`,
      );
    if (nums.length !== 40 || nums.some((n, i) => n !== i + 1))
      throw new Error(
        `${type}: Full Mock requires question numbers 1–40 exactly once.`,
      );
    if (entry.paper.parts.length !== (type === "listening" ? 4 : 3))
      throw new Error(`${type}: incorrect number of parts for Full Mock.`);
    if (
      nums.some(
        (n) => !entry.key.answers[n] || entry.key.answers[n].length === 0,
      )
    )
      throw new Error(
        `${type}: Complete the answer key before starting Full Mock.`,
      );
  }
}
export async function startFullMock(test: LibraryTest) {
  validateFullMock(test);
  const paper = await prepareAudio(test.sections.listening!.paper);
  const duration =
    Math.max(
      1800,
      Math.ceil(
        paper.audio?.reduce((total, t) => total + (t.duration ?? 0), 0) ?? 0,
      ),
    ) + 120;
  const prepared = {
    ...test,
    sections: {
      ...test.sections,
      listening: {
        ...test.sections.listening!,
        paper: { ...paper, durationSeconds: duration },
      },
    },
  };
  const now = clockNow();
  const run: MockRun = {
    id: crypto.randomUUID(),
    test: prepared,
    startedAt: now,
    stage: "listening",
    stageStartedAt: now,
  };
  await saveRecord("mock.run", run);
  return run;
}
let coordinating: Promise<string> | undefined;
export function coordinateMock(): Promise<string> {
  return (coordinating ??= (async () => {
    await Promise.all([hydrateStore(), hydrateWork()]);
    let run = await readRecord<MockRun>("mock.run");
    if (!run || run.stage === "complete") return "/history";
    for (let attempts = 0; attempts < 4; attempts++) {
      if (run.stage === "complete") return "/history";
      const options = {
        libraryId: run.test.id,
        book: run.test.book,
        testNumber: run.test.test,
        mode: "mock" as const,
        mockRunId: run.id,
      };
      if (run.stage === "writing") {
        let work = useWorkStore.getState().session;
        if (work?.mockRunId === run.id && work.finished) {
          run = {
            ...run,
            stage: "complete",
            completedAt: work.completedAt ?? clockNow(),
          };
          await saveRecord("mock.run", run);
          await saveRecord(`mock:${run.id}`, run);
          return "/history";
        }
        if (work?.mockRunId !== run.id || work.kind !== "writing") {
          useWorkStore
            .getState()
            .startWriting(run.test.sections.writing!, options);
          useWorkStore.getState().update({
            startedAt: run.stageStartedAt,
            endsAt: run.stageStartedAt + 3600000,
          });
          work = useWorkStore.getState().session;
        }
        if (work && clockNow() >= work.endsAt) {
          await useWorkStore.getState().finish();
          continue;
        }
        return "/writing";
      }
      const state = useTestStore.getState();
      const objective = state.session;
      if (
        objective?.mockRunId === run.id &&
        objective.test.type === run.stage &&
        state.phase === "finished"
      ) {
        run = {
          ...run,
          stage: run.stage === "listening" ? "reading" : "writing",
          stageStartedAt:
            state.endedBy === "time" ? objective.endsAt : clockNow(),
        };
        await saveRecord("mock.run", run);
        continue;
      }
      if (
        objective?.mockRunId !== run.id ||
        objective.test.type !== run.stage
      ) {
        const entry = run.test.sections[run.stage]!;
        const paper = {
          ...entry.paper,
          durationSeconds:
            run.stage === "reading" ? 3600 : entry.paper.durationSeconds,
        };
        state.start(paper, entry.key, options);
        const active = useTestStore.getState().session!;
        const session = {
          ...active,
          startedAt: run.stageStartedAt,
          endsAt: run.stageStartedAt + paper.durationSeconds * 1000,
        };
        useTestStore.setState({ session });
        journalWrite("ielts.session", session);
        await saveRecord("ielts.session", session);
      }
      return "/test";
    }
    return "/mock";
  })().finally(() => {
    coordinating = undefined;
  }));
}
