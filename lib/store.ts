"use client";

import { assertStoredSession } from "@/storage/validate-session";
import { journalWrite, journalRead, journalClear } from "@/storage/journal";
import { persist, readRecord, saveRecord } from "@/storage/db";
import { clockNow, restoreClock } from "@/exam/clock";
import type { Mode } from "@/types/exam";
import { create } from "zustand";
import type { AnswerKey, Test } from "./schema";
import type { Annotation, Note } from "./words";
import type { ResponseMap, ScoreReport } from "./scoring";
import { score } from "./scoring";

export type Contrast = "bw" | "wb" | "yb";
export type TextSize = "regular" | "large" | "xlarge";

export type Phase = "idle" | "running" | "finished";

export type Session = {
  id: string;
  libraryId?: string;
  book?: string;
  testNumber?: number;
  mockRunId?: string;
  mode: Mode;
  startedAt: number;
  lastSeen: number;
  currentQuestion: number;
  pausedAt?: number;
  untimed: boolean;
  audioIndex: number;
  audioOffset: number;
  incident?: string;
  test: Test;
  key: AnswerKey;
  /** Wall-clock ms at which the test ends. Survives tab throttling. */
  endsAt: number;
  responses: ResponseMap;
  flagged: number[];
  highlights: Annotation[];
  notes: Note[];
  activePart: number;
  /** Which listening part is currently playing; -1 once audio has finished. */
  audioPart: number;
  volume: number;
};

type State = {
  /**
   * False until stored preferences and any interrupted session have been read
   * back. Screens must not act on `phase` before this flips, or a mid-test
   * refresh redirects home before the session is recovered.
   */
  hydrated: boolean;
  phase: Phase;
  session: Session | null;
  report: ScoreReport | null;
  /** How the test ended — shown on the results page. */
  endedBy: "time" | "manual" | null;
  contrast: Contrast;
  textSize: TextSize;
  splitRatio: number;

  start: (
    test: Test,
    key: AnswerKey,
    options?: Partial<
      Pick<
        Session,
        "libraryId" | "book" | "testNumber" | "mockRunId" | "mode" | "untimed"
      >
    >,
  ) => void;
  setCurrentQuestion: (n: number) => void;
  audioProgress: (index: number, offset: number) => void;
  togglePause: () => void;
  checkpoint: () => void;
  answer: (n: number, value: string | string[] | undefined) => void;
  toggleFlag: (n: number) => void;
  setActivePart: (part: number) => void;
  setAudioPart: (part: number) => void;
  setVolume: (v: number) => void;

  addHighlightRange: (start: number, end: number) => void;
  dropHighlightAt: (index: number) => void;
  addNoteRange: (start: number, end: number) => string;
  editNote: (id: string, text: string) => void;
  dropNote: (id: string) => void;

  setContrast: (c: Contrast) => void;
  setTextSize: (t: TextSize) => void;
  setSplitRatio: (r: number) => void;

  submit: (reason: "time" | "manual") => void;
  reset: () => void;
};

const PREFS_KEY = "ielts.prefs";
const SESSION_KEY = "ielts.session";

type Prefs = {
  contrast: Contrast;
  textSize: TextSize;
  splitRatio: number;
  volume: number;
};

function loadPrefs(): Prefs {
  const fallback: Prefs = {
    contrast: "bw",
    textSize: "regular",
    splitRatio: 0.5,
    volume: 0.8,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function savePrefs(p: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage disabled — preferences just won't persist */
  }
}

function saveSession(session: Session | null): void {
  if (session) journalWrite(SESSION_KEY, session);
  else journalClear(SESSION_KEY);
  persist(SESSION_KEY, session);
}
export async function loadStoredSession(): Promise<Session | null> {
  return (
    journalRead<Session>(SESSION_KEY) ??
    (await readRecord<Session | null>(SESSION_KEY)) ??
    null
  );
}

/** Mutates the session in place and persists, keeping the two in step. */
function withSession(
  state: State,
  update: (s: Session) => Session,
): Partial<State> {
  if (!state.session || state.phase !== "running") return {};
  const next = update(state.session);
  saveSession(next);
  return { session: next };
}

export const useTestStore = create<State>((set, get) => ({
  hydrated: false,
  phase: "idle",
  session: null,
  report: null,
  endedBy: null,
  contrast: "bw",
  textSize: "regular",
  splitRatio: 0.5,

  start: (test, key, options = {}) => {
    const session: Session = {
      id: crypto.randomUUID(),
      mode: "mock",
      startedAt: clockNow(),
      lastSeen: clockNow(),
      currentQuestion: test.parts[0]?.groups[0]
        ? test.parts[0].groups[0].type === "mcq-multi"
          ? test.parts[0].groups[0].range[0]
          : test.parts[0].groups[0].questions[0].n
        : 1,
      untimed: false,
      audioIndex: 0,
      audioOffset: 0,
      ...options,
      test,
      key,
      endsAt: clockNow() + test.durationSeconds * 1000,
      responses: {},
      flagged: [],
      highlights: [],
      notes: [],
      activePart: test.parts[0]?.part ?? 1,
      audioPart: test.type === "listening" ? (test.audio?.[0]?.part ?? -1) : -1,
      volume: loadPrefs().volume ?? 0.8,
    };
    saveSession(session);
    set({ phase: "running", session, report: null, endedBy: null });
  },

  setCurrentQuestion: (n) =>
    set((state) => withSession(state, (s) => ({ ...s, currentQuestion: n }))),
  audioProgress: (audioIndex, audioOffset) =>
    set((state) =>
      withSession(state, (s) => ({ ...s, audioIndex, audioOffset })),
    ),
  checkpoint: () =>
    set((state) =>
      state.phase === "running"
        ? withSession(state, (s) => ({ ...s, lastSeen: clockNow() }))
        : {},
    ),
  togglePause: () =>
    set((state) =>
      withSession(state, (s) =>
        s.mode !== "practice"
          ? s
          : s.pausedAt
            ? {
                ...s,
                endsAt: s.endsAt + clockNow() - s.pausedAt,
                pausedAt: undefined,
              }
            : { ...s, pausedAt: clockNow() },
      ),
    ),
  answer: (n, value) =>
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        responses: { ...s.responses, [n]: value },
      })),
    ),

  toggleFlag: (n) =>
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        flagged: s.flagged.includes(n)
          ? s.flagged.filter((x) => x !== n)
          : [...s.flagged, n].sort((a, b) => a - b),
      })),
    ),

  setActivePart: (part) =>
    set((state) => withSession(state, (s) => ({ ...s, activePart: part }))),
  setAudioPart: (part) =>
    set((state) => withSession(state, (s) => ({ ...s, audioPart: part }))),
  setVolume: (v) => {
    savePrefs({ ...prefsOf(get()), volume: v });
    set((state) => withSession(state, (s) => ({ ...s, volume: v })));
  },

  addHighlightRange: (start, end) =>
    set((state) =>
      withSession(state, (s) => {
        // Merge with any highlight this one touches, so adjacent runs coalesce.
        let lo = start;
        let hi = end;
        const kept = s.highlights.filter((a) => {
          if (
            (a.part ?? 1) === s.activePart &&
            a.start <= end + 1 &&
            start <= a.end + 1
          ) {
            lo = Math.min(lo, a.start);
            hi = Math.max(hi, a.end);
            return false;
          }
          return true;
        });
        return {
          ...s,
          highlights: [
            ...kept,
            {
              id: `hl-${lo}-${hi}-${Date.now()}`,
              start: lo,
              end: hi,
              part: s.activePart,
            },
          ].sort((x, y) => x.start - y.start),
        };
      }),
    ),

  dropHighlightAt: (index) =>
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        highlights: s.highlights.filter(
          (a) =>
            (a.part ?? 1) !== s.activePart || index < a.start || index > a.end,
        ),
      })),
    ),

  addNoteRange: (start, end) => {
    const id = `note-${start}-${end}-${Date.now()}`;
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        notes: [
          ...s.notes,
          { id, start, end, text: "", part: s.activePart },
        ].sort((a, b) => a.start - b.start),
      })),
    );
    return id;
  },

  editNote: (id, text) =>
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? { ...n, text } : n)),
      })),
    ),

  dropNote: (id) =>
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        notes: s.notes.filter((n) => n.id !== id),
      })),
    ),

  setContrast: (contrast) => {
    savePrefs({ ...prefsOf(get()), contrast });
    set({ contrast });
  },
  setTextSize: (textSize) => {
    savePrefs({ ...prefsOf(get()), textSize });
    set({ textSize });
  },
  setSplitRatio: (splitRatio) => {
    savePrefs({ ...prefsOf(get()), splitRatio });
    set({ splitRatio });
  },

  submit: (reason) => {
    const { session, phase } = get();
    if (!session || phase !== "running" || submitting) return;
    submitting = true;
    const report = score(session.test, session.key, session.responses);
    void (async () => {
      try {
        await saveRecord(`history:${session.id}`, {
          id: session.id,
          section: session.test.type,
          date: Date.now(),
          session,
          report,
          endedBy: reason,
        });
        await saveRecord("ielts.lastResult", {
          session,
          report,
          endedBy: reason,
        });
        await saveRecord(SESSION_KEY, null);
        journalClear(SESSION_KEY);
        set({ phase: "finished", report, endedBy: reason });
      } finally {
        submitting = false;
      }
    })().catch(() => {});
  },

  reset: () => {
    saveSession(null);
    set({ phase: "idle", session: null, report: null, endedBy: null });
  },
}));

function prefsOf(s: State): Prefs {
  return {
    contrast: s.contrast,
    textSize: s.textSize,
    splitRatio: s.splitRatio,
    volume: s.session?.volume ?? loadPrefs().volume,
  };
}

/**
 * Applies stored preferences and recovers an interrupted run. Called once from
 * the root layout — never during render, to keep hydration deterministic.
 */
let submitting = false;
let hydration: Promise<void> | undefined;
export function hydrateStore(): Promise<void> {
  return (hydration ??= (async () => {
    const prefs = loadPrefs();
    try {
      const stored = await loadStoredSession();
      const last = await readRecord<{
        session: Session;
        report: ScoreReport;
        endedBy: "time" | "manual";
      }>("ielts.lastResult");
      if (stored) {
        assertStoredSession(stored, "objective");
        const rollback = restoreClock(stored.lastSeen);
        if (rollback && stored.mode === "mock") {
          stored.endsAt = clockNow();
          stored.incident =
            "System clock moved backwards; Mock ended to preserve timing.";
        }
        useTestStore.setState({
          ...prefs,
          hydrated: true,
          phase: "running",
          session: stored,
        });
      } else {
        if (last) assertStoredSession(last.session, "objective");
        useTestStore.setState({
          ...prefs,
          hydrated: true,
          ...(last ? { ...last, phase: "finished" as const } : {}),
        });
      }
    } catch (error) {
      useTestStore.setState({ ...prefs, hydrated: true });
      throw error;
    }
  })());
}

/**
 * Stable empty values for selectors.
 *
 * A selector like `(s) => s.session?.notes ?? []` returns a fresh array
 * whenever the session (or the field) is absent, which zustand reads as a
 * changed value on every render — an infinite update loop. Selectors fall back
 * to these shared identities instead of a fresh literal.
 *
 * They are frozen: nothing should ever mutate them, and freezing turns a slip
 * into a throw rather than a shared-state bug.
 */
export const NO_RESPONSES = Object.freeze({}) as ResponseMap;
export const NO_FLAGS = Object.freeze([]) as unknown as number[];
export const NO_HIGHLIGHTS = Object.freeze([]) as unknown as Annotation[];
export const NO_NOTES = Object.freeze([]) as unknown as Note[];
export const NO_SELECTION = Object.freeze([]) as unknown as string[];
export const NO_AUDIO = Object.freeze([]) as unknown as NonNullable<
  Test["audio"]
>;
