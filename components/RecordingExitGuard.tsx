"use client";
import { useEffect } from "react";
import { flushSaves } from "@/storage/db";
import { needsRecordingFlush, stopRecording } from "./speaking/recordingEngine";
export function RecordingExitGuard() {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const leave = async () => {
      await stopRecording();
      await flushSaves();
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        event.defaultPrevented ||
        !needsRecordingFlush() ||
        anchor.target === "_blank"
      )
        return;
      if (anchor.origin !== location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      void leave()
        .then(() => location.assign(anchor.href))
        .catch(() => {});
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (!needsRecordingFlush()) return;
      // Browser tab close cannot await arbitrary async work. Warn first; a forced
      // close is recovered as interrupted. Native close uses the awaited handshake.
      event.preventDefault();
      event.returnValue = "";
      void stopRecording().catch(() => {});
    };
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", unload);
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/event")
        .then(({ listen }) =>
          listen("app-exit-requested", () => {
            void leave()
              .then(async () => {
                const { invoke } = await import("@tauri-apps/api/core");
                await invoke("confirm_exit");
              })
              .catch(() => {});
          }),
        )
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        });
    }
    return () => {
      disposed = true;
      unlisten?.();
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  return null;
}
