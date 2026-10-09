"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTestStore } from "@/lib/store";

/** Passage left, questions right, with a draggable divider. */
export function SplitPane({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const ratio = useTestStore((s) => s.splitRatio);
  const setSplitRatio = useTestStore((s) => s.setSplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const apply = useCallback(
    (clientX: number) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      const next = (clientX - box.left) / box.width;
      setSplitRatio(Math.min(0.8, Math.max(0.2, next)));
    },
    [setSplitRatio],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      apply(e.clientX);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [apply]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      <div
        className="min-w-0 overflow-hidden"
        style={{ flexBasis: `${ratio * 100}%` }}
      >
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize passage and questions"
        tabIndex={0}
        onMouseDown={() => {
          dragging.current = true;
          // Suppress text selection while dragging, or the passage highlights.
          document.body.style.userSelect = "none";
          document.body.style.cursor = "col-resize";
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSplitRatio(Math.max(0.2, ratio - 0.02));
          if (e.key === "ArrowRight")
            setSplitRatio(Math.min(0.8, ratio + 0.02));
        }}
        className="group w-2 shrink-0 cursor-col-resize bg-[var(--border)] hover:bg-[var(--border-strong)]"
      >
        <div className="mx-auto h-full w-px bg-[var(--bg-panel)] opacity-60" />
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
