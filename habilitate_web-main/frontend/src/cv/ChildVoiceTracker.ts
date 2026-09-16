/**
 * ChildVoiceTracker — counts child vocalizations and adult voice segments
 * using pitch-based speaker separation driven by PitchDetector.
 *
 * Architecture:
 *   • PitchDetector provides per-frame classification at 20 Hz (50 ms frames).
 *   • AudioSegmentTracker validates a speaker event after exactly three
 *     matching 50 ms frames (150 ms), then counts it once per phrase.
 *   • Prompted vs spontaneous detection preserved:
 *       – Child utterance that starts within 5 s of the last adult segment → prompted.
 *   • Calibration: first 5 s baseline RMS → dynamic silence threshold.
 *   • setOnUpdate() callback is invoked every processed frame so CVPipeline
 *     can push metric updates at audio rate (20 Hz) instead of visual rate (15 fps).
 */

import { PitchDetector } from './PitchDetector';
import type { PitchResult } from './PitchDetector';
import { AudioSegmentTracker } from './AudioSegmentTracker';

export interface ChildVoiceMetrics {
  total_child_sounds: number;
  prompted_sounds: number;
  spontaneous_sounds: number;
  avg_vocalization_duration_ms: number;
  avg_prompt_response_latency_ms: number;
  adult_voice_count: number;
  /** Mapped from frame labels to the UI-compatible speaking state. */
  current_state: 'child_speaking' | 'adult_speaking' | 'silence' | 'noise';
  audio_level: number;
  current_pitch_hz: number;
  pitch_classification: string;
  pitch_confidence: number;
}

interface VoiceEpisode {
  start: number;
  end: number;
  duration_ms: number;
  type: 'prompted' | 'spontaneous';
  latency_ms: number | null;
}

function isChildClass(c: string): boolean {
  return c === 'child_voice' || c === 'child_speaking';
}
function isAdultClass(c: string): boolean {
  return c === 'adult_male' || c === 'adult_female'
      || c === 'adult_voice' || c === 'adult_speaking';
}

// ─────────────────────────────────────────────────────────────────────────────
//  ChildVoiceTracker
// ─────────────────────────────────────────────────────────────────────────────

export class ChildVoiceTracker {
  private pitchDetector: PitchDetector;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private dataArray: Float32Array<ArrayBuffer> | null = null;
  private visibilityHandler: (() => void) | null = null;

  // Utterance segmentation engine
  private segmentTracker = new AudioSegmentTracker();

  // Episode store (child utterances only, for prompted/spontaneous breakdown)
  private episodes: VoiceEpisode[] = [];

  // Counters driven exclusively by AudioSegmentTracker closures
  private adultVoiceCount = 0;

  // Prompt detection: timestamp when last adult segment ended
  private adultSpeakingEnd: number | null = null;
  private readonly promptWindow = 5000; // ms

  // Last classified frame
  private lastPitch: PitchResult | null = null;

  // Calibration
  private isCalibrating = true;
  private calibrationStart = 0;
  private calibrationSamples: number[] = [];

  // Subscriber
  private onUpdateCallback: ((metrics: ChildVoiceMetrics) => void) | null = null;

  constructor() {
    this.pitchDetector = new PitchDetector();
    this.wireSegmentTracker();
  }

  // ── Subscriber ──────────────────────────────────────────────────────────

  public setOnUpdate(callback: (metrics: ChildVoiceMetrics) => void): void {
    this.onUpdateCallback = callback;
  }

  // ── Initialization ──────────────────────────────────────────────────────

  async initialize(micStream: MediaStream, audioCtx: AudioContext): Promise<void> {
    this.stream = micStream;
    this.audioContext = audioCtx;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(micStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.sourceNode.connect(this.analyser);
    this.dataArray = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;

    this.pitchDetector = new PitchDetector(this.audioContext.sampleRate);
    this.calibrationStart = Date.now();
    this.isCalibrating = true;
    this.calibrationSamples = [];

    // Re-resume AudioContext when tab regains focus
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    console.log('[ChildVoiceTracker] initialized — sampleRate:', this.audioContext.sampleRate,
      'state:', this.audioContext.state, 'tracks:', micStream.getAudioTracks().length);
  }

  // ── Per-frame processing ─────────────────────────────────────────────────

  process(): ChildVoiceMetrics {
    if (!this.analyser || !this.dataArray) return this.emptyMetrics();

    this.analyser.getFloatTimeDomainData(this.dataArray);
    const pitch = this.pitchDetector.detectPitch(this.dataArray);
    this.lastPitch = pitch;
    const now = Date.now();

    // Calibration phase — first 5 s
    if (this.isCalibrating) {
      this.calibrationSamples.push(pitch.rmsLevel);
      if (now - this.calibrationStart > 5000) {
        this.isCalibrating = false;
        const avgRms = this.calibrationSamples.reduce((a, b) => a + b, 0) / (this.calibrationSamples.length || 1);
        this.pitchDetector.setSilenceThreshold(Math.max(avgRms * 1.5, 0.003));
        console.log('[ChildVoiceTracker] Calibration complete. Baseline RMS:', avgRms.toFixed(5));
      }
    }

    // Feed frame to segment tracker
    this.segmentTracker.processFrame(pitch);

    // Build metrics and push to subscriber
    const metrics = this.getMetrics(pitch);
    if (this.onUpdateCallback) this.onUpdateCallback(metrics);

    // Debug log (throttled every 500 ms)
    console.log('[VoiceTracker State Received]:', pitch.classification,
      'Current Counts:', { childCount: metrics.total_child_sounds, adultCount: metrics.adult_voice_count });

    return metrics;
  }

  // ── Metrics snapshot ─────────────────────────────────────────────────────

  getMetrics(pitch?: PitchResult): ChildVoiceMetrics {
    const p = pitch ?? this.lastPitch;
    const prompted = this.episodes.filter(e => e.type === 'prompted');
    const spontaneous = this.episodes.filter(e => e.type === 'spontaneous');
    const allDurations = this.episodes.map(e => e.duration_ms);
    const promptedLatencies = prompted.filter(e => e.latency_ms !== null).map(e => e.latency_ms!);

    const rawClass: string = p?.classification ?? 'silence';
    const isChildState = isChildClass(rawClass);
    const isAdultState = isAdultClass(rawClass);

    // Map fine-grained labels to backward-compatible current_state
    let currentState: ChildVoiceMetrics['current_state'] = 'silence';
    if (isChildState) currentState = 'child_speaking';
    else if (isAdultState) currentState = 'adult_speaking';
    else if (rawClass === 'noise') currentState = 'noise';

    return {
      total_child_sounds: this.episodes.length,
      prompted_sounds: prompted.length,
      spontaneous_sounds: spontaneous.length,
      avg_vocalization_duration_ms:
        allDurations.length > 0
          ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length
          : 0,
      avg_prompt_response_latency_ms:
        promptedLatencies.length > 0
          ? promptedLatencies.reduce((a, b) => a + b, 0) / promptedLatencies.length
          : 0,
      adult_voice_count: this.adultVoiceCount,
      current_state: currentState,
      audio_level: p?.rmsLevel ?? 0,
      current_pitch_hz: p?.frequency ?? 0,
      pitch_classification: rawClass,
      pitch_confidence: p?.confidence ?? 0,
    };
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  reset(): void {
    this.segmentTracker.forceClose();
    this.episodes = [];
    this.adultVoiceCount = 0;
    this.adultSpeakingEnd = null;
  }

  stop(): void {
    this.segmentTracker.forceClose();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.sourceNode) { this.sourceNode.disconnect(); this.sourceNode = null; }
    if (this.audioContext) { this.audioContext.close().catch(() => {}); this.audioContext = null; }
    this.analyser = null;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  /** Wire AudioSegmentTracker callbacks → episode store + counters. */
  private wireSegmentTracker(): void {
    this.segmentTracker.onChildSegment = (startMs, endMs) => {
      const duration = endMs - startMs;
      const isPrompted = this.adultSpeakingEnd !== null
        && (startMs - this.adultSpeakingEnd) < this.promptWindow;
      const latency = isPrompted ? startMs - this.adultSpeakingEnd! : null;

      this.episodes.push({
        start: startMs,
        end: endMs,
        duration_ms: duration,
        type: isPrompted ? 'prompted' : 'spontaneous',
        latency_ms: latency,
      });

      console.log('[VoiceTracker] child segment closed —',
        isPrompted ? 'PROMPTED' : 'SPONTANEOUS',
        `duration ${duration}ms`,
        `total_child_sounds=${this.episodes.length}`);
    };

    this.segmentTracker.onAdultSegment = (startMs, endMs) => {
      this.adultVoiceCount++;
      this.adultSpeakingEnd = endMs;
      console.log('[VoiceTracker] adult segment closed —',
        `duration ${endMs - startMs}ms`,
        `adult_voice_count=${this.adultVoiceCount}`);
    };
  }

  private emptyMetrics(): ChildVoiceMetrics {
    return {
      total_child_sounds: 0,
      prompted_sounds: 0,
      spontaneous_sounds: 0,
      avg_vocalization_duration_ms: 0,
      avg_prompt_response_latency_ms: 0,
      adult_voice_count: 0,
      current_state: 'silence',
      audio_level: 0,
      current_pitch_hz: 0,
      pitch_classification: 'calibrating',
      pitch_confidence: 0,
    };
  }
}
