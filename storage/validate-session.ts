import { z } from "zod";
import { TestSchema, AnswerKeySchema } from "@/lib/schema";
import { WritingSchema, SpeakingSchema } from "@/types/exam";
const base = {
  id: z.string(),
  mode: z.enum(["practice", "mock"]),
  startedAt: z.number().finite(),
  lastSeen: z.number().finite(),
  endsAt: z.number().finite(),
  untimed: z.boolean(),
};
const annotation = z.object({
  id: z.string(),
  start: z.number(),
  end: z.number(),
  part: z.number().optional(),
});
const objective = z.object({
  ...base,
  test: TestSchema,
  key: AnswerKeySchema,
  responses: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string()), z.undefined()]),
  ),
  flagged: z.array(z.number()),
  highlights: z.array(annotation),
  notes: z.array(annotation.extend({ text: z.string() })),
  currentQuestion: z.number(),
  activePart: z.number(),
  audioPart: z.number(),
  audioIndex: z.number(),
  audioOffset: z.number(),
  volume: z.number(),
});
const work = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("writing"),
    finished: z.boolean(),
    paper: WritingSchema,
    essays: z.tuple([z.string(), z.string()]),
    activeTask: z.union([z.literal(0), z.literal(1)]),
  }),
  z.object({
    ...base,
    kind: z.literal("speaking"),
    finished: z.boolean(),
    paper: SpeakingSchema,
    stage: z.enum(["part1", "prep", "part2", "part3", "done"]),
    questionIndex: z.number().int().nonnegative(),
    notes: z.string(),
    recordings: z.array(
      z.object({
        id: z.string(),
        question: z.string(),
        part: z.number(),
        asset: z.string(),
        startedAt: z.number(),
        duration: z.number(),
      }),
    ),
  }),
]);
export function assertStoredSession(
  value: unknown,
  kind: "objective" | "work",
) {
  const result = (kind === "objective" ? objective : work).safeParse(value);
  if (!result.success)
    throw new Error(
      "Stored exam data is invalid. Your local data has been kept. Close this window and restore a backup or contact support before starting another exam. " +
        result.error.issues.map((i) => i.path.join(".")).join(", "),
    );
}
