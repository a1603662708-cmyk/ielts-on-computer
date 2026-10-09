"use client";
import { useSyncExternalStore } from "react";
const native = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
let nativeFullscreen = false;
const listeners = new Set<() => void>();
async function nativeWindow() {
  return (await import("@tauri-apps/api/window")).getCurrentWindow();
}
export async function enterFullscreen() {
  try {
    if (native()) {
      await (await nativeWindow()).setFullscreen(true);
      nativeFullscreen = true;
      listeners.forEach((f) => f());
    } else if (!document.fullscreenElement)
      await document.documentElement.requestFullscreen?.();
  } catch {
    /* Users may decline fullscreen; the exam remains usable. */
  }
}
export async function exitFullscreen() {
  try {
    if (native()) {
      await (await nativeWindow()).setFullscreen(false);
      nativeFullscreen = false;
      listeners.forEach((f) => f());
    } else if (document.fullscreenElement) await document.exitFullscreen();
  } catch {}
}
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  document.addEventListener("fullscreenchange", onChange);
  let off: (() => void) | undefined;
  let closed = false;
  if (native())
    void nativeWindow().then(async (win) => {
      const refresh = () => {
        void win.isFullscreen().then((value) => {
          nativeFullscreen = value;
          onChange();
        });
      };
      refresh();
      const remove = await win.onResized(refresh);
      if (closed) remove();
      else off = remove;
    });
  return () => {
    closed = true;
    listeners.delete(onChange);
    document.removeEventListener("fullscreenchange", onChange);
    off?.();
  };
}
const noopSubscribe = () => () => {};
export function useFullscreen() {
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => (native() ? nativeFullscreen : document.fullscreenElement !== null),
    () => false,
  );
  const supported = useSyncExternalStore(
    noopSubscribe,
    () =>
      native() ||
      typeof document.documentElement.requestFullscreen === "function",
    () => true,
  );
  return {
    isFullscreen,
    supported,
    enter: enterFullscreen,
    exit: exitFullscreen,
  };
}
