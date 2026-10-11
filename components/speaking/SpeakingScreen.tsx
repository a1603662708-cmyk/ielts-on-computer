"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hydrateWork, useWorkStore } from "@/exam/workStore";
import { clockNow } from "@/exam/clock";
import { useCountdown, formatClock } from "@/lib/useTimer";
import { WorkHeader } from "@/components/test/WorkHeader";
import { useRecorder } from "./useRecorder";
import { RecordingPlayer } from "./RecordingPlayer";
import { Modal } from "@/components/test/Modal";
import { deleteAsset } from "@/storage/db";
export function SpeakingScreen() {
  const s = useWorkStore((state) => state.session);
  const hydrated = useWorkStore((state) => state.hydrated);
  const session = s?.kind === "speaking" ? s : null;
  const recorder = useRecorder();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const { start, stop } = recorder;
  useEffect(() => {
    void hydrateWork().catch((e) => setError(String(e)));
    const id = setInterval(
      () => useWorkStore.getState().update({ lastSeen: clockNow() }),
      5000,
    );
    return () => clearInterval(id);
  }, []);
  const advance = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await stop();
      setError("");
      const s = useWorkStore.getState().session;
      if (s?.kind !== "speaking" || s.finished) return;
      const update = useWorkStore.getState().update;
      if (
        s.stage === "part1" &&
        s.questionIndex + 1 < s.paper.part1.length &&
        s.endsAt > clockNow()
      )
        update({ questionIndex: s.questionIndex + 1 });
      else if (s.stage === "part1")
        update({ stage: "prep", questionIndex: 0, endsAt: clockNow() + 60000 });
      else if (s.stage === "prep")
        update({ stage: "part2", endsAt: clockNow() + 120000 });
      else if (s.stage === "part2")
        update({
          stage: "part3",
          questionIndex: 0,
          endsAt: clockNow() + 300000,
        });
      else if (
        s.stage === "part3" &&
        s.questionIndex + 1 < s.paper.part3.length &&
        s.endsAt > clockNow()
      )
        update({ questionIndex: s.questionIndex + 1 });
      else await useWorkStore.getState().finish();
    } catch (e) {
      setError(String(e));
    } finally {
      busy.current = false;
    }
  }, [stop]);
  const remaining = useCountdown(
    session && !session.finished ? session.endsAt : null,
    () => {
      void advance();
    },
  );
  const questionCount =
    session?.stage === "part1"
      ? session.paper.part1.length
      : (session?.paper.part3.length ?? 1);
  const stage = session?.stage;
  const qi = session?.questionIndex;
  const finished = session?.finished;
  useEffect(() => {
    const current = useWorkStore.getState().session;
    if (
      current?.kind !== "speaking" ||
      current.finished ||
      current.stage === "prep" ||
      current.stage === "done"
    )
      return;
    const part =
      current.stage === "part1" ? 1 : current.stage === "part2" ? 2 : 3;
    const prompt =
      part === 1
        ? current.paper.part1[current.questionIndex]
        : part === 2
          ? current.paper.cueCard
          : current.paper.part3[current.questionIndex];
    const existing = current.recordings.some(
      (r) => r.part === part && r.question === prompt,
    );
    // A refreshed Mock cannot overwrite or re-record an already captured response.
    if (
      current.recordings.some(
        (r) => r.question === prompt && r.part === part && r.interrupted,
      )
    )
      return;
    if (current.mode === "mock" && (existing || current.recordingStartedAt))
      return;
    void start(prompt, part);
  }, [stage, qi, finished, start]);
  useEffect(() => {
    if (!recorder.recording || stage === "part2" || stage === "prep") return;
    const id = setTimeout(
      () => void advance(),
      Math.max(1000, 300000 / questionCount),
    );
    return () => clearTimeout(id);
  }, [recorder.recording, stage, qi, questionCount, advance]);
  if (!session)
    return (
      <main className="local-shell">
        <h1>Speaking Simulator</h1>
        <p>
          {error ||
            (!hydrated ? "Loading…" : "Choose a Speaking test from Library.")}
        </p>
        <Link href="/">Library</Link>
      </main>
    );
  if (session.finished)
    return (
      <main className="local-shell">
        <h1>Speaking saved</h1>
        <p>
          {session.recordings.length} real recordings saved locally. No
          automated IELTS band is assigned.
        </p>
        {session.recordings.map((r) => (
          <RecordingPlayer key={`saved-${r.id}`} entry={r} />
        ))}
        <Link className="local-btn" href="/history">
          View History
        </Link>
      </main>
    );
  const part = stage === "part1" ? 1 : stage === "part3" ? 3 : 2;
  const prompt =
    part === 1
      ? session.paper.part1[session.questionIndex]
      : part === 3
        ? session.paper.part3[session.questionIndex]
        : session.paper.cueCard;
  const entries = session.recordings.filter(
    (r) => r.question === prompt && r.part === part,
  );
  const canRecord =
    session.mode === "practice" ||
    (!entries.length && !session.recordingStartedAt);
  return (
    <div className="exam-layout">
      <WorkHeader
        title={`Speaking Simulator · Part ${part}${stage === "prep" ? " · Preparation" : ""}`}
        time={formatClock(remaining)}
        onSubmit={() => setConfirm(true)}
      />
      <div className="local-shell w-full overflow-auto">
        <p className="muted">
          Practice simulator. The real IELTS Speaking test is conducted by a
          human examiner.
        </p>
        <h1>
          {stage === "prep"
            ? "Prepare for one minute"
            : stage === "part2"
              ? "Speak for up to two minutes"
              : `Question ${session.questionIndex + 1}`}
        </h1>
        <p className="whitespace-pre-wrap text-xl my-8">{prompt}</p>
        {stage === "prep" ? (
          <label className="field">
            Preparation notes
            <textarea
              value={session.notes}
              onChange={(e) =>
                useWorkStore.getState().update({ notes: e.target.value })
              }
            />
          </label>
        ) : (
          <>
            <p role="status" className="my-4 font-semibold">
              {recorder.recording
                ? "● Recording — saving every 500 ms"
                : recorder.status === "saving"
                  ? "Saving…"
                  : "Saved"}
            </p>
            {session.notes && part === 2 && (
              <p className="notice whitespace-pre-wrap">{session.notes}</p>
            )}
            {(recorder.error || error) && (
              <p role="alert" className="error">
                {recorder.error || error}
              </p>
            )}
            {!recorder.recording && !canRecord && (
              <p className="notice">
                This response has already been recorded or was interrupted. Mock
                mode allows continuing to the next question, but not
                re-recording.
              </p>
            )}
            <div className="actions">
              {recorder.recording ? (
                <button
                  onClick={() => void stop().catch((e) => setError(String(e)))}
                >
                  Stop recording
                </button>
              ) : (
                canRecord && (
                  <button onClick={() => void start(prompt, part)}>
                    {entries.length
                      ? "Record again"
                      : "Start recording / retry microphone"}
                  </button>
                )
              )}
              <button className="primary" onClick={() => void advance()}>
                Next question / part
              </button>
            </div>
            {!recorder.recording &&
              recorder.status !== "saving" &&
              entries.map((r) => (
                <div key={r.id}>
                  <RecordingPlayer entry={r} />
                  {session.mode === "practice" && !recorder.recording && (
                    <button
                      onClick={() => {
                        void deleteAsset(r.asset)
                          .then(() =>
                            useWorkStore.getState().update({
                              recordings: session.recordings.filter(
                                (e) => e.id !== r.id,
                              ),
                            }),
                          )
                          .catch((e) => setError(String(e)));
                      }}
                    >
                      Delete recording
                    </button>
                  )}
                </div>
              ))}
          </>
        )}
      </div>
      {confirm && (
        <Modal
          title="End Speaking?"
          onClose={() => setConfirm(false)}
          footer={
            <button
              className="local-btn primary"
              onClick={() => {
                void stop()
                  .then(() => useWorkStore.getState().finish())
                  .catch((e) => setError(String(e)));
                setConfirm(false);
              }}
            >
              Save and finish
            </button>
          }
        >
          <p>Your recordings and preparation notes will be saved to History.</p>
        </Modal>
      )}
    </div>
  );
}
