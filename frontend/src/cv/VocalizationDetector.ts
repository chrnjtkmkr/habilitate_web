/**
 * Detects child vocalizations using Web Audio API.
 * NOT speech recognition — just sound detection above threshold.
 *
 * Calibrates baseline noise for 3 seconds, then detects
 * vocalizations as RMS amplitude > baseline * 2.5.
 */

interface VocalizationEpisode {
  start: number;
  end: number;
}

const CALIBRATION_DURATION_MS = 3000;
const VOCALIZATION_MIN_DURATION_MS = 200;
const SILENCE_GAP_MS = 500;
const BASELINE_MULTIPLIER = 2.5;

export class VocalizationDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private dataArray: Float32Array<ArrayBuffer> | null = null;

  private threshold = 0;
  private isCalibrating = true;
  private calibrationStart = 0;
  private calibrationSamples: number[] = [];

  private vocalizing = false;
  private vocalizationCount = 0;
  private currentEpisodeStart: number | null = null;
  private lastAboveThreshold = 0;
  private episodes: VocalizationEpisode[] = [];

  async initialize(micStream: MediaStream): Promise<void> {
    this.stream = micStream;
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(micStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.dataArray = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;
    this.isCalibrating = true;
    this.calibrationStart = Date.now();
    this.calibrationSamples = [];
  }

  processAudio(): {
    vocalization_detected: boolean;
    vocalization_count: number;
    is_calibrating: boolean;
  } {
    if (!this.analyser || !this.dataArray) {
      return { vocalization_detected: false, vocalization_count: 0, is_calibrating: false };
    }

    const rms = this.getRms();
    const now = Date.now();

    // Calibration phase
    if (this.isCalibrating) {
      this.calibrationSamples.push(rms);
      if (now - this.calibrationStart >= CALIBRATION_DURATION_MS) {
        const avgRms =
          this.calibrationSamples.reduce((a, b) => a + b, 0) /
          this.calibrationSamples.length;
        this.threshold = Math.max(avgRms * BASELINE_MULTIPLIER, 0.01);
        this.isCalibrating = false;
      }
      return { vocalization_detected: false, vocalization_count: 0, is_calibrating: true };
    }

    const aboveThreshold = rms > this.threshold;

    if (aboveThreshold) {
      this.lastAboveThreshold = now;
      if (!this.vocalizing) {
        // Start potential vocalization
        this.currentEpisodeStart = now;
        this.vocalizing = true;
      }
    } else if (this.vocalizing) {
      // Check if silence gap exceeded
      if (now - this.lastAboveThreshold >= SILENCE_GAP_MS) {
        // Episode ended
        if (
          this.currentEpisodeStart &&
          this.lastAboveThreshold - this.currentEpisodeStart >= VOCALIZATION_MIN_DURATION_MS
        ) {
          this.vocalizationCount++;
          this.episodes.push({
            start: this.currentEpisodeStart,
            end: this.lastAboveThreshold,
          });
        }
        this.vocalizing = false;
        this.currentEpisodeStart = null;
      }
    }

    return {
      vocalization_detected: this.vocalizing,
      vocalization_count: this.vocalizationCount,
      is_calibrating: false,
    };
  }

  private getRms(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getFloatTimeDomainData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    return Math.sqrt(sum / this.dataArray.length);
  }

  getMetrics(): { vocalization_count: number; avg_duration_sec: number } {
    if (this.episodes.length === 0) {
      return { vocalization_count: this.vocalizationCount, avg_duration_sec: 0 };
    }
    const totalDuration = this.episodes.reduce(
      (sum, ep) => sum + (ep.end - ep.start),
      0
    );
    return {
      vocalization_count: this.vocalizationCount,
      avg_duration_sec: Math.round((totalDuration / this.episodes.length / 1000) * 10) / 10,
    };
  }

  stop(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
