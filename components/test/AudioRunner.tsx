"use client";

import { useEffect, useRef, useState } from "react";
import type { Test } from "@/lib/schema";
import { useTestStore } from "@/lib/store";

/**
 * Plays the listening recordings back to back (video 2:46 for the volume
 * control). There is deliberately no play, pause, seek or replay: the only
 * exposed control is volume, exactly as in the real test.
 *
 * The next part is preloaded in a second element while the current one plays,
 * so the switch between parts has no audible gap.
 */
export function AudioRunner({ test }: { test: Test }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);

  const volume = useTestStore((s) => s.session?.volume ?? 0.8);
  const setAudioPart = useTestStore((s) => s.setAudioPart);
  const setActivePart = useTestStore((s) => s.setActivePart);

  const tracks = test.audio ?? [];
  const [index, setIndex] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const current = tracks[index];

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !current) return;

    el.src = current.url;
    el.volume = volume;
    setAudioPart(current.part);

    void el.play().then(
      () => setBlocked(false),
      // Autoplay policy can still refuse if the gesture chain was broken by a
      // refresh. Surface a one-click resume rather than failing silently.
      () => setBlocked(true),
    );

    // Warm the next track so the handover is seamless.
    const next = tracks[index + 1];
    if (next) {
      const warm = new Audio();
      warm.preload = "auto";
      warm.src = next.url;
      warm.load();
      preloadRef.current = warm;
    }

    return () => {
      preloadRef.current?.pause();
      preloadRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  function onEnded() {
    if (index + 1 < tracks.length) {
      const next = tracks[index + 1];
      setIndex(index + 1);
      // Follow the recording to the matching part, as the real test does.
      setActivePart(next.part);
    } else {
      setAudioPart(-1);
    }
  }

  if (tracks.length === 0) return null;

  return (
    <>
      <audio
        ref={audioRef}
        onEnded={onEnded}
        // If a recording errors mid-test, move on rather than stalling the run.
        onError={onEnded}
        preload="auto"
      />
      {blocked && (
        <button
          type="button"
          onClick={() => void audioRef.current?.play().then(() => setBlocked(false))}
          className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-fg)]"
        >
          Resume audio
        </button>
      )}
    </>
  );
}

/** Volume control, bottom right of the screen (video 2:46). */
export function VolumeControl() {
  const volume = useTestStore((s) => s.session?.volume ?? 0.8);
  const audioPart = useTestStore((s) => s.session?.audioPart ?? -1);
  const setVolume = useTestStore((s) => s.setVolume);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-raised)] px-3 py-2 shadow-lg">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {audioPart > 0 ? `Part ${audioPart}` : "Audio ended"}
      </span>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
        <path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor" />
        <path
          d="M11 5.5a3.5 3.5 0 010 5M12.8 3.5a6 6 0 010 9"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="w-28"
      />
    </div>
  );
}
