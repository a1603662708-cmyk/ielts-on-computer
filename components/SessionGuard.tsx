"use client";
import { RecordingExitGuard } from "./RecordingExitGuard";
import { useEffect, useState } from "react";
import { collectOrphanAssets } from "@/storage/db";
import { hydrateStore } from "@/lib/store";
import { hydrateWork } from "@/exam/workStore";
// The browser releases this lock even after a crash. Never allow two stale stores
// to write the same session or recovery journal at the same origin.
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState("loading");
  useEffect(() => {
    let closed = false;
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    if (!navigator.locks) {
      queueMicrotask(() =>
        setState(
          "This browser does not support safe local session locking. Use current Chrome, Safari, or the macOS App.",
        ),
      );
      return;
    }
    void navigator.locks
      .request(
        "ielts-local-session-owner",
        { ifAvailable: true },
        async (lock) => {
          if (closed) return;
          if (!lock) {
            setState("Already open in another window");
            return;
          }
          try {
            await Promise.all([hydrateStore(), hydrateWork()]);
            await collectOrphanAssets();
            if (!closed) setState("ready");
          } catch (e) {
            if (!closed) setState(String(e));
          }
          await held;
        },
      )
      .catch((e) => {
        if (!closed) setState(String(e));
      });
    return () => {
      closed = true;
      release?.();
    };
  }, []);
  if (state === "ready")
    return (
      <>
        <RecordingExitGuard />
        {children}
      </>
    );
  return (
    <main className="local-shell">
      <h1>IELTS Simulator</h1>
      <p role={state === "loading" ? "status" : "alert"}>
        {state === "loading" ? "Opening local exam data…" : state}
      </p>
      {state !== "loading" && (
        <p>
          Close the other simulator window, then reload this page. Do not clear
          site data: it contains your saved work.
        </p>
      )}
    </main>
  );
}
