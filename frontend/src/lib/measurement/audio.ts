/**
 * Voice activity detection from microphone audio.
 *
 * Uses Web Audio API AnalyserNode to compute RMS (root mean square) of the
 * audio signal. Maintains a rolling buffer of RMS samples at ~20Hz over the
 * last 5 seconds (100 values).
 *
 * audio_activity_flag = true if the max RMS in the window exceeds the
 * threshold (default 0.02 — above ambient but below normal speech).
 *
 * audio_level = mean RMS in the window, scaled to 0..1.
 */

const RMS_SAMPLE_RATE = 20; // Hz
const WINDOW_SECONDS = 5;
const BUFFER_SIZE = RMS_SAMPLE_RATE * WINDOW_SECONDS;

export interface AudioSample {
  audio_activity_flag: boolean;
  audio_level: number;
}

export class AudioProcessor {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Float32Array<ArrayBuffer> | null = null;
  private rmsBuffer: number[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private _threshold = 0.02;

  isReady = false;

  get threshold() {
    return this._threshold;
  }
  set threshold(v: number) {
    this._threshold = v;
  }

  async initialize(stream: MediaStream) {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        this.isReady = false;
        return;
      }

      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.source = this.context.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      this.dataArray = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;
      this.rmsBuffer = [];

      // Sample RMS at 20Hz
      this.intervalId = setInterval(() => {
        this.sampleRms();
      }, 1000 / RMS_SAMPLE_RATE);

      this.isReady = true;
    } catch {
      this.isReady = false;
    }
  }

  private sampleRms() {
    if (!this.analyser || !this.dataArray) return;

    this.analyser.getFloatTimeDomainData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);

    this.rmsBuffer.push(rms);
    if (this.rmsBuffer.length > BUFFER_SIZE) {
      this.rmsBuffer.shift();
    }
  }

  sample(): AudioSample {
    if (!this.isReady || this.rmsBuffer.length === 0) {
      return { audio_activity_flag: false, audio_level: 0 };
    }

    const maxRms = Math.max(...this.rmsBuffer);
    const meanRms = this.rmsBuffer.reduce((a, b) => a + b, 0) / this.rmsBuffer.length;

    return {
      audio_activity_flag: maxRms > this._threshold,
      // Scale mean RMS to roughly 0..1. Typical speech RMS is ~0.05-0.2
      audio_level: Math.min(1, meanRms * 10),
    };
  }

  // Returns real-time RMS for the VU meter (not windowed)
  currentLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getFloatTimeDomainData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    return Math.min(1, Math.sqrt(sum / this.dataArray.length) * 10);
  }

  dispose() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.source?.disconnect();
    this.context?.close();
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.rmsBuffer = [];
    this.isReady = false;
  }
}
