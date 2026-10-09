"use client";
import { useStorageStatus } from "@/storage/db";
import { useRecordingStatus } from "./speaking/recordingEngine";
export function SaveStatus() {
  const recording = useRecordingStatus();
  const { pending, error } = useStorageStatus();
  return (
    <span
      className={error ? "save-error" : "save-status"}
      role={error ? "alert" : "status"}
    >
      {error ??
        (pending || recording.pending || recording.status === "saving"
          ? "Saving…"
          : recording.recording
            ? "Recording"
            : "Saved locally")}
    </span>
  );
}
