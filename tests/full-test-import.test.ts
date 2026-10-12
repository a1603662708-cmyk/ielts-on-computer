import { describe, expect, it } from "vitest";
import demo from "@/public/demo/metadata.json";
import { classifyFile } from "@/importer/classifier";
import { constructFullTest, type FullFile } from "@/importer/full-test";
import { getAsset, readRecord } from "@/storage/db";
import { saveFullLibrary } from "@/storage/library";
import type { LibraryTest } from "@/types/exam";
import { parseLibrary } from "@/types/exam";

const example = parseLibrary(demo);
const meta = {
  book: "Full import test",
  test: 7,
  title: "Four sections",
  module: "Academic" as const,
};
const file = (name: string, type = "application/octet-stream") => ({
  name,
  type,
});

describe("full test classifier", () => {
  it.each([
    ["reading.pdf", "reading"],
    ["listening.mp3", "listening"],
    ["writing-task-2.pdf", "writing"],
    ["speaking-part-2.pdf", "speaking"],
    ["ambiguous-file.pdf", "unknown"],
  ])("classifies %s as %s", (name, section) => {
    const result = classifyFile(file(name));
    expect(result.section).toBe(section);
    if (section === "unknown") expect(result.confidence).toBeLessThan(0.8);
  });
  it("uses JSON metadata and keeps unnamed audio under review", () => {
    expect(
      classifyFile(file("paper.json"), { section: "writing" }).section,
    ).toBe("writing");
    expect(
      classifyFile(file("track.mp3", "audio/mpeg")).confidence,
    ).toBeLessThan(0.8);
  });
});

describe("full test construction", () => {
  const sectionFile = (section: keyof LibraryTest["sections"]): FullFile => ({
    name: `${section}.json`,
    section,
    json: structuredClone(example.sections[section]),
  });
  it("combines four valid sections into one v2 test", () => {
    const result = constructFullTest(
      [
        sectionFile("reading"),
        sectionFile("listening"),
        sectionFile("writing"),
        sectionFile("speaking"),
      ],
      meta,
    );
    expect(result.test.formatVersion).toBe(2);
    expect(Object.keys(result.test.sections).sort()).toEqual([
      "listening",
      "reading",
      "speaking",
      "writing",
    ]);
    expect(result.test.sections.reading?.paper.type).toBe("reading");
  });
  it("stores the selected module without changing the format version", () => {
    const result = constructFullTest([sectionFile("reading")], {
      ...meta,
      module: "General Training",
    });
    expect(result.test.module).toBe("General Training");
    expect(result.test.formatVersion).toBe(2);
  });
  it("keeps missing sections absent", () => {
    const result = constructFullTest(
      [sectionFile("reading"), sectionFile("writing")],
      meta,
    );
    expect(Object.keys(result.test.sections).sort()).toEqual([
      "reading",
      "writing",
    ]);
    expect(result.test.sections.listening).toBeUndefined();
    expect(result.test.sections.speaking).toBeUndefined();
  });
  it("refuses competing structured files for one section", () => {
    expect(() =>
      constructFullTest([sectionFile("reading"), sectionFile("reading")], meta),
    ).toThrow("multiple structured papers");
  });
  it("persists imported listening media with the library record", async () => {
    const listening = sectionFile("listening");
    (
      listening.json as NonNullable<LibraryTest["sections"]["listening"]>
    ).paper.audio = undefined;
    const audio = new Blob(["playable sample"], { type: "audio/mpeg" });
    const result = constructFullTest(
      [
        listening,
        { name: "listening.mp3", section: "listening", media: audio, part: 1 },
      ],
      meta,
    );
    await saveFullLibrary(result.test, result.assets);
    const saved = await readRecord<LibraryTest>(`library:${result.test.id}`);
    const ref = saved!.sections.listening!.paper.audio![0].url;
    expect(ref).toMatch(/^asset:/);
    expect(await (await getAsset(ref)).text()).toBe("playable sample");
  });
  it("leaves no library record when an asset write fails", async () => {
    const result = constructFullTest([sectionFile("reading")], meta);
    const first = `asset:${crypto.randomUUID()}`;
    await expect(
      saveFullLibrary(result.test, [
        { ref: first, blob: new Blob(["staged"]) },
        {
          ref: `asset:${crypto.randomUUID()}`,
          blob: (() => {}) as unknown as Blob,
        },
      ]),
    ).rejects.toThrow();
    expect(await readRecord(`library:${result.test.id}`)).toBeUndefined();
    await expect(getAsset(first)).rejects.toThrow("Missing local file");
  });
});
