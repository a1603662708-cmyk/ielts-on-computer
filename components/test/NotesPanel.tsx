"use client";

import { useEffect, useRef, useState } from "react";
import { NO_NOTES, useTestStore } from "@/lib/store";

/**
 * The notes panel (video 3:37–4:16): opens beside the passage, autosaves as
 * you type, closes with the cross, and deletes behind a two-step confirm.
 */
export function NotesPanel({
  openId,
  onClose,
  onSelect,
}: {
  openId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const notes = useTestStore((s) => s.session?.notes ?? NO_NOTES);
  const editNote = useTestStore((s) => s.editNote);
  const dropNote = useTestStore((s) => s.dropNote);

  // Tracking *which* note is pending deletion means switching notes clears the
  // confirm step without an effect resetting state.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const note = notes.find((n) => n.id === openId) ?? null;
  const confirming = confirmingId !== null && confirmingId === openId;

  useEffect(() => {
    if (openId !== null) textareaRef.current?.focus();
  }, [openId]);

  // A note deleted from the passage side shouldn't leave an empty panel open.
  useEffect(() => {
    if (openId !== null && note === null) onClose();
  }, [openId, note, onClose]);

  if (openId === null) return null;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--border-strong)] bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <h2 className="font-bold">Notes</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide notes"
          className="rounded px-2 py-0.5 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {notes.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-[var(--border)] px-3 py-2">
          {notes.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect(n.id)}
              className={`rounded px-2 py-1 text-xs font-semibold ${
                n.id === openId
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "border border-[var(--border)]"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {note && (
        <>
          <textarea
            ref={textareaRef}
            value={note.text}
            onChange={(e) => editNote(note.id, e.target.value)}
            placeholder="Write your notes here. They save automatically."
            className="min-h-0 flex-1 resize-none p-3 text-sm leading-relaxed"
          />
          <div className="border-t border-[var(--border)] p-3">
            {confirming ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    dropNote(note.id);
                    setConfirmingId(null);
                  }}
                  className="flex-1 rounded bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)]"
                >
                  Confirm deleting
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="rounded border border-[var(--border-strong)] px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(note.id)}
                className="w-full rounded border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold"
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

/** Header button that reopens the notes panel (video 4:06). */
export function NotesButton({ onClick }: { onClick: () => void }) {
  const count = useTestStore((s) => s.session?.notes.length ?? 0);
  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Show notes"
      className="flex items-center gap-1.5 rounded border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
        <rect
          x="2.5"
          y="1.5"
          width="11"
          height="13"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        {[5, 8, 11].map((y) => (
          <path key={y} d={`M5 ${y}h6`} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        ))}
      </svg>
      Notes ({count})
    </button>
  );
}
