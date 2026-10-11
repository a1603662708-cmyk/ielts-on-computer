import { beforeAll, expect, it } from "vitest";
import { openDB } from "idb";
import { db, getAsset } from "@/storage/db";
import {
  createRecording,
  appendRecordingChunk,
  completeRecording,
  recoverRecordings,
  deleteRecording,
} from "@/storage/recordings";
import type { RecordingSessionRecord } from "@/storage/recording-types";
import { wavHeader } from "@/storage/wav";
const old = {
  history: { answers: { 1: "retained" }, highlights: [{ start: 1, end: 4 }] },
  writing: { essays: ["Old Task 1", "Old Task 2"] },
  speaking: { asset: "asset:legacy" },
};
beforeAll(async () => {
  const d = await openDB("ielts-local-v2", 1, {
    upgrade(d) {
      d.createObjectStore("records");
      d.createObjectStore("assets");
    },
  });
  for (const [k, v] of Object.entries(old)) await d.put("records", v, k);
  await d.put("assets", new Blob(["legacy original audio"]), "legacy");
  d.close();
});
function session(id: string): RecordingSessionRecord {
  return {
    sessionId: id,
    examSessionId: "exam",
    testId: "test",
    part: 1,
    questionId: "1:0",
    question: "Question",
    startedAt: 1,
    updatedAt: 1,
    status: "recording",
    mimeType: "application/octet-stream",
    timeslice: 500,
    lastSequence: -1,
    duration: 0,
    bytes: 0,
  };
}
const chunk = (id: string, sequence: number) => ({
  sessionId: id,
  sequence,
  timestamp: sequence * 500,
  duration: 0.5,
  endTime: (sequence + 1) * 0.5,
  blob: new Blob([`chunk${sequence}`]),
});
it("version 1 upgrade preserves history, answers, highlights, writing and legacy audio byte-for-byte", async () => {
  const d = await db();
  expect(d.version).toBe(2);
  for (const [k, v] of Object.entries(old))
    expect(await d.get("records", k)).toEqual(v);
  expect(await (await getAsset("asset:legacy")).text()).toBe(
    "legacy original audio",
  );
});
it("append is immutable and metadata advances atomically; duplicate/out-of-order chunks are rejected", async () => {
  await createRecording(session("append"));
  await appendRecordingChunk(chunk("append", 0));
  await expect(appendRecordingChunk(chunk("append", 0))).rejects.toThrow(
    /sequence/,
  );
  await expect(appendRecordingChunk(chunk("append", 2))).rejects.toThrow(
    /sequence/,
  );
  const d = await db();
  expect(await d.count("recordingChunks")).toBe(1);
  expect((await d.get("recordingSessions", "append"))?.lastSequence).toBe(0);
  await appendRecordingChunk(chunk("append", 1));
  expect(await (await getAsset("recording:append")).text()).toBe(
    "chunk0chunk1",
  );
});
it("startup recovers every committed fragment and preserves completed status", async () => {
  await createRecording(session("finished"));
  await appendRecordingChunk(chunk("finished", 0));
  await completeRecording("finished");
  await recoverRecordings();
  const d = await db();
  expect((await d.get("recordingSessions", "append"))?.status).toBe(
    "interrupted",
  );
  expect((await d.get("recordingSessions", "finished"))?.status).toBe(
    "completed",
  );
  expect(await (await getAsset("recording:append")).text()).toBe(
    "chunk0chunk1",
  );
  await expect(appendRecordingChunk(chunk("append", 2))).rejects.toThrow(
    /status/,
  );
});
it("delete removes metadata and every chunk but preserves other recordings", async () => {
  await deleteRecording("append");
  const d = await db();
  expect(await d.get("recordingSessions", "append")).toBeUndefined();
  expect(
    await d.getAllFromIndex("recordingChunks", "sessionId", "append"),
  ).toEqual([]);
  expect(await (await getAsset("recording:finished")).text()).toBe("chunk0");
});
it("PCM recovery creates a standard seekable WAV with exact sample count", async () => {
  const s = { ...session("pcm"), mimeType: "audio/wav", sampleRate: 24000 };
  await createRecording(s);
  await appendRecordingChunk({
    ...chunk("pcm", 0),
    blob: new Blob([new Int16Array(12000)]),
  });
  const b = await getAsset("recording:pcm"),
    v = new DataView(await b.arrayBuffer());
  expect(b.type).toBe("audio/wav");
  expect(b.size).toBe(24044);
  expect(v.getUint32(24, true)).toBe(24000);
  expect(v.getUint32(40, true)).toBe(24000);
  expect(() => wavHeader(0xffffffff, 24000)).toThrow();
});
