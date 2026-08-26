"use client";

import { useMemo } from "react";
import type { Test } from "@/lib/schema";
import { NO_FLAGS, NO_RESPONSES, useTestStore } from "@/lib/store";
import { answeredSet, navEntries } from "@/lib/progress";

/**
 * The bottom navigation bar (video 0:35–1:26): jump to any question, see an
 * underline under the ones you've answered, and spot your flags.
 */
export function NavBar({
  test,
  onGoTo,
}: {
  test: Test;
  /** Called with the target question number and its part. */
  onGoTo: (n: number, part: number) => void;
}) {
  const responses = useTestStore((s) => s.session?.responses ?? NO_RESPONSES);
  const flagged = useTestStore((s) => s.session?.flagged ?? NO_FLAGS);
  const activePart = useTestStore((s) => s.session?.activePart ?? test.parts[0].part);
  const setActivePart = useTestStore((s) => s.setActivePart);

  const entries = useMemo(() => navEntries(test), [test]);
  const answered = useMemo(() => answeredSet(test, responses), [test, responses]);
  const flags = useMemo(() => new Set(flagged), [flagged]);

  const partOrder = test.parts.map((p) => p.part);
  const index = partOrder.indexOf(activePart);
  const partLabel = test.type === "reading" ? "Passage" : "Part";

  function step(delta: number) {
    const next = partOrder[index + delta];
    if (next !== undefined) setActivePart(next);
  }

  return (
    <nav
      aria-label="Question navigation"
      className="shrink-0 border-t border-[var(--border-strong)] bg-[var(--bg-panel)]"
    >
      <div className="flex items-stretch gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={index <= 0}
          aria-label={`Previous ${partLabel.toLowerCase()}`}
          className="shrink-0 rounded border border-[var(--border-strong)] px-3 text-lg disabled:opacity-30"
        >
          ‹
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
          {test.parts.map((part) => {
            const numbers = entries.filter((e) => e.part === part.part);
            const isActive = part.part === activePart;
            return (
              <div key={part.part} className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePart(part.part)}
                  className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                    isActive
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {partLabel} {part.part}
                </button>
                <div className="flex shrink-0 gap-0.5">
                  {numbers.map(({ n }) => (
                    <NavCell
                      key={n}
                      n={n}
                      answered={answered.has(n)}
                      flagged={flags.has(n)}
                      dim={!isActive}
                      onClick={() => onGoTo(n, part.part)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => step(1)}
          disabled={index < 0 || index >= partOrder.length - 1}
          aria-label={`Next ${partLabel.toLowerCase()}`}
          className="shrink-0 rounded border border-[var(--border-strong)] px-3 text-lg disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </nav>
  );
}

function NavCell({
  n,
  answered,
  flagged,
  dim,
  onClick,
}: {
  n: number;
  answered: boolean;
  flagged: boolean;
  dim: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Question ${n}${answered ? " — answered" : ""}${flagged ? " — flagged" : ""}`}
      aria-label={`Go to question ${n}${answered ? ", answered" : ", not answered"}${
        flagged ? ", flagged" : ""
      }`}
      className={`relative h-7 w-7 rounded-sm text-xs font-semibold tabular-nums ${
        dim ? "opacity-55" : ""
      } ${flagged ? "bg-[var(--warn-bg)] text-[var(--warn-fg)]" : "bg-[var(--bg-raised)]"} border border-[var(--border)]`}
    >
      {n}
      {/* The answered underline described at video 0:55. */}
      <span
        aria-hidden
        className="absolute inset-x-1 bottom-0.5 h-[2px] rounded"
        style={{ background: answered ? "var(--answered)" : "transparent" }}
      />
    </button>
  );
}
