import { describe, it, expect, vi, beforeEach } from "vitest";
import { useWorkStore } from "@/exam/workStore";

// Setup mock browser globals safely
class MockMediaRecorder extends EventTarget {
  static isTypeSupported = vi.fn(() => true);
  mimeType = "audio/webm";
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: any) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public stream: any, public options: any) {
    super();
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }
}

Object.defineProperty(globalThis, "window", {
  value: globalThis,
  configurable: true,
  writable: true,
});
(globalThis as any).MediaRecorder = MockMediaRecorder;

let resolveGetUserMedia: (stream: any) => void = () => {};
let getUserMediaPromise: Promise<any> | null = null;
const mockStream = {
  getTracks: () => [{ stop: vi.fn() }],
};

Object.defineProperty(globalThis, "navigator", {
  value: {
    userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
    mediaDevices: {
      getUserMedia: vi.fn(() => {
        if (getUserMediaPromise) return getUserMediaPromise;
        return Promise.resolve(mockStream);
      }),
    },
  },
  configurable: true,
  writable: true,
});

const { startRecording, stopRecording, useRecordingStatus } = await import(
  "@/components/speaking/recordingEngine"
);

describe("Regression Test: Bug 1 (startRecording aborted by stopRecording during init)", () => {
  beforeEach(() => {
    getUserMediaPromise = null;
    useWorkStore.getState().startSpeaking(
      {
        id: "test-paper",
        title: "Test Speaking Paper",
        part1: ["Question 1", "Question 2"],
        cueCard: "Part 2 Card",
        part3: ["Question 3"],
      },
      { libraryId: "test-lib", book: "1", testNumber: 1, mode: "practice" },
    );
    useRecordingStatus.setState({ recording: false, status: "idle", pending: 0, error: "" });
  });

  it("status gets stuck in 'saving' when stopRecording is called before startRecording initialization completes", async () => {
    // 1. Arrange: getUserMedia is pending
    getUserMediaPromise = new Promise((resolve) => {
      resolveGetUserMedia = resolve;
    });

    // 2. Start recording (enters async openRecording, sets status to "saving")
    const startPromise = startRecording("Question 1", 1);
    expect(useRecordingStatus.getState().status).toBe("saving");

    // 3. Abort by calling stopRecording while initialization is pending
    const stopPromise = stopRecording();

    // 4. Resolve getUserMedia
    resolveGetUserMedia(mockStream);

    // 5. Wait for both promises to settle
    await Promise.all([startPromise, stopPromise]);

    // 6. Verify bug condition: status remains stuck in "saving" because neither
    // openRecording's early return nor stopRecording's early return resets status to "idle".
    const finalState = useRecordingStatus.getState();
    expect(finalState.recording).toBe(false);
    expect(finalState.status).toBe("saving");
  });
});
