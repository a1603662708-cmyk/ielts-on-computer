"use client";

import { useTestStore } from "@/lib/store";

export const LETTERS = "ABCDEFGHIJKLMNOP".split("");

/** The flag control described at video 1:03–1:26. */
export function FlagButton({ n }: { n: number }) {
  const flagged = useTestStore((s) => s.session?.flagged.includes(n) ?? false);
  const toggleFlag = useTestStore((s) => s.toggleFlag);

  return (
    <button
      type="button"
      onClick={() => toggleFlag(n)}
      aria-pressed={flagged}
      title={flagged ? `Remove flag from question ${n}` : `Flag question ${n} to review later`}
      className="shrink-0 rounded p-1 leading-none"
    >
      <span className="sr-only">
        {flagged ? `Remove flag from question ${n}` : `Flag question ${n}`}
      </span>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
        <path
          d="M3.5 1v14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M3.5 2h9l-2 3 2 3h-9z"
          fill={flagged ? "var(--accent)" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Number badge + flag, wrapping a single question's controls. */
export function QuestionShell({
  n,
  prompt,
  children,
}: {
  n: number;
  prompt?: string;
  children?: React.ReactNode;
}) {
  return (
    <div id={`q-${n}`} className="scroll-mt-28 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 min-w-[1.75rem] shrink-0 text-right font-bold tabular-nums">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          {prompt && <p className="leading-relaxed">{prompt}</p>}
          {children}
        </div>
        <FlagButton n={n} />
      </div>
    </div>
  );
}

export function Instructions({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="mb-4 whitespace-pre-line border-l-4 border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 py-3 text-sm font-medium leading-relaxed">
      {text}
    </div>
  );
}

/** A short-answer input. Shared by standalone gaps and `{{n}}` placeholders. */
export function GapInput({
  n,
  inline,
  width,
}: {
  n: number;
  inline?: boolean;
  width?: string;
}) {
  const value = useTestStore((s) => {
    const v = s.session?.responses[n];
    return typeof v === "string" ? v : "";
  });
  const answer = useTestStore((s) => s.answer);

  return (
    <span className={inline ? "inline-flex items-baseline gap-1.5" : "flex items-baseline gap-2"}>
      {inline && (
        <span className="rounded bg-[var(--bg-panel)] px-1.5 font-bold tabular-nums">{n}</span>
      )}
      <input
        type="text"
        aria-label={`Answer for question ${n}`}
        value={value}
        onChange={(e) => answer(n, e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="rounded px-2 py-1"
        style={{ width: width ?? (inline ? "10rem" : "18rem") }}
      />
    </span>
  );
}

/** Radio group used by mcq, tf-ng and yn-ng. */
export function ChoiceList({
  n,
  options,
  lettered,
  compact,
}: {
  n: number;
  options: string[];
  lettered: boolean;
  compact?: boolean;
}) {
  const selected = useTestStore((s) => {
    const v = s.session?.responses[n];
    return typeof v === "string" ? v : "";
  });
  const answer = useTestStore((s) => s.answer);

  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-2 space-y-1"}>
      {options.map((option, i) => {
        const value = lettered ? LETTERS[i] : option;
        const checked = selected === value;
        return (
          <label
            key={value}
            className={`flex cursor-pointer items-start gap-2.5 rounded px-2.5 py-1.5 ${
              checked ? "bg-[var(--bg-panel)]" : ""
            } ${compact ? "border border-[var(--border)]" : ""}`}
          >
            <input
              type="radio"
              name={`q-${n}`}
              value={value}
              checked={checked}
              onChange={() => answer(n, value)}
              className="mt-1"
            />
            {lettered && <span className="font-semibold">{value}</span>}
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}
