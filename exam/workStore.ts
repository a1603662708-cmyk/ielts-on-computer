"use client";
import { assertStoredSession } from "@/storage/validate-session";
import { journalWrite, journalRead, journalClear } from "@/storage/journal";
import { recoverRecordings, recordingsForExam } from "@/storage/recordings";
import { downloadFile } from "@/storage/download";
import { create } from "zustand";
import { persist, readRecord, saveRecord } from "@/storage/db";
import { clockNow, restoreClock } from "@/exam/clock";
import type { Mode, WritingPaper, SpeakingPaper } from "@/types/exam";
export type Recording = {
  id: string;
  question: string;
  part: number;
  asset: string;
  startedAt: number;
  duration: number;
  interrupted?: boolean;
};
type WorkBase = {
  id: string;
  libraryId: string;
  book: string;
  testNumber: number;
  mode: Mode;
  startedAt: number;
  lastSeen: number;
  endsAt: number;
  pausedAt?: number;
  untimed: boolean;
  mockRunId?: string;
  finished: boolean;
  completedAt?: number;
  incident?: string;
};
export type WritingSession = WorkBase & {
  kind: "writing";
  paper: WritingPaper;
  essays: [string, string];
  activeTask: 0 | 1;
};
export type SpeakingSession = WorkBase & {
  kind: "speaking";
  paper: SpeakingPaper;
  stage: "part1" | "prep" | "part2" | "part3" | "done";
  questionIndex: number;
  notes: string;
  recordings: Recording[];
  recordingStartedAt?: number;
  recordingId?: string;
};
export type WorkSession = WritingSession | SpeakingSession;
type Options = Pick<WorkBase, "libraryId" | "book" | "testNumber" | "mode"> &
  Partial<Pick<WorkBase, "mockRunId" | "untimed">>;
export const useWorkStore = create<{
  hydrated: boolean;
  session: WorkSession | null;
  startWriting: (paper: WritingPaper, options: Options) => void;
  startSpeaking: (paper: SpeakingPaper, options: Options) => void;
  update: (patch: Partial<WorkSession>) => void;
  finish: () => Promise<void>;
  pause: () => void;
}>((set, get) => ({
  hydrated: false,
  session: null,
  startWriting: (paper, options) => {
    const now = clockNow();
    const session: WritingSession = {
      id: crypto.randomUUID(),
      kind: "writing",
      paper,
      essays: ["", ""],
      activeTask: 0,
      startedAt: now,
      lastSeen: now,
      endsAt:
        now + (options.mode === "mock" ? 3600 : paper.durationSeconds) * 1000,
      finished: false,
      untimed: false,
      ...options,
    };
    journalWrite("work.session", session);
    persist("work.session", session);
    set({ session, hydrated: true });
  },
  startSpeaking: (paper, options) => {
    const now = clockNow();
    const session: SpeakingSession = {
      id: crypto.randomUUID(),
      kind: "speaking",
      paper,
      stage: "part1",
      questionIndex: 0,
      notes: "",
      recordings: [],
      startedAt: now,
      lastSeen: now,
      endsAt: now + 300000,
      finished: false,
      untimed: false,
      ...options,
    };
    journalWrite("work.session", session);
    persist("work.session", session);
    set({ session, hydrated: true });
  },
  update: (patch) => {
    const current = get().session;
    if (!current || current.finished) return;
    const session = { ...current, ...patch } as WorkSession;
    journalWrite("work.session", session);
    persist("work.session", session);
    set({ session });
  },
  finish: async () => {
    const current = get().session;
    if (!current || current.finished || finishing) return;
    finishing = true;
    try {
      const session = { ...current, finished: true, completedAt: clockNow() };
      await saveRecord(`history:${session.id}`, {
        id: session.id,
        section: session.kind,
        date: Date.now(),
        work: session,
      });
      await saveRecord("work.session", session);
      journalClear("work.session");
      set({ session });
    } finally {
      finishing = false;
    }
  },
  pause: () => {
    const s = get().session;
    if (!s || s.mode !== "practice") return;
    get().update(
      s.pausedAt
        ? { endsAt: s.endsAt + clockNow() - s.pausedAt, pausedAt: undefined }
        : { pausedAt: clockNow() },
    );
  },
}));
let finishing = false;
let hydration: Promise<void> | undefined;
export function hydrateWork() {
  return (hydration ??= (async () => {
    await recoverRecordings();
    const session =
      journalRead<WorkSession>("work.session") ??
      (await readRecord<WorkSession>("work.session"));
    if (session) assertStoredSession(session, "work");
    if (session?.kind === "speaking") {
      const recordings = await recordingsForExam(session.id);
      for (const r of recordings) {
        if (r.lastSequence < 0) continue;
        const entry: Recording = {
          id: r.sessionId,
          question: r.question,
          part: r.part,
          asset: "recording:" + r.sessionId,
          startedAt: r.startedAt,
          duration: r.duration,
          interrupted: r.status === "interrupted",
        };
        session.recordings = [
          ...session.recordings.filter((e) => e.id !== r.sessionId),
          entry,
        ];
      }
      session.recordings.sort((a, b) => a.startedAt - b.startedAt);
      session.recordingStartedAt = undefined;
      session.recordingId = undefined;
      if (!session.finished) journalWrite("work.session", session);
      await saveRecord("work.session", session);
    }

    if (session && !session.finished) {
      if (restoreClock(session.lastSeen) && session.mode === "mock") {
        session.endsAt = clockNow();
        session.incident = "Clock rollback detected.";
      }
    }
    useWorkStore.setState({ hydrated: true, session: session ?? null });
  })());
}
export function wordCount(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
export function exportEssay(session: WritingSession, format: "txt" | "md") {
  const content = session.essays
    .map(
      (essay, i) =>
        `${format === "md" ? "## " : ""}Task ${i + 1}\n\n${essay}\n\nWords: ${wordCount(essay)}`,
    )
    .join("\n\n");
  void downloadFile(
    new Blob([content], {
      type: format === "md" ? "text/markdown" : "text/plain",
    }),
    `${session.paper.title.replace(/[^a-z0-9-]/gi, "_")}.${format}`,
  ).catch((e) => window.alert(`Export failed: ${String(e)}`));
}
