"use client";
import { useEffect } from "react";
import {
  startRecording,
  stopRecording,
  useRecordingStatus,
} from "./recordingEngine";
export function useRecorder() {
  const state = useRecordingStatus();
  useEffect(
    () => () => {
      void stopRecording().catch(() => {});
    },
    [],
  );
  return { ...state, start: startRecording, stop: stopRecording };
}
