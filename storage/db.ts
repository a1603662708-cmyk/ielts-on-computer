import { openDB, type DBSchema } from "idb";
import { create } from "zustand";

import type { RecordingSessionRecord, RecordingChunk } from "./recording-types";

interface LocalDB extends DBSchema {
  recordingSessions: {
    key: string;
    value: RecordingSessionRecord;
    indexes: { examSessionId: string };
  };
  recordingChunks: {
    key: [string, number];
    value: RecordingChunk;
    indexes: { sessionId: string };
  };
  records: { key: string; value: unknown };
  assets: { key: string; value: Blob };
}
let database: ReturnType<typeof openDB<LocalDB>> | undefined;
export function db() {
  return (database ??= openDB<LocalDB>("ielts-local-v2", 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("records");
        database.createObjectStore("assets");
      }
      if (oldVersion < 2) {
        database
          .createObjectStore("recordingSessions", { keyPath: "sessionId" })
          .createIndex("examSessionId", "examSessionId");
        database
          .createObjectStore("recordingChunks", {
            keyPath: ["sessionId", "sequence"],
          })
          .createIndex("sessionId", "sessionId");
      }
    },
  }));
}
export const useStorageStatus = create<{
  pending: number;
  error: string | null;
}>(() => ({ pending: 0, error: null }));
let queue: Promise<unknown> = Promise.resolve();
export function saveRecord<T>(key: string, value: T): Promise<void> {
  useStorageStatus.setState((s) => ({ pending: s.pending + 1 }));
  const task = queue
    .catch(() => {})
    .then(async () => {
      try {
        await (await db()).put("records", value, key);
        useStorageStatus.setState({ error: null });
      } catch (e) {
        useStorageStatus.setState({
          error: `Local save failed: ${String(e)}. Keep this window open and export your work.`,
        });
        throw e;
      } finally {
        useStorageStatus.setState((s) => ({ pending: s.pending - 1 }));
      }
    });
  queue = task;
  return task;
}
export function persist<T>(key: string, value: T) {
  void saveRecord(key, value).catch(() => {});
}
export async function readRecord<T>(key: string): Promise<T | undefined> {
  await queue.catch(() => {});
  return (await db()).get("records", key) as Promise<T | undefined>;
}
export async function listRecords<T>(prefix: string): Promise<T[]> {
  const database = await db();
  const keys = await database.getAllKeys("records");
  return Promise.all(
    keys
      .filter((k) => k.startsWith(prefix))
      .map((k) => database.get("records", k)),
  ) as Promise<T[]>;
}
export async function putAsset(
  blob: Blob,
  id = crypto.randomUUID(),
): Promise<string> {
  await (await db()).put("assets", blob, id);
  return `asset:${id}`;
}
export async function getAsset(ref: string): Promise<Blob> {
  if (ref.startsWith("recording:"))
    return (await import("./recordings")).assembleRecording(ref.slice(10));
  const blob = await (await db()).get("assets", ref.replace(/^asset:/, ""));
  if (!blob) throw new Error(`Missing local file: ${ref}`);
  return blob;
}
export async function resolveAsset(ref: string): Promise<string> {
  return ref.startsWith("asset:") || ref.startsWith("recording:")
    ? URL.createObjectURL(await getAsset(ref))
    : ref;
}
export async function deleteAsset(ref: string) {
  if (ref.startsWith("recording:"))
    return (await import("./recordings")).deleteRecording(ref.slice(10));
  await (await db()).delete("assets", ref.replace(/^asset:/, ""));
}
export async function flushSaves() {
  await queue;
}

// Run only while holding the single-window lock, before any import/recording UI
// mounts. Historical papers retain their media; abandoned imports do not grow forever.
export async function collectOrphanAssets() {
  await flushSaves();
  const database = await db();
  const records = await database.getAll("records");
  const refs = new Set<string>();
  function walk(value: unknown) {
    if (typeof value === "string" && value.startsWith("asset:"))
      refs.add(value.slice(6));
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  }
  records.forEach(walk);
  if (typeof localStorage !== "undefined")
    for (const key of [
      "ielts.journal.ielts.session",
      "ielts.journal.work.session",
    ]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          walk(JSON.parse(raw));
        } catch {
          return 0;
        }
      }
    }
  const keys = await database.getAllKeys("assets");
  const orphans = keys.filter((key) => !refs.has(key));
  const transaction = database.transaction("assets", "readwrite");
  await Promise.all(orphans.map((key) => transaction.store.delete(key)));
  await transaction.done;
  return orphans.length;
}
