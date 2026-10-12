import { AnswerKeySchema, TestSchema } from "@/lib/schema";
import { draftSection, emptyLibrary } from "./draft";
import { parseLibrary, type LibraryTest, type Section } from "@/types/exam";
import type { FileSection } from "./classifier";

export type FullFile = {
  name: string;
  section: FileSection | "ignore";
  text?: string;
  json?: unknown;
  media?: Blob;
  part?: number;
};

export function constructFullTest(
  files: FullFile[],
  metadata: Pick<LibraryTest, "book" | "test" | "title" | "module">,
  validate = true,
): {
  test: LibraryTest;
  assets: { ref: string; blob: Blob }[];
  warnings: string[];
} {
  const result = emptyLibrary();
  Object.assign(result, metadata);
  const assets: { ref: string; blob: Blob }[] = [];
  const warnings: string[] = [];
  const textBySection = new Map<Section, string[]>();
  const keys = new Map<Section, unknown>();
  const media: FullFile[] = [];
  const audioParts = new Set<number>();
  const imageSlots = new Set<string>();
  const structuredSections = new Set<Section>();
  let sharedMetadata = false;
  // Apply a complete metadata file first; explicitly assigned section files then win.
  const ordered = [...files].sort(
    (a, b) => Number(b.section === "shared") - Number(a.section === "shared"),
  );
  for (const file of ordered) {
    if (file.section === "ignore") continue;
    if (file.section === "unknown")
      throw new Error(`${file.name}: choose a section or Ignore.`);
    if (file.media) {
      media.push(file);
      continue;
    }
    if (file.json !== undefined) {
      const raw = file.json;
      if (file.section === "shared") {
        if (sharedMetadata)
          throw new Error(
            "Multiple complete metadata files were selected. Keep one or Ignore the others.",
          );
        sharedMetadata = true;
        const full = parseLibrary(raw);
        result.sections = { ...result.sections, ...full.sections };
        continue;
      }
      const section = file.section;
      const candidate = raw as Record<string, unknown>;
      if (
        candidate &&
        typeof candidate === "object" &&
        "paper" in candidate &&
        "key" in candidate &&
        (section === "reading" || section === "listening")
      ) {
        if (structuredSections.has(section))
          throw new Error(
            `${section}: multiple structured papers were selected.`,
          );
        structuredSections.add(section);
        result.sections[section] =
          candidate as LibraryTest["sections"]["reading"];
      } else if (TestSchema.safeParse(raw).success) {
        const paper = TestSchema.parse(raw);
        if (paper.type !== section)
          throw new Error(
            `${file.name}: paper type conflicts with assignment.`,
          );
        if (structuredSections.has(section))
          throw new Error(
            `${section}: multiple structured papers were selected.`,
          );
        structuredSections.add(section);
        result.sections[paper.type] = {
          paper,
          key: { formatVersion: 1, answers: {} },
        };
      } else if (AnswerKeySchema.safeParse(raw).success) {
        if (keys.has(section))
          throw new Error(`${section}: multiple answer keys were selected.`);
        keys.set(section, AnswerKeySchema.parse(raw));
      } else if (section === "writing" || section === "speaking") {
        if (structuredSections.has(section))
          throw new Error(
            `${section}: multiple structured papers were selected.`,
          );
        structuredSections.add(section);
        result.sections[section] = raw as never;
      } else
        throw new Error(
          `${file.name}: JSON is not a supported section or answer key.`,
        );
      continue;
    }
    if (file.section === "shared") {
      warnings.push(
        `${file.name}: shared text is not assigned to a section. Edit structured JSON if needed.`,
      );
      continue;
    }
    const list = textBySection.get(file.section) ?? [];
    list.push(file.text ?? "");
    textBySection.set(file.section, list);
  }
  for (const [section, texts] of textBySection) {
    if (result.sections[section]) {
      warnings.push(
        `${section}: structured JSON takes precedence over extracted text. Check ${texts.length} source file(s).`,
      );
      continue;
    }
    const drafted = draftSection(texts.join("\n\n"), section);
    Object.assign(result.sections, drafted);
    warnings.push(
      `${section}: extracted text is a draft. Check all questions, answers, passages and task boundaries.`,
    );
  }
  for (const [section, key] of keys) {
    if (section !== "reading" && section !== "listening")
      throw new Error(
        `${section}: answer key must belong to Reading or Listening.`,
      );
    const entry = result.sections[section];
    if (!entry)
      throw new Error(`${section}: answer key has no questions file.`);
    entry.key = AnswerKeySchema.parse(key);
  }
  for (const file of media) {
    if (file.section === "shared") {
      throw new Error(
        `${file.name}: shared media cannot be attached. Assign its section or Ignore.`,
      );
    }
    const section = file.section as Section;
    if (!result.sections[section])
      throw new Error(`${file.name}: ${section} section is missing.`);
    const ref = `asset:${crypto.randomUUID()}`;
    const part = file.part ?? 1;
    if (
      file.media!.type.startsWith("audio/") ||
      /\.(mp3|m4a|wav|webm|ogg)$/i.test(file.name)
    ) {
      if (section !== "listening")
        throw new Error(
          `${file.name}: audio can only attach to Listening in the current test format.`,
        );
      const paper = result.sections.listening!.paper;
      if (audioParts.has(part))
        throw new Error(
          `${file.name}: Listening Part ${part} has two staged audio files.`,
        );
      audioParts.add(part);
      paper.audio = [
        ...(paper.audio ?? []).filter((a) => a.part !== part),
        { part, url: ref },
      ].sort((a, b) => a.part - b.part);
    } else if (section === "writing") {
      if (part > 2)
        throw new Error(`${file.name}: Writing has only Tasks 1 and 2.`);
      const slot = `writing:${part}`;
      if (imageSlots.has(slot))
        throw new Error(`${file.name}: Writing Task ${part} has two images.`);
      imageSlots.add(slot);
      result.sections.writing!.tasks[part - 1].image = ref;
    } else if (section === "reading" || section === "listening") {
      const slot = `${section}:${part}`;
      if (imageSlots.has(slot))
        throw new Error(
          `${file.name}: ${section} Part ${part} has two images.`,
        );
      imageSlots.add(slot);
      const group = result.sections[section]!.paper.parts.find(
        (p) => p.part === part,
      )?.groups[0];
      if (!group)
        throw new Error(`${file.name}: ${section} Part ${part} is missing.`);
      group.image = ref;
      group.imageAlt = file.name;
    } else
      throw new Error(
        `${file.name}: Speaking media is not supported by the current test format.`,
      );
    assets.push({ ref, blob: file.media! });
  }
  return { test: validate ? parseLibrary(result) : result, assets, warnings };
}
