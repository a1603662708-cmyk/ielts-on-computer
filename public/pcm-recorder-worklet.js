// Audio-thread PCM capture. The main thread receives immutable half-second blocks.
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super(); this.ready = false; this.active = false; this.frames = 0; this.used = 0;
    this.capacity = Math.round(sampleRate * 0.5);
    this.buffer = new ArrayBuffer(this.capacity * 2); this.view = new DataView(this.buffer);
    this.port.onmessage = ({data}) => {
      if (data === 'start') this.active = true;
      if (data === 'stop') { this.active = false; this.flush(); this.port.postMessage({stopped:true}); }
    };
  }
  flush() {
    if (!this.used) return;
    const buffer = this.used === this.capacity ? this.buffer : this.buffer.slice(0, this.used * 2);
    this.frames += this.used;
    this.port.postMessage({buffer, frames:this.frames}, [buffer]);
    this.used = 0; this.buffer = new ArrayBuffer(this.capacity * 2); this.view = new DataView(this.buffer);
  }
  process(inputs) {
    if (!this.ready && inputs[0]?.[0]?.length) { this.ready = true; this.port.postMessage({ready:true}); }
    if (this.active && inputs[0]?.[0]) {
      const samples = inputs[0][0];
      for (let i=0;i<samples.length;i++) {
        const value = Math.max(-1,Math.min(1,samples[i]));
        this.view.setInt16(this.used*2,Math.round(value*(value<0?32768:32767)),true);
        if (++this.used === this.capacity) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('pcm-recorder', PCMRecorderProcessor);
