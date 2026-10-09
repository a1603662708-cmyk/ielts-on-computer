import { z } from "zod";
import {
  TestSchema,
  AnswerKeySchema,
  validateTestInternals,
  validateAgainstAnswers,
  testQuestionNumbers,
} from "@/lib/schema";
export const WritingSchema = z.object({
  title: z.string().min(1),
  durationSeconds: z.number().int().min(10).default(3600),
  tasks: z.tuple([
    z.object({
      prompt: z.string().min(1),
      image: z.string().optional(),
      minWords: z.number().default(150),
    }),
    z.object({
      prompt: z.string().min(1),
      image: z.string().optional(),
      minWords: z.number().default(250),
    }),
  ]),
});
export const SpeakingSchema = z.object({
  title: z.string().min(1),
  part1: z.array(z.string().min(1)).min(1),
  cueCard: z.string().min(1),
  part3: z.array(z.string().min(1)).min(1),
});
const ObjectiveSchema = z.object({ paper: TestSchema, key: AnswerKeySchema });
export const LibrarySchema = z.object({
  formatVersion: z.literal(2),
  id: z.string().min(1),
  book: z.string().min(1),
  test: z.number().int().positive(),
  module: z.literal("Academic"),
  title: z.string().min(1),
  createdAt: z.number(),
  sections: z.object({
    listening: ObjectiveSchema.optional(),
    reading: ObjectiveSchema.optional(),
    writing: WritingSchema.optional(),
    speaking: SpeakingSchema.optional(),
  }),
});
export type LibraryTest = z.infer<typeof LibrarySchema>;
export type WritingPaper = z.infer<typeof WritingSchema>;
export type SpeakingPaper = z.infer<typeof SpeakingSchema>;
export type Mode = "practice" | "mock";
export type Section = "listening" | "reading" | "writing" | "speaking";
export function parseLibrary(input: unknown): LibraryTest {
  const value = LibrarySchema.parse(input);
  if (!Object.keys(value.sections).length)
    throw new Error("At least one section is required.");
  for (const type of ["reading", "listening"] as const) {
    const entry = value.sections[type];
    if (!entry) continue;
    if (entry.paper.type !== type)
      throw new Error(`${type}: paper type does not match section`);
    const errors = [
      ...validateTestInternals(entry.paper),
      ...validateAgainstAnswers(entry.paper, entry.key),
    ].filter((i) => i.level === "error");
    const missing = testQuestionNumbers(entry.paper).filter(
      (n) => !entry.key.answers[n],
    );
    if (missing.length)
      throw new Error(
        `${type}: missing answers for ${missing.join(", ")}. Complete the key before saving or starting a scored test.`,
      );
    if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
  }
  return value;
}
export interface WritingEvaluationProvider {
  evaluate(
    paper: WritingPaper,
    essays: [string, string],
  ): Promise<{
    feedback: string;
    estimatedBand?: number;
    label: "Estimated / Practice Feedback";
  }>;
}
export interface SpeakingEvaluationProvider {
  evaluate(recordings: Blob[]): Promise<{
    feedback: string;
    estimatedBand?: number;
    label: "Estimated / Practice Feedback";
  }>;
}
