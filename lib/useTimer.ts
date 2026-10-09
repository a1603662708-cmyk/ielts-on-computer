"use client";

import { clockNow } from "@/exam/clock";
import { useEffect, useRef, useState } from "react";

/**
 * Counts down to a wall-clock deadline rather than decrementing a counter, so
 * the timer stays accurate when the tab is throttled or the machine sleeps.
 * Fires `onExpire` exactly once.
 */
export function useCountdown(
  endsAt: number | null,
  onExpire?: () => void,
): number {
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);
  const [remaining, setRemaining] = useState(() =>
    endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - clockNow()) / 1000)),
  );

  useEffect(() => {
    if (endsAt === null) return;

    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - clockNow()) / 1000));
      setRemaining(left);
      if (left === 0 && !fired) {
        fired = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    // A tab restored from the background can be many seconds stale.
    const onVisible = () => tick();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `onExpire` is intentionally not a dependency: re-running would restart
    // the interval on every parent render and could fire the callback twice.
  }, [endsAt]);

  return remaining;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Long form for announcements and the results page. */
export function formatDuration(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} hour${h > 1 ? "s" : ""}` : `${h}h ${rest}m`;
}
