import type { Group, Test } from "@/lib/schema";
import type { Section, LibraryTest } from "@/types/exam";
export function emptyLibrary(): LibraryTest {
  return {
    formatVersion: 2,
    id: crypto.randomUUID(),
    book: "My local papers",
    test: 1,
    module: "Academic",
    title: "Imported test",
    createdAt: Date.now(),
    sections: {},
  };
}
export function draftSection(
  source: string,
  section: Section,
): LibraryTest["sections"] {
  if (!source.trim()) throw new Error("Add or extract source text first.");
  if (section === "writing") {
    const parts = source.split(/(?:WRITING\s+)?TASK\s*2\s*:?/i);
    return {
      writing: {
        title: "Academic Writing",
        durationSeconds: 3600,
        tasks: [
          {
            prompt: parts[0]
              .replace(/(?:WRITING\s+)?TASK\s*1\s*:?/i, "")
              .trim(),
            minWords: 150,
          },
          { prompt: parts[1]?.trim() || "", minWords: 250 },
        ],
      },
    };
  }
  if (section === "speaking") {
    const chunks = source.split(/PART\s*[123]\s*:?/i).filter((s) => s.trim());
    const lines = (s: string) =>
      s
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    return {
      speaking: {
        title: "Speaking practice",
        part1: lines(chunks[0] ?? source),
        cueCard: chunks[1]?.trim() || "",
        part3: lines(chunks[2] ?? ""),
      },
    };
  }
  const lines = source.split("\n");
  const first = lines.findIndex((l) => /^\s*\d+[.)]\s+/.test(l));
  const passage = first < 0 ? source : lines.slice(0, first).join("\n");
  const groups: Group[] = [];
  let current: { n: number; prompt: string; options: string[] } | undefined;
  const commit = () => {
    if (!current) return;
    if (current.options.length >= 2)
      groups.push({ type: "mcq", questions: [current] });
    else
      groups.push({
        type: "gap",
        questionType: "unconfirmed",
        questions: [
          { n: current.n, prompt: current.prompt || "Confirm question prompt" },
        ],
      });
  };
  for (const line of lines.slice(Math.max(0, first))) {
    const q = line.match(/^\s*(\d{1,3})[.)]\s+(.*)/);
    const option = line.match(/^\s*[A-H][.)]\s+(.*)/);
    if (q) {
      commit();
      current = { n: Number(q[1]), prompt: q[2], options: [] };
    } else if (option && current) current.options.push(option[1]);
    else if (current && line.trim()) current.prompt += " " + line.trim();
  }
  commit();
  if (!groups.length)
    throw new Error(
      "No numbered questions found. Add question lines such as “1. Question text”, or edit/import structured JSON. No questions were invented.",
    );
  const paper: Test = {
    formatVersion: 1,
    title: `Imported ${section}`,
    type: section,
    durationSeconds: section === "reading" ? 3600 : 1920,
    parts: [
      {
        part: 1,
        groups,
        ...(section === "reading"
          ? {
              passage: {
                title: "Confirm passage title",
                paragraphs: [
                  {
                    text: passage.trim() || "Enter passage text before saving.",
                  },
                ],
              },
            }
          : {}),
      },
    ],
  };
  return { [section]: { paper, key: { formatVersion: 1, answers: {} } } };
}
