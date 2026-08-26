"use client";

import { create } from "zustand";
import type { AnswerKey, Test } from "./schema";
import type { Annotation, Note } from "./words";
import type { ResponseMap, ScoreReport } from "./scoring";
import { score } from "./scoring";

export type Contrast = "bw" | "wb" | "yb";
export type TextSize = "regular" | "large" | "xlarge";

export type Phase = "idle" | "running" | "finished";

type Session = {
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

  start: (test: Test, key: AnswerKey) => void;
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

type Prefs = { contrast: Contrast; textSize: TextSize; splitRatio: number };

function loadPrefs(): Prefs {
  const fallback: Prefs = { contrast: "bw", textSize: "regular", splitRatio: 0.5 };
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

/**
 * The session is mirrored to sessionStorage so an accidental refresh mid-test
 * doesn't lose answers. It is not a saved-test library: it clears on submit
 * and never outlives the tab.
 */
function saveSession(session: Session | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session === null) window.sessionStorage.removeItem(SESSION_KEY);
    else window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* over quota or disabled — the in-memory session still works */
  }
}

export function loadStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed.endsAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Mutates the session in place and persists, keeping the two in step. */
function withSession(
  state: State,
  update: (s: Session) => Session,
): Partial<State> {
  if (!state.session) return {};
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

  start: (test, key) => {
    const session: Session = {
      test,
      key,
      endsAt: Date.now() + test.durationSeconds * 1000,
      responses: {},
      flagged: [],
      highlights: [],
      notes: [],
      activePart: test.parts[0]?.part ?? 1,
      audioPart: test.type === "listening" ? (test.audio?.[0]?.part ?? -1) : -1,
      volume: 0.8,
    };
    saveSession(session);
    set({ phase: "running", session, report: null, endedBy: null });
  },

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

  setActivePart: (part) => set((state) => withSession(state, (s) => ({ ...s, activePart: part }))),
  setAudioPart: (part) => set((state) => withSession(state, (s) => ({ ...s, audioPart: part }))),
  setVolume: (v) => set((state) => withSession(state, (s) => ({ ...s, volume: v }))),

  addHighlightRange: (start, end) =>
    set((state) =>
      withSession(state, (s) => {
        // Merge with any highlight this one touches, so adjacent runs coalesce.
        let lo = start;
        let hi = end;
        const kept = s.highlights.filter((a) => {
          if (a.start <= end + 1 && start <= a.end + 1) {
            lo = Math.min(lo, a.start);
            hi = Math.max(hi, a.end);
            return false;
          }
          return true;
        });
        return {
          ...s,
          highlights: [...kept, { id: `hl-${lo}-${hi}-${Date.now()}`, start: lo, end: hi }].sort(
            (x, y) => x.start - y.start,
          ),
        };
      }),
    ),

  dropHighlightAt: (index) =>
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        highlights: s.highlights.filter((a) => index < a.start || index > a.end),
      })),
    ),

  addNoteRange: (start, end) => {
    const id = `note-${start}-${end}-${Date.now()}`;
    set((state) =>
      withSession(state, (s) => ({
        ...s,
        notes: [...s.notes, { id, start, end, text: "" }].sort((a, b) => a.start - b.start),
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
      withSession(state, (s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })),
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
    const { session } = get();
    if (!session) return;
    const report = score(session.test, session.key, session.responses);
    saveSession(null);
    set({ phase: "finished", report, endedBy: reason });
  },

  reset: () => {
    saveSession(null);
    set({ phase: "idle", session: null, report: null, endedBy: null });
  },
}));

function prefsOf(s: State): Prefs {
  return { contrast: s.contrast, textSize: s.textSize, splitRatio: s.splitRatio };
}

/**
 * Applies stored preferences and recovers an interrupted run. Called once from
 * the root layout — never during render, to keep hydration deterministic.
 */
export function hydrateStore(): void {
  const prefs = loadPrefs();
  const stored = loadStoredSession();
  useTestStore.setState({
    ...prefs,
    hydrated: true,
    ...(stored ? { phase: "running" as const, session: stored } : {}),
  });
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
export const NO_AUDIO = Object.freeze([]) as unknown as NonNullable<Test["audio"]>;
