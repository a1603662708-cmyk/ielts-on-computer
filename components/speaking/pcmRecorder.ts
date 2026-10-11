// WebKit can withhold encoded segments for >= 1 s regardless of timeslice.
// PCM capture on the audio thread makes the native App's flush interval explicit.
export class PCMRecorder extends EventTarget {
  readonly mimeType = "audio/wav";
  readonly sampleRate: number;
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  private readyResolve!: () => void;
  private ready = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
  });
  private constructor(
    private context: AudioContext,
    private node: AudioWorkletNode,
    private source: MediaStreamAudioSourceNode,
  ) {
    super();
    this.sampleRate = context.sampleRate;
    node.port.onmessage = ({ data }) => {
      if (data.ready) this.readyResolve();
      if (data.buffer)
        this.ondataavailable?.(
          new BlobEvent("dataavailable", {
            data: new Blob([data.buffer], { type: "audio/pcm" }),
            timecode: (data.frames / this.sampleRate) * 1000,
          }),
        );
      if (data.stopped) {
        this.source.disconnect();
        this.node.disconnect();
        void this.context.close().catch(() => {});
        this.dispatchEvent(new Event("stop"));
      }
    };
    node.onprocessorerror = () => this.onerror?.();
  }
  static async create(stream: MediaStream) {
    const context = new AudioContext({ sampleRate: 24000 });

    try {
      await Promise.race([
        context.audioWorklet.addModule("/pcm-recorder-worklet.js"),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Audio worklet could not load within 5 seconds."),
              ),
            5000,
          ),
        ),
      ]);

      const node = new AudioWorkletNode(context, "pcm-recorder", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
      });
      const source = context.createMediaStreamSource(stream);
      const recorder = new PCMRecorder(context, node, source);
      source.connect(node);
      node.connect(context.destination);
      await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Audio context could not resume within 5 seconds. Click Start recording to retry.",
                ),
              ),
            5000,
          ),
        ),
      ]);

      await Promise.race([
        recorder.ready,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Microphone input is not ready. Retry recording."),
              ),
            5000,
          ),
        ),
      ]);

      return recorder;
    } catch (e) {
      void context.close().catch(() => {});
      throw e;
    }
  }
  start(timeslice: number) {
    if (timeslice !== 500)
      throw new Error("PCM recording requires a 500 ms block.");
    // The worklet emits exactly 500 ms of samples.
    this.state = "recording";
    this.node.port.postMessage("start");
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.node.port.postMessage("stop");
  }
  async dispose() {
    this.source.disconnect();
    this.node.disconnect();
    await this.context.close();
  }
}
export function needsPCMRecording() {
  return (
    "__TAURI_INTERNALS__" in window ||
    (/AppleWebKit/.test(navigator.userAgent) &&
      !/(Chrome|Chromium|Edg)/.test(navigator.userAgent))
  );
}
