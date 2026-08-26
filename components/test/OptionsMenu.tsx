"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTestStore, type Contrast, type TextSize } from "@/lib/store";

const CONTRASTS: { value: Contrast; label: string }[] = [
  { value: "bw", label: "Black on white" },
  { value: "wb", label: "White on black" },
  { value: "yb", label: "Yellow on black" },
];

const SIZES: { value: TextSize; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

type Panel = "root" | "contrast" | "textsize";

/**
 * The options menu from video 1:44–2:38 and 2:57. Available for the whole
 * test, with Contrast, Text Size and Test Instructions.
 *
 * "Submit test" is an addition for practice — the real exam has no such
 * control and only ends when the clock runs out.
 */
export function OptionsMenu({
  onShowInstructions,
  onSubmit,
}: {
  onShowInstructions: () => void;
  onSubmit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");
  const ref = useRef<HTMLDivElement>(null);

  const contrast = useTestStore((s) => s.contrast);
  const textSize = useTestStore((s) => s.textSize);
  const setContrast = useTestStore((s) => s.setContrast);
  const setTextSize = useTestStore((s) => s.setTextSize);

  // Closing always returns the menu to its root, so the next open is
  // predictable. Doing it here rather than in an effect keeps the two pieces
  // of state in step without a reconciliation pass.
  const close = useCallback(() => {
    setOpen(false);
    setPanel("root");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Options"
        className="flex items-center gap-2 rounded border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
          {[3, 8, 13].map((y) => (
            <rect key={y} x="1" y={y - 1} width="14" height="2" fill="currentColor" rx="1" />
          ))}
        </svg>
        Options
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] p-1.5 shadow-lg"
        >
          {panel === "root" && (
            <>
              <MenuItem onClick={() => setPanel("contrast")}>
                Contrast <Chevron />
              </MenuItem>
              <MenuItem onClick={() => setPanel("textsize")}>
                Text Size <Chevron />
              </MenuItem>
              <MenuItem
                onClick={() => {
                  close();
                  onShowInstructions();
                }}
              >
                Test Instructions
              </MenuItem>
              <div className="my-1.5 border-t border-[var(--border)]" />
              <MenuItem
                onClick={() => {
                  close();
                  onSubmit();
                }}
                tone="accent"
              >
                Submit test
              </MenuItem>
              <p className="px-3 pb-1.5 pt-1 text-xs text-[var(--muted)]">
                Not part of the real exam — added so you can end a practice run early.
              </p>
            </>
          )}

          {panel === "contrast" && (
            <SubPanel title="Contrast" onBack={() => setPanel("root")}>
              {CONTRASTS.map((c) => (
                <MenuItem
                  key={c.value}
                  onClick={() => setContrast(c.value)}
                  selected={contrast === c.value}
                >
                  {c.label}
                </MenuItem>
              ))}
            </SubPanel>
          )}

          {panel === "textsize" && (
            <SubPanel title="Text Size" onBack={() => setPanel("root")}>
              {SIZES.map((s) => (
                <MenuItem
                  key={s.value}
                  onClick={() => setTextSize(s.value)}
                  selected={textSize === s.value}
                >
                  {s.label}
                </MenuItem>
              ))}
            </SubPanel>
          )}
        </div>
      )}
    </div>
  );
}

function SubPanel({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold"
      >
        <span aria-hidden>←</span> {title}
      </button>
      <div className="border-t border-[var(--border)] pt-1.5">{children}</div>
    </>
  );
}

function MenuItem({
  children,
  onClick,
  selected,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
  tone?: "accent";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      aria-current={selected || undefined}
      className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-[var(--bg-panel)] ${
        tone === "accent" ? "font-semibold text-[var(--accent)]" : ""
      } ${selected ? "bg-[var(--bg-panel)] font-semibold" : ""}`}
    >
      <span>{children}</span>
      {selected && <span aria-hidden>✓</span>}
    </button>
  );
}

function Chevron() {
  return (
    <span aria-hidden className="text-[var(--muted)]">
      ›
    </span>
  );
}
