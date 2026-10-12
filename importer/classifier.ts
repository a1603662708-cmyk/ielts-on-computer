import type { Section } from "@/types/exam";

export type FileSection = Section | "shared" | "unknown";
export type Classification = {
  section: FileSection;
  confidence: number;
  reason: string;
};

const sections: Section[] = ["reading", "listening", "writing", "speaking"];

export function classifyFile(
  file: Pick<File, "name" | "type">,
  content?: unknown,
): Classification {
  if (content && typeof content === "object") {
    const value = content as Record<string, unknown>;
    for (const field of ["section", "type", "module"]) {
      const candidate = String(value[field] ?? "").toLowerCase();
      if (sections.includes(candidate as Section))
        return {
          section: candidate as Section,
          confidence: 1,
          reason: `JSON ${field}`,
        };
    }
    if (value.formatVersion === 2 && value.sections)
      return {
        section: "shared",
        confidence: 1,
        reason: "Complete test metadata",
      };
  }
  const name = file.name.toLowerCase();
  const matches = sections.filter((section) => name.includes(section));
  if (matches.length === 1)
    return { section: matches[0], confidence: 0.95, reason: "File name" };
  if (matches.length > 1)
    return {
      section: "unknown",
      confidence: 0.2,
      reason: "Conflicting section names",
    };
  if (
    /(?:^|[^a-z])(?:audio|transcript)(?:[^a-z]|$)/.test(name) ||
    /\.(mp3|wav|m4a|webm|ogg)$/.test(name) ||
    file.type.startsWith("audio/")
  )
    return {
      section: "listening",
      confidence: 0.65,
      reason: "Audio or transcript; confirm section",
    };
  if (/(?:answer|part[1234])/.test(name))
    return {
      section: "unknown",
      confidence: 0.2,
      reason: "Section not identified",
    };
  return { section: "unknown", confidence: 0, reason: "No section clue" };
}
