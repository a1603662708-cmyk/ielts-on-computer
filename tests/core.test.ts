import { describe, it, expect } from "vitest";
import { audioPosition, remainingSeconds } from "@/exam/clock";
import { saveRecord, readRecord, putAsset, getAsset } from "@/storage/db";
import { parseLibrary } from "@/types/exam";
describe("core", () => {
  it("timer expires across sleep", () => {
    expect(remainingSeconds(10000, 12000)).toBe(0);
    expect(remainingSeconds(10000, 5001)).toBe(5);
  });
  it("audio resumes at elapsed track, never starts from zero", () => {
    expect(audioPosition([10, 20, 30], 15)).toEqual({ index: 1, offset: 5 });
    expect(audioPosition([10, 20], 60).index).toBe(2);
  });
  it("serial autosave preserves newest answer and blobs", async () => {
    await Promise.all([
      saveRecord("test", { answer: "first" }),
      saveRecord("test", { answer: "latest" }),
    ]);
    expect(await readRecord("test")).toEqual({ answer: "latest" });
    const id = await putAsset(new Blob(["voice"]));
    expect(await (await getAsset(id)).text()).toBe("voice");
  });
  it("rejects invalid import", () => expect(() => parseLibrary({})).toThrow());
});

import { score } from "@/lib/scoring";
import type { Test } from "@/lib/schema";
import { nextQuestion } from "@/question/navigation";
import { useTestStore } from "@/lib/store";
const paper: Test = {
  formatVersion: 1,
  type: "reading",
  title: "Test",
  durationSeconds: 3600,
  parts: [
    {
      part: 1,
      groups: [
        {
          type: "gap",
          questions: [
            { n: 1, prompt: "colour" },
            { n: 2, prompt: "coast" },
          ],
        },
        {
          type: "mcq-multi",
          prompt: "Select two",
          options: ["one", "two", "three"],
          pick: 2,
          range: [3, 4],
        },
      ],
    },
  ],
};
it("strict scoring accepts configured alternatives, rejects article and typo, awards partial multi marks", () => {
  const report = score(
    paper,
    {
      formatVersion: 1,
      answers: { 1: ["colour", "color"], 2: "coast", 3: "A", 4: "C" },
    },
    { 1: " COLOR ", 2: "the coast", 3: ["A", "B"] },
  );
  expect(report.raw).toBe(2);
  expect(report.questions[1].correct).toBe(false);
  expect(
    score(paper, { formatVersion: 1, answers: { 1: "colour" } }, { 1: "colur" })
      .raw,
  ).toBe(0);
});
it("navigation clamps and preserves part mapping", () => {
  expect(nextQuestion(paper, 1, -1).n).toBe(1);
  expect(nextQuestion(paper, 4, 1).n).toBe(4);
});
it("annotations are scoped to passages and mock cannot pause", () => {
  useTestStore.getState().start(paper, { formatVersion: 1, answers: {} });
  useTestStore.getState().addHighlightRange(0, 2);
  useTestStore.getState().setActivePart(2);
  useTestStore.getState().addHighlightRange(0, 2);
  expect(useTestStore.getState().session?.highlights).toHaveLength(2);
  useTestStore.getState().dropHighlightAt(1);
  expect(useTestStore.getState().session?.highlights[0].part).toBe(1);
  useTestStore.getState().togglePause();
  expect(useTestStore.getState().session?.pausedAt).toBeUndefined();
});
it("multi-answer scoring finds the best assignment across overlapping alternatives", () => {
  const report = score(
    paper,
    { formatVersion: 1, answers: { 3: ["A", "B"], 4: "A" } },
    { 3: ["A", "B"] },
  );
  expect(report.raw).toBe(2);
  const duplicate = score(
    paper,
    { formatVersion: 1, answers: { 3: "A", 4: "C" } },
    { 3: ["A", "A"] },
  );
  expect(duplicate.raw).toBe(1);
});
