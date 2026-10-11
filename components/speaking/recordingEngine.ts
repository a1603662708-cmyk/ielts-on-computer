"use client";
import { create } from "zustand";
import { PCMRecorder, needsPCMRecording } from "./pcmRecorder";
import { useWorkStore, type Recording } from "@/exam/workStore";
import { flushSaves } from "@/storage/db";
import {
  createRecording,
  appendRecordingChunk,
  completeRecording,
  deleteRecording,
} from "@/storage/recordings";
import type {
  RecordingChunk,
  RecordingSessionRecord,
} from "@/storage/recording-types";
export const RECORDING_TIMESLICE = 500;
export const useRecordingStatus = create<{
  recording: boolean;
  status: "idle" | "recording" | "saving" | "saved";
  pending: number;
  error: string;
}>(() => ({ recording: false, status: "idle", pending: 0, error: "" }));
let media: MediaRecorder | PCMRecorder | null = null;
let input: MediaStream | null = null;
let opening = false;
let openingTask: Promise<void> | null = null;
let generation = 0;
let record: RecordingSessionRecord | null = null;
let chunks: RecordingChunk[] = [];
let drainTask: Promise<void> | null = null;
let stopTask: Promise<void> | null = null;
let stopped: Promise<void> = Promise.resolve();
let failure: unknown = null;

function updateEntry(session: RecordingSessionRecord) {
  const work = useWorkStore.getState().session;
  if (
    work?.kind !== "speaking" ||
    work.id !== session.examSessionId ||
    work.finished
  )
    return;
  const entry: Recording = {
    id: session.sessionId,
    asset: "recording:" + session.sessionId,
    part: session.part,
    question: session.question,
    startedAt: session.startedAt,
    duration: session.duration,
  };
  useWorkStore.getState().update({
    recordings: [...work.recordings.filter((r) => r.id !== entry.id), entry],
  });
}
function message(error: unknown) {
  return `Recording save failed: ${String(error)}. Keep this window open, free disk space, then click Next to retry saving.`;
}
async function drain() {
  if (drainTask) return drainTask;
  drainTask = (async () => {
    while (chunks.length) {
      const next = await appendRecordingChunk(chunks[0]);
      chunks.shift();
      record = next;
      updateEntry(next);
      useRecordingStatus.setState({ pending: chunks.length });
    }
    failure = null;
    useRecordingStatus.setState({ error: "" });
  })();
  try {
    await drainTask;
  } catch (e) {
    failure = e;
    useRecordingStatus.setState({ error: message(e) });
    // Bound RAM during a disk failure; retain the failed and final chunks for retry.
    if (media?.state === "recording") media.stop();
    throw e;
  } finally {
    drainTask = null;
  }
}
export function startRecording(question: string, part: number) {
  if (opening || media || chunks.length || stopTask) return Promise.resolve();
  opening = true;
  const token = ++generation;
  openingTask = openRecording(question, part, token).finally(() => {
    opening = false;
    openingTask = null;
  });
  return openingTask;
}
async function openRecording(question: string, part: number, token: number) {
  let stream: MediaStream | null = null;
  let createdId: string | null = null;
  let pcm: PCMRecorder | null = null;
  useRecordingStatus.setState({ error: "", status: "saving" });
  try {
    const work = useWorkStore.getState().session;
    if (work?.kind !== "speaking" || work.finished)
      throw new Error("No active Speaking exam.");

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const ownedStream = stream;
    if (token !== generation) {
      stream.getTracks().forEach((t) => t.stop());
      useRecordingStatus.setState({ recording: false, status: "idle", pending: 0, error: "" });
      return;
    }

    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (t) => MediaRecorder.isTypeSupported(t),
    );
    const recorder = needsPCMRecording()
      ? (pcm = await PCMRecorder.create(stream))
      : new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const sessionId = crypto.randomUUID();
    await flushSaves();
    if (token !== generation) {
      stream.getTracks().forEach((t) => t.stop());
      await pcm?.dispose();
      useRecordingStatus.setState({ recording: false, status: "idle", pending: 0, error: "" });
      return;
    }
    const startedAt = Date.now();
    const newRecord: RecordingSessionRecord = {
      sessionId,
      examSessionId: work.id,
      testId: work.libraryId,
      part,
      questionId: `${part}:${work.questionIndex}`,
      question,
      startedAt,
      updatedAt: startedAt,
      status: "recording",
      mimeType: recorder.mimeType,
      sampleRate: pcm?.sampleRate,
      timeslice: RECORDING_TIMESLICE,
      lastSequence: -1,
      duration: 0,
      bytes: 0,
    };
    await createRecording(newRecord);
    createdId = sessionId;
    if (token !== generation) {
      await deleteRecording(sessionId);
      stream.getTracks().forEach((t) => t.stop());
      await pcm?.dispose();
      useRecordingStatus.setState({ recording: false, status: "idle", pending: 0, error: "" });
      return;
    }
    record = newRecord;
    media = recorder;
    input = stream;
    chunks = [];
    failure = null;
    let sequence = 0,
      lastEnd = 0;
    const startedMono = performance.now();
    useWorkStore
      .getState()
      .update({ recordingStartedAt: startedAt, recordingId: sessionId });
    stopped = new Promise<void>((resolve) =>
      recorder.addEventListener(
        "stop",
        () => {
          ownedStream.getTracks().forEach((t) => t.stop());
          useRecordingStatus.setState({ recording: false, status: "saving" });
          resolve();
        },
        { once: true },
      ),
    );
    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      const endTime = pcm
        ? e.timecode / 1000
        : (performance.now() - startedMono) / 1000;
      chunks.push({
        sessionId,
        sequence: sequence++,
        timestamp: Date.now(),
        duration: endTime - lastEnd,
        endTime,
        blob: e.data,
      });
      lastEnd = endTime;
      useRecordingStatus.setState({ pending: chunks.length });
      void drain().catch(() => {});
    };
    recorder.onerror = () =>
      useRecordingStatus.setState({
        error: "Microphone recording failed. Stop and save before retrying.",
      });
    recorder.start(RECORDING_TIMESLICE);
    useRecordingStatus.setState({
      recording: true,
      status: "recording",
      pending: 0,
    });
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    await pcm?.dispose().catch(() => {});
    if (input === stream) input = null;
    media = null;
    record = null;
    if (createdId) await deleteRecording(createdId).catch(() => {});
    useWorkStore
      .getState()
      .update({ recordingStartedAt: undefined, recordingId: undefined });
    useRecordingStatus.setState({
      recording: false,
      status: "idle",
      error:
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in macOS System Settings or your browser, then retry."
          : String(e),
    });
  }
}
export async function stopRecording() {
  generation++;
  if (stopTask) return stopTask;
  stopTask = (async () => {
    if (openingTask) await openingTask;
    if (!media && !record && !chunks.length) {
      useRecordingStatus.setState({
        recording: false,
        status: "idle",
        pending: 0,
        error: "",
      });
      return;
    }
    useRecordingStatus.setState({ status: "saving" });
    if (media?.state === "recording") media.stop();
    if (media) await stopped; // stop fires AFTER the last dataavailable.
    if (drainTask) await drainTask.catch(() => {});
    await drain();
    if (failure) throw failure;
    if (record) await completeRecording(record.sessionId);
    await flushSaves();
    input?.getTracks().forEach((t) => t.stop());
    input = null;
    media = null;
    record = null;
    useWorkStore
      .getState()
      .update({ recordingStartedAt: undefined, recordingId: undefined });
    await flushSaves();
    useRecordingStatus.setState({
      recording: false,
      status: "saved",
      pending: 0,
      error: "",
    });
  })();
  try {
    await stopTask;
  } catch (e) {
    useRecordingStatus.setState({ error: message(e), status: "saving" });
    throw e;
  } finally {
    stopTask = null;
  }
}
export function needsRecordingFlush() {
  return Boolean(media || opening || record || chunks.length || stopTask);
}
