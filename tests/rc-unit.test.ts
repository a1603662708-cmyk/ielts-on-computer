import { it, expect } from "vitest";
import { score } from "@/lib/scoring";
import { parseLibrary } from "@/types/exam";
import { wordCount } from "@/exam/workStore";
import { formatClock } from "@/lib/useTimer";
import {
  putAsset,
  saveRecord,
  collectOrphanAssets,
  getAsset,
} from "@/storage/db";
import { assertStoredSession } from "@/storage/validate-session";
import original from "@/tests/fixtures/rc-paper.json";
for (const type of ["reading", "listening"] as const)
  for (const raw of [0, 1, 39, 40])
    it(`${type} exact scoring ${raw}/40 and band bounds`, () => {
      const base = parseLibrary(original).sections[type]!;
      const paper = {
        ...base.paper,
        parts: [
          {
            part: 1,
            groups: [
              {
                type: "gap" as const,
                questions: Array.from({ length: 40 }, (_, i) => ({
                  n: i + 1,
                  prompt: "Answer",
                })),
              },
            ],
          },
        ],
      };
      const answers = Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [i + 1, ["colour", "color"]]),
      );
      const responses = Object.fromEntries(
        Array.from({ length: raw }, (_, i) => [
          i + 1,
          i % 2 ? " COLOR " : "colour",
        ]),
      );
      const report = score(paper, { formatVersion: 1, answers }, responses);
      expect(report.raw).toBe(raw);
      expect(report.total).toBe(40);
      expect(report.band).toBe(raw >= 39 ? 9 : raw === 0 ? 0 : 1);
    });
it("whitespace-only response never earns a mark even with a damaged whitespace key", () => {
  const e = parseLibrary(original).sections.reading!;
  expect(
    score(e.paper, { formatVersion: 1, answers: { 7: " " } }, { 7: " " }).raw,
  ).toBe(0);
});
it("all countdown display boundaries match minutes and seconds", () => {
  expect([3600, 3599, 600, 300, 60, 10, 1, 0].map(formatClock)).toEqual([
    "60:00",
    "59:59",
    "10:00",
    "05:00",
    "01:00",
    "00:10",
    "00:01",
    "00:00",
  ]);
});
it("word count handles apostrophes hyphens numbers punctuation and newlines", () => {
  expect(wordCount("  well-known don't 123\nhello world ... —  ")).toBe(5);
});
it("incomplete answer keys and blank values cannot become scored imports", () => {
  const a = structuredClone(original);
  delete (a.sections.listening.key.answers as Record<string, unknown>)["1"];
  expect(() => parseLibrary(a)).toThrow(/missing answers/);
  const b = structuredClone(original);
  b.sections.listening.key.answers["1"] = " ";
  expect(() => parseLibrary(b)).toThrow();
});
it("damaged objective and writing records are rejected before rendering", () => {
  expect(() => assertStoredSession({ id: "broken" }, "objective")).toThrow(
    /Stored exam data is invalid/,
  );
  expect(() =>
    assertStoredSession({ kind: "writing", essays: null }, "work"),
  ).toThrow();
});
it("orphan cleanup keeps historical assets and removes abandoned imports", async () => {
  const retained = await putAsset(new Blob(["saved"]), "rc-retained");
  const abandoned = await putAsset(new Blob(["unused"]), "rc-abandoned");
  await saveRecord("rc-asset-owner", { asset: retained });
  await collectOrphanAssets();
  expect(await (await getAsset(retained)).text()).toBe("saved");
  await expect(getAsset(abandoned)).rejects.toThrow(/Missing local file/);
});
