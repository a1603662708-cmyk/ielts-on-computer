"use client";
import { useEffect, useRef, useState } from "react";
import type { Test } from "@/lib/schema";
import { useTestStore } from "@/lib/store";
import { resolveAsset } from "@/storage/db";
import { audioPosition, clockNow } from "@/exam/clock";

export function AudioRunner({ test }: { test: Test }) {
  const ref = useRef<HTMLAudioElement>(null);
  const session = useTestStore((s) => s.session);
  const [index, setIndex] = useState(
    () => useTestStore.getState().session?.audioIndex ?? 0,
  );
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState(1);
  const rateRef = useRef(1);
  const naturalTransition = useRef<number | null>(null);
  const tracks = test.audio;
  const mode = session?.mode ?? "mock";
  const paused = Boolean(session?.pausedAt);
  const volume = session?.volume ?? 0.8;
  useEffect(() => {
    let cancelled = false;
    let objectURL = "";
    const el = ref.current;
    if (!el || !tracks) return;
    async function load() {
      const s = useTestStore.getState().session;
      if (!s || !el || !tracks) return;
      let target = index;
      let offset = s.audioOffset;
      // A continuous transition must play the next track from its beginning.
      // Wall-clock catch-up is only for reopening/resuming the exam.
      if (naturalTransition.current === index) offset = 0;
      else if (s.mode === "mock" && tracks.every((t) => t.duration)) {
        const pos = audioPosition(
          tracks.map((t) => t.duration!),
          (clockNow() - s.startedAt) / 1000,
        );
        target = pos.index;
        offset = pos.offset;
        if (target !== index) {
          setIndex(target);
          return;
        }
      }
      if (!tracks[target]) {
        useTestStore.getState().setAudioPart(-1);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        objectURL = await resolveAsset(tracks[target].url);
        if (cancelled) {
          if (objectURL.startsWith("blob:")) URL.revokeObjectURL(objectURL);
          return;
        }
        el.src = objectURL;
        el.onloadedmetadata = () => {
          el.playbackRate = s.mode === "practice" ? rateRef.current : 1;
          el.currentTime = Math.min(offset, Math.max(0, el.duration - 0.01));
          setLoading(false);
          if (!useTestStore.getState().session?.pausedAt)
            void el
              .play()
              .then(() => setBlocked(false))
              .catch(() => setBlocked(true));
        };
        el.load();
        if (s.audioPart !== tracks[target].part)
          useTestStore.getState().setActivePart(tracks[target].part);
        useTestStore.getState().setAudioPart(tracks[target].part);
      } catch (e) {
        setError(String(e));
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      el.pause();
      el.onloadedmetadata = null;
      el.removeAttribute("src");
      el.load();
      if (objectURL.startsWith("blob:")) URL.revokeObjectURL(objectURL);
    };
  }, [index, tracks]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    if (ref.current) {
      if (paused) ref.current.pause();
      else if (ref.current.src && !ref.current.ended)
        void ref.current.play().catch(() => setBlocked(true));
    }
  }, [paused]);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = mode === "practice" ? rate : 1;
  }, [rate, mode]);
  if (!tracks?.length) return <p role="alert">No audio attached.</p>;
  function ended() {
    const next = index + 1;
    naturalTransition.current = next;
    useTestStore.getState().audioProgress(next, 0);
    setIndex(next);
    if (tracks?.[next])
      useTestStore.getState().setActivePart(tracks[next].part);
  }
  return (
    <div className="audio-strip">
      <audio
        ref={ref}
        controls={mode === "practice" && !paused}
        preload="auto"
        onEnded={ended}
        onTimeUpdate={() => {
          const el = ref.current;
          if (el && !el.seeking)
            useTestStore.getState().audioProgress(index, el.currentTime);
        }}
        onError={() => {
          if (ref.current?.getAttribute("src")) {
            setError(
              "Audio could not be decoded or loaded. Your answers are saved. The Mock clock continues.",
            );
            setLoading(false);
          }
        }}
      />
      {loading && <span role="status">Loading audio…</span>}
      {error && <span role="alert">{error}</span>}
      {blocked && (
        <button
          onClick={() => {
            const el = ref.current;
            const s = useTestStore.getState().session;
            if (!el || !s) return;
            if (mode === "mock" && tracks.every((t) => t.duration)) {
              const pos = audioPosition(
                tracks.map((t) => t.duration!),
                (clockNow() - s.startedAt) / 1000,
              );
              if (pos.index !== index) {
                setIndex(pos.index);
                return;
              }
              el.currentTime = pos.offset;
            }
            void el
              .play()
              .then(() => setBlocked(false))
              .catch((e) => setError(String(e)));
          }}
        >
          Enable audio
        </button>
      )}
      {mode === "practice" && (
        <>
          <label>
            Speed{" "}
            <select
              value={rate}
              onChange={(e) => {
                rateRef.current = Number(e.target.value);
                setRate(rateRef.current);
              }}
            >
              {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Recording{" "}
            <select
              aria-label="Recording"
              value={Math.min(index, tracks.length - 1)}
              onChange={(e) => {
                useTestStore
                  .getState()
                  .audioProgress(Number(e.target.value), 0);
                setIndex(Number(e.target.value));
              }}
            >
              {tracks.map((t, i) => (
                <option value={i} key={i}>
                  Part {t.part}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={paused}
            onClick={() => {
              if (index >= tracks.length) {
                const target = tracks.length - 1;
                useTestStore.getState().audioProgress(target, 0);
                setIndex(target);
              } else if (ref.current) {
                ref.current.currentTime = 0;
                void ref.current.play().catch((e) => setError(String(e)));
              }
            }}
          >
            Replay
          </button>
        </>
      )}
      <VolumeControl />
    </div>
  );
}
export function VolumeControl() {
  const volume = useTestStore((s) => s.session?.volume ?? 0.8);
  const set = useTestStore((s) => s.setVolume);
  return (
    <label className="flex items-center gap-2 text-sm">
      Volume{" "}
      <input
        aria-label="Volume"
        type="range"
        min="0"
        max="1"
        step=".02"
        value={volume}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );
}
