import { it, expect, vi } from "vitest";
import { clockNow, restoreClock, audioPosition } from "@/exam/clock";
import { parseLibrary } from "@/types/exam";
import { validateFullMock } from "@/exam/mock";
import { draftSection } from "@/importer/draft";
import { readRecord, flushSaves } from "@/storage/db";
import { useTestStore, loadStoredSession } from "@/lib/store";
import { wordCount } from "@/exam/workStore";
import demo from "@/public/demo/metadata.json";
it("clock rollback is detected and monotonic time cannot decrease", () => {
  const now = Date.now();
  const spy = vi.spyOn(Date, "now").mockReturnValue(now - 30000);
  expect(restoreClock(now)).toBe(true);
  expect(clockNow()).toBeGreaterThanOrEqual(now);
  spy.mockRestore();
  restoreClock(Date.now());
});
it("audio moves to next track and terminal state exactly at boundaries", () => {
  expect(audioPosition([30, 20], 30)).toEqual({ index: 1, offset: 0 });
  expect(audioPosition([30, 20], 50)).toEqual({ index: 2, offset: 0 });
});
it("full mock rejects short or incomplete tests", () => {
  const paper = parseLibrary(demo);
  expect(() => validateFullMock(paper)).not.toThrow();
  paper.sections.reading!.paper.parts.pop();
  expect(() => validateFullMock(paper)).toThrow(/1–40/);
});
it("importer detects numbered MCQ and refuses to invent missing questions", () => {
  expect(() =>
    draftSection("A scanned page with no text.", "reading"),
  ).toThrow();
  const sections = draftSection(
    "Passage\n1. Which choice?\nA. one\nB. two",
    "reading",
  );
  expect(sections.reading?.paper.parts[0].groups[0].type).toBe("mcq");
  expect(sections.reading?.key.answers).toEqual({});
});
it("submit archives once, preserves expired sessions and locks answers", async () => {
  const demoTest = parseLibrary(demo).sections.reading!;
  const store = useTestStore.getState();
  store.start({ ...demoTest.paper, durationSeconds: 10 }, demoTest.key, {
    mode: "practice",
  });
  store.answer(1, "iv");
  await flushSaves();
  expect((await loadStoredSession())?.responses[1]).toBe("iv");
  const id = useTestStore.getState().session!.id;
  store.submit("manual");
  store.submit("time");
  await vi.waitFor(() =>
    expect(useTestStore.getState().phase).toBe("finished"),
  );
  store.answer(1, "iii");
  expect(useTestStore.getState().session?.responses[1]).toBe("iv");
  expect(await readRecord(`history:${id}`)).toBeDefined();
});
it("word count handles blank paragraphs and repeated whitespace", () => {
  expect(wordCount(" \n ")).toBe(0);
  expect(wordCount("one\n two  three")).toBe(3);
});
