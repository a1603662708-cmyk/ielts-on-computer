"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Passage as PassageData } from "@/lib/schema";
import { NO_HIGHLIGHTS, NO_NOTES, useTestStore } from "@/lib/store";
import {
  annotationsAt,
  clearSelection,
  coverageSet,
  readSelection,
  tokenize,
  type SelectionRange,
} from "@/lib/words";

type Toolbar =
  | { mode: "select"; range: SelectionRange }
  | { mode: "existing"; index: number; x: number; y: number };

/**
 * The reading passage, with highlighting and notes (video 3:12–4:16).
 *
 * Text is tokenised into word spans carrying a stable global index, so an
 * annotation is an integer range rather than a live DOM Range. Rendering is
 * then pure derived state and survives re-renders, contrast changes and
 * text-size changes untouched.
 */
export function Passage({
  passage,
  onOpenNote,
}: {
  passage: PassageData;
  onOpenNote: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);

  const allHighlights = useTestStore(
    (s) => s.session?.highlights ?? NO_HIGHLIGHTS,
  );
  const allNotes = useTestStore((s) => s.session?.notes ?? NO_NOTES);
  const part = useTestStore((s) => s.session?.activePart ?? 1);
  const highlights = useMemo(
    () => allHighlights.filter((a) => (a.part ?? 1) === part),
    [allHighlights, part],
  );
  const notes = useMemo(
    () => allNotes.filter((a) => (a.part ?? 1) === part),
    [allNotes, part],
  );
  const addHighlightRange = useTestStore((s) => s.addHighlightRange);
  const dropHighlightAt = useTestStore((s) => s.dropHighlightAt);
  const addNoteRange = useTestStore((s) => s.addNoteRange);

  const { paragraphs } = useMemo(() => tokenize(passage.paragraphs), [passage]);
  const highlighted = useMemo(() => coverageSet(highlights), [highlights]);
  const noted = useMemo(() => coverageSet(notes), [notes]);

  const closeToolbar = useCallback(() => setToolbar(null), []);

  // A new selection anywhere in the passage opens the Highlight / Note bar.
  const onMouseUp = useCallback(() => {
    const range = readSelection(containerRef.current);
    if (range) setToolbar({ mode: "select", range });
  }, []);

  // Clicking an existing annotation opens the delete / open-note bar.
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest?.("[data-w]");
      if (!target) return;
      const index = Number(target.getAttribute("data-w"));
      if (!Number.isFinite(index)) return;
      if (!highlighted.has(index) && !noted.has(index)) return;
      if (!window.getSelection()?.isCollapsed) return;

      const rect = target.getBoundingClientRect();
      setToolbar({
        mode: "existing",
        index,
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    },
    [highlighted, noted],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeToolbar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeToolbar]);

  const notesHere =
    toolbar?.mode === "existing" ? annotationsAt(notes, toolbar.index) : [];
  const hlHere = toolbar?.mode === "existing" && highlighted.has(toolbar.index);

  return (
    <div
      className="relative h-full overflow-y-auto px-6 py-5"
      data-passage-scroll
    >
      <header className="mb-5">
        <h2 className="text-xl font-bold">{passage.title}</h2>
        {passage.subtitle && (
          <p className="mt-2 font-semibold italic leading-relaxed">
            {passage.subtitle}
          </p>
        )}
      </header>

      <div
        ref={containerRef}
        onMouseUp={onMouseUp}
        onClick={onClick}
        className="passage-body space-y-4 leading-relaxed"
      >
        {paragraphs.map((para, i) => (
          <p key={i} className="flex">
            {para.label && (
              <span
                className="mr-3 min-w-[1.25rem] shrink-0 font-bold"
                aria-hidden
              >
                {para.label}
              </span>
            )}
            <span>
              {para.tokens.map((token, j) => {
                if (token.space) {
                  // Carry the annotation across the gap when both neighbouring
                  // words are covered, so a highlight reads as one continuous
                  // band rather than a row of separate blocks.
                  const prev = para.tokens[j - 1];
                  const next = para.tokens[j + 1];
                  const spans = (set: Set<number>) =>
                    prev !== undefined &&
                    next !== undefined &&
                    !prev.space &&
                    !next.space &&
                    set.has(prev.index) &&
                    set.has(next.index);

                  return (
                    <span
                      key={j}
                      className={`${spans(highlighted) ? "w-hl" : ""} ${
                        spans(noted) ? "w-note" : ""
                      }`}
                    >
                      {token.text}
                    </span>
                  );
                }

                return (
                  <span
                    key={j}
                    data-w={token.index}
                    className={`${highlighted.has(token.index) ? "w-hl" : ""} ${
                      noted.has(token.index) ? "w-note" : ""
                    }`}
                  >
                    {token.text}
                  </span>
                );
              })}
            </span>
          </p>
        ))}
      </div>

      {toolbar?.mode === "select" && (
        <FloatingBar
          x={toolbar.range.rect.left + toolbar.range.rect.width / 2}
          y={toolbar.range.rect.top}
        >
          <BarButton
            onClick={() => {
              addHighlightRange(toolbar.range.start, toolbar.range.end);
              clearSelection();
              closeToolbar();
            }}
          >
            Highlight
          </BarButton>
          <BarButton
            onClick={() => {
              const id = addNoteRange(toolbar.range.start, toolbar.range.end);
              clearSelection();
              closeToolbar();
              onOpenNote(id);
            }}
          >
            Note
          </BarButton>
        </FloatingBar>
      )}

      {toolbar?.mode === "existing" && (
        <FloatingBar x={toolbar.x} y={toolbar.y}>
          {hlHere && (
            <BarButton
              onClick={() => {
                dropHighlightAt(toolbar.index);
                closeToolbar();
              }}
            >
              Delete Highlight
            </BarButton>
          )}
          {notesHere.map((note, i) => (
            <BarButton
              key={note.id}
              onClick={() => {
                closeToolbar();
                onOpenNote(note.id);
              }}
            >
              {notesHere.length > 1 ? `Note ${i + 1}` : "Open Note"}
            </BarButton>
          ))}
        </FloatingBar>
      )}
    </div>
  );
}

/**
 * Positioned with `fixed` against the viewport, because the selection rect
 * comes from `getBoundingClientRect` and the passage pane scrolls.
 */
function FloatingBar({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed z-50 flex -translate-x-1/2 -translate-y-full gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] p-1 shadow-xl"
      style={{ left: x, top: Math.max(y - 8, 8) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

function BarButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap rounded px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-panel)]"
    >
      {children}
    </button>
  );
}
