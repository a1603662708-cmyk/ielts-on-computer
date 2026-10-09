"use client";
import { useMemo, useRef, useState } from "react";
import {
  tokenize,
  readSelection,
  coverageSet,
  clearSelection,
  type SelectionRange,
} from "@/lib/words";
import { NO_HIGHLIGHTS, NO_NOTES, useTestStore } from "@/lib/store";
import { useNotePanel } from "@/lib/annotationUI";
// Stable disjoint word ranges for question text; passage ranges start at zero.
function baseFor(scope: string, text: string) {
  let h = 2166136261;
  for (const c of `${scope}:${text}`)
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return 100000 + (h >>> 0) * 10000;
}
export function AnnotatedText({
  text,
  scope,
}: {
  text: string;
  scope: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [range, setRange] = useState<SelectionRange | null>(null);
  const part = useTestStore((s) => s.session?.activePart ?? 1);
  const highlights = useTestStore(
    (s) => s.session?.highlights ?? NO_HIGHLIGHTS,
  );
  const notes = useTestStore((s) => s.session?.notes ?? NO_NOTES);
  const base = useMemo(() => baseFor(scope, text), [scope, text]);
  const tokens = useMemo(
    () => tokenize([{ text }]).paragraphs[0].tokens,
    [text],
  );
  const covered = useMemo(
    () => coverageSet(highlights.filter((h) => (h.part ?? 1) === part)),
    [highlights, part],
  );
  const noted = useMemo(
    () => coverageSet(notes.filter((n) => (n.part ?? 1) === part)),
    [notes, part],
  );
  return (
    <span
      ref={ref}
      onMouseUp={() => {
        const selection = readSelection(ref.current);
        if (selection) setRange(selection);
      }}
    >
      {tokens.map((t, i) =>
        t.space ? (
          <span key={i}>{t.text}</span>
        ) : (
          <span
            key={i}
            data-w={base + t.index}
            className={`${covered.has(base + t.index) ? "w-hl" : ""} ${noted.has(base + t.index) ? "w-note" : ""}`}
            onClick={() => {
              if (!window.getSelection()?.isCollapsed) return;
              const note = notes.find(
                (n) =>
                  (n.part ?? 1) === part &&
                  n.start <= base + t.index &&
                  n.end >= base + t.index,
              );
              if (note) useNotePanel.getState().open(note.id);
              else if (covered.has(base + t.index))
                useTestStore.getState().dropHighlightAt(base + t.index);
            }}
          >
            {t.text}
          </span>
        ),
      )}
      {range && (
        <span
          className="fixed z-50 flex gap-1 border bg-[var(--bg-raised)] p-1 shadow-lg"
          style={{
            left: Math.max(
              4,
              Math.min(range.rect.left, window.innerWidth - 240),
            ),
            top: Math.max(4, range.rect.top - 42),
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            className="px-3 py-1"
            onClick={() => {
              useTestStore.getState().addHighlightRange(range.start, range.end);
              clearSelection();
              setRange(null);
            }}
          >
            Highlight
          </button>
          <button
            className="px-3 py-1"
            onClick={() => {
              const id = useTestStore
                .getState()
                .addNoteRange(range.start, range.end);
              useNotePanel.getState().open(id);
              clearSelection();
              setRange(null);
            }}
          >
            Note
          </button>
          <button
            aria-label="Close annotation toolbar"
            onClick={() => setRange(null)}
          >
            ×
          </button>
        </span>
      )}
    </span>
  );
}
