"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

const noopSubscribe = () => () => {};

/**
 * Fullscreen must be requested inside a user gesture, so `enter` is called
 * straight from the Start button's click handler.
 *
 * Fullscreen state lives on `document`, not in React, so it is read through
 * `useSyncExternalStore` rather than mirrored into state via an effect.
 */
export function useFullscreen(): {
  isFullscreen: boolean;
  supported: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
} {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => document.fullscreenElement !== null,
    () => false,
  );

  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof document.documentElement.requestFullscreen === "function",
    () => true,
  );

  const enter = useCallback(async () => {
    try {
      if (document.fullscreenElement === null) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Denied by the browser or the user — the test still runs windowed.
    }
  }, []);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement !== null) await document.exitFullscreen();
    } catch {
      /* already exited */
    }
  }, []);

  return { isFullscreen, supported, enter, exit };
}
