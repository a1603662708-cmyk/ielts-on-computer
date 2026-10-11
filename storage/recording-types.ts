export type RecordingSessionRecord = {
  sessionId: string;
  examSessionId: string;
  testId: string;
  part: number;
  questionId: string;
  question: string;
  startedAt: number;
  updatedAt: number;
  status: "recording" | "completed" | "interrupted";
  mimeType: string;
  sampleRate?: number;
  timeslice: number;
  lastSequence: number;
  duration: number;
  bytes: number;
};
export type RecordingChunk = {
  sessionId: string;
  sequence: number;
  timestamp: number;
  duration: number;
  endTime: number;
  blob: Blob;
};
