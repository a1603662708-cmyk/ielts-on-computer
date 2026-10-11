import { db, useStorageStatus } from "./db";
import { wavHeader } from "./wav";
import { fixWebmDuration } from "@fix-webm-duration/fix";
import type { RecordingChunk, RecordingSessionRecord } from "./recording-types";

// Strict transactions acknowledge a chunk only after the transaction commits.
// add(), not put(): a sequence can never silently replace an earlier chunk.
export async function createRecording(session: RecordingSessionRecord) {
  const database = await db();
  const tx = database.transaction("recordingSessions", "readwrite", {
    durability: "strict",
  });
  await tx.store.add(session);
  await tx.done;
}
export async function appendRecordingChunk(chunk: RecordingChunk) {
  useStorageStatus.setState((s) => ({ pending: s.pending + 1 }));
  try {
    const database = await db();
    const tx = database.transaction(
      ["recordingSessions", "recordingChunks"],
      "readwrite",
      { durability: "strict" },
    );
    const sessions = tx.objectStore("recordingSessions");
    const session = await sessions.get(chunk.sessionId);
    if (
      !session ||
      session.status !== "recording" ||
      chunk.sequence !== session.lastSequence + 1
    ) {
      tx.abort();
      await tx.done.catch(() => {});
      throw new Error(
        "Recording chunk sequence/status mismatch; existing audio was not overwritten.",
      );
    }
    await tx.objectStore("recordingChunks").add(chunk);
    const next = {
      ...session,
      lastSequence: chunk.sequence,
      updatedAt: chunk.timestamp,
      duration: chunk.endTime,
      bytes: session.bytes + chunk.blob.size,
    };
    await sessions.put(next);
    await tx.done;
    return next;
  } finally {
    useStorageStatus.setState((s) => ({ pending: s.pending - 1 }));
  }
}
export async function completeRecording(sessionId: string) {
  const database = await db();
  const tx = database.transaction("recordingSessions", "readwrite", {
    durability: "strict",
  });
  const session = await tx.store.get(sessionId);
  if (!session) throw new Error("Missing recording session.");
  if (session.lastSequence < 0) await tx.store.delete(sessionId);
  else
    await tx.store.put({
      ...session,
      status: "completed",
      updatedAt: Date.now(),
    });
  await tx.done;
}
export async function recoverRecordings() {
  const database = await db();
  const tx = database.transaction("recordingSessions", "readwrite", {
    durability: "strict",
  });
  const sessions = await tx.store.getAll();
  for (const session of sessions)
    if (session.lastSequence < 0) await tx.store.delete(session.sessionId);
    else if (session.status === "recording") {
      session.status = "interrupted";
      await tx.store.put(session);
    }
  await tx.done;
  return sessions;
}
export async function recordingsForExam(examSessionId: string) {
  return (await db()).getAllFromIndex(
    "recordingSessions",
    "examSessionId",
    examSessionId,
  );
}
export async function assembleRecording(sessionId: string) {
  const database = await db();
  const session = await database.get("recordingSessions", sessionId);
  if (!session) throw new Error("Missing local recording session.");
  const chunks = await database.getAllFromIndex(
    "recordingChunks",
    "sessionId",
    sessionId,
  );
  chunks.sort((a, b) => a.sequence - b.sequence);
  if (
    chunks.length !== session.lastSequence + 1 ||
    chunks.some((c, i) => c.sequence !== i)
  )
    throw new Error(
      "Recording has a missing chunk. Existing data was retained.",
    );
  if (!chunks.length)
    throw new Error(
      "No audio chunk reached storage before this recording was interrupted.",
    );
  // MediaRecorder's chunks are ordered fragments of ONE container, not separate
  // media files. Assemble only for playback/export; never rewrite past chunks.
  const blob = new Blob(
    [
      ...(session.mimeType === "audio/wav"
        ? [wavHeader(session.bytes, session.sampleRate!)]
        : []),
      ...chunks.map((c) => c.blob),
    ],
    { type: session.mimeType },
  );
  return session.mimeType.includes("webm")
    ? fixWebmDuration(blob, session.duration * 1000, { logger: false })
    : blob;
}
export async function deleteRecording(sessionId: string) {
  const database = await db();
  const tx = database.transaction(
    ["recordingSessions", "recordingChunks"],
    "readwrite",
    { durability: "strict" },
  );
  const keys = await tx
    .objectStore("recordingChunks")
    .index("sessionId")
    .getAllKeys(sessionId);
  await Promise.all(
    keys.map((key) => tx.objectStore("recordingChunks").delete(key)),
  );
  await tx.objectStore("recordingSessions").delete(sessionId);
  await tx.done;
}
