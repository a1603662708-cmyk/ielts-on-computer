"use client";

import { useId, useRef, useState } from "react";

type Props = {
  label: string;
  hint: string;
  filename: string | null;
  status: "empty" | "ok" | "error";
  onText: (text: string, filename: string) => void;
};

/**
 * A drop zone that also accepts a click-to-browse and pasted JSON, so a test
 * can be loaded without leaving the keyboard.
 */
export function FileDrop({ label, hint, filename, status, onText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const pasteId = useId();

  async function take(file: File) {
    onText(await file.text(), file.name);
  }

  const border =
    status === "error"
      ? "border-[var(--incorrect)]"
      : status === "ok"
        ? "border-[var(--correct)]"
        : dragging
          ? "border-[var(--border-strong)]"
          : "border-[var(--border)]";

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void take(file);
        }}
        className={`rounded-lg border-2 border-dashed ${border} bg-[var(--bg-panel)] p-5 transition-colors`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold">{label}</p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{hint}</p>
            {filename && (
              <p className="mt-2 truncate text-sm">
                <span aria-hidden>{status === "error" ? "✕" : "✓"}</span>{" "}
                <span className="font-mono">{filename}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded border border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium"
            >
              Choose file
            </button>
            <button
              type="button"
              onClick={() => setPasting((p) => !p)}
              className="rounded px-3 py-1.5 text-sm text-[var(--muted)] underline"
            >
              {pasting ? "Cancel" : "Paste JSON"}
            </button>
          </div>
        </div>

        {pasting && (
          <div className="mt-4">
            <label htmlFor={pasteId} className="sr-only">
              Paste {label} JSON
            </label>
            <textarea
              id={pasteId}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder='{ "formatVersion": 1, … }'
              className="w-full rounded p-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => {
                if (!pasted.trim()) return;
                onText(pasted, "pasted JSON");
                setPasting(false);
              }}
              className="mt-2 rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-fg)]"
            >
              Use this
            </button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void take(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
