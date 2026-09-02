/**
 * ChildVoiceTracker — automatically counts child vocalizations
 * using pitch-based speaker separation.
 *
 * NO FACILITATOR INPUT REQUIRED.
 *
 * How it works:
 * 1. PitchDetector runs every 50ms, classifying audio as child/adult/silence/noise
 * 2. A "child vocalization episode" starts when child_voice is detected for >200ms
 * 3. Episode ends when child_voice is absent for >500ms
 * 4. After adult_voice segment, if child_voice follows within 5s -> "prompted vocalization"
 * 5. Otherwise -> "spontaneous vocalization"
 *
 * Calibration: first 5 seconds baseline noise measurement
 */

import { PitchDetector } from './PitchDetector';
import type { PitchResult } from './PitchDetector';

export interface ChildVoiceMetrics {
  total_child_sounds: number;
  prompted_sounds: number;
  spontaneous_sounds: number;
  avg_vocalization_duration_ms: number;
  avg_prompt_response_latency_ms: number;
  adult_voice_count: number;
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

export class ChildVoiceTracker {
  private pitchDetector: PitchDetector;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private dataArray: Float32Array<ArrayBuffer> | null = null;
  private visibilityHandler: (() => void) | null = null;

  // State tracking
  private childSpeakingStart: number | null = null;
  private childSilentSince: number | null = null;
  private adultSpeakingEnd: number | null = null;
  private episodes: VoiceEpisode[] = [];
  private lastPitch: PitchResult | null = null;
  private adultVoiceCount: number = 0;
  private inAdultVoice: boolean = false;

  // Calibration
  private isCalibrating: boolean = true;
  private calibrationStart: number = 0;
  private calibrationSamples: number[] = [];

  // Thresholds
  private minEpisodeDuration: number = 200;
  private silenceGap: number = 500;
  private promptWindow: number = 5000;

  // Subscriber callback
  private onUpdateCallback: ((metrics: ChildVoiceMetrics) => void) | null = null;
  private lastEmitLogTime: number = 0;

  constructor() {
    this.pitchDetector = new PitchDetector();
  }

  public setOnUpdate(callback: (metrics: ChildVoiceMetrics) => void): void {
    this.onUpdateCallback = callback;
  }

  /**
   * @param micStream - MediaStream with audio tracks from getUserMedia
   * @param audioCtx - AudioContext created and resumed inside a user gesture
   *                   (click handler) so it starts in 'running' state.
   */
  async initialize(micStream: MediaStream, audioCtx: AudioContext): Promise<void> {
    this.stream = micStream;
    this.audioContext = audioCtx;

    // The context should already be running (resumed inside the gesture),
    // but if the browser suspended it between creation and now, try again.
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

    // When the tab loses focus, the browser may suspend the AudioContext.
    // Re-resume it when the tab becomes visible again so a therapist
    // switching apps mid-session does not lose audio measurement.
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    console.log('[ChildVoiceTracker] initialized — sampleRate:', this.audioContext.sampleRate, 'state:', this.audioContext.state, 'tracks:', micStream.getAudioTracks().length);
  }

  process(): ChildVoiceMetrics {
    if (!this.analyser || !this.dataArray) {
      return this.emptyMetrics();
    }

    this.analyser.getFloatTimeDomainData(this.dataArray);
    const pitch = this.pitchDetector.detectPitch(this.dataArray);
    this.lastPitch = pitch;
    const now = Date.now();

    // Calibration phase (first 5 seconds)
    if (this.isCalibrating) {
      this.calibrationSamples.push(pitch.rmsLevel);
      if (now - this.calibrationStart > 5000) {
        this.isCalibrating = false;
        const avgRms = this.calibrationSamples.reduce((a, b) => a + b, 0) / (this.calibrationSamples.length || 1);
        this.pitchDetector.setSilenceThreshold(Math.max(avgRms * 1.5, 0.003));
        console.log('[ChildVoiceTracker] Calibration complete. Baseline RMS:', avgRms.toFixed(5));
      }
    }

    const rawState = pitch.classification;
    const isChild = rawState === 'child_voice' || rawState === 'child' || rawState === 'child_speaking';
    const isAdult = rawClassMatch(rawState, ['adult_voice', 'adult', 'adult_speaking']);

    // State machine & segment tracking
    if (isChild) {
      this.handleChildVoice(now);
      this.inAdultVoice = false;
    } else if (isAdult) {
      if (!this.inAdultVoice) {
        this.adultVoiceCount++;
        this.inAdultVoice = true;
      }
      this.handleAdultVoice(now);
    } else {
      this.inAdultVoice = false;
      this.handleSilence(now);
    }

    const metrics = this.getMetrics(pitch);

    // Invoke subscriber callback if set
    if (this.onUpdateCallback) {
      this.onUpdateCallback(metrics);
    }

    // Debug Console Logger Bridge
    if (now - this.lastEmitLogTime > 500) {
      this.lastEmitLogTime = now;
      console.log('[VoiceTracker emit]:', {
        state: metrics.current_state,
        childCount: metrics.total_child_sounds,
        adultCount: metrics.adult_voice_count,
        rms: metrics.audio_level.toFixed(4),
      });
    }

    return metrics;
  }


  private handleChildVoice(now: number): void {
    if (this.childSpeakingStart === null) {
      this.childSpeakingStart = now;
    }
    this.childSilentSince = null;
  }

  private handleAdultVoice(now: number): void {
    this.adultSpeakingEnd = now;
    this.maybeEndChildEpisode(now);
  }

  private handleSilence(now: number): void {
    if (this.childSpeakingStart !== null && this.childSilentSince === null) {
      this.childSilentSince = now;
    }
    this.maybeEndChildEpisode(now);
  }

  private maybeEndChildEpisode(now: number): void {
    if (this.childSpeakingStart !== null && this.childSilentSince !== null) {
      if (now - this.childSilentSince > this.silenceGap) {
        const duration = this.childSilentSince - this.childSpeakingStart;
        if (duration >= this.minEpisodeDuration) {
          const isPrompted = this.adultSpeakingEnd !== null &&
            (this.childSpeakingStart - this.adultSpeakingEnd) < this.promptWindow;
          const latency = isPrompted
            ? this.childSpeakingStart - this.adultSpeakingEnd!
            : null;

          this.episodes.push({
            start: this.childSpeakingStart,
            end: this.childSilentSince,
            duration_ms: duration,
            type: isPrompted ? 'prompted' : 'spontaneous',
            latency_ms: latency,
          });
        }
        this.childSpeakingStart = null;
        this.childSilentSince = null;
      }
    }
  }

  getMetrics(pitch?: PitchResult): ChildVoiceMetrics {
    const p = pitch || this.lastPitch;
    const prompted = this.episodes.filter((e) => e.type === 'prompted');
    const spontaneous = this.episodes.filter((e) => e.type === 'spontaneous');
    const allDurations = this.episodes.map((e) => e.duration_ms);
    const promptedLatencies = prompted
      .filter((e) => e.latency_ms !== null)
      .map((e) => e.latency_ms!);

    const rawClass = p?.classification || 'silence';
    const isChildState = rawClass === 'child_voice' || rawClass === 'child' || rawClass === 'child_speaking';
    const isAdultState = rawClassMatch(rawClass, ['adult_voice', 'adult', 'adult_speaking']);

    const activeChildSound = (this.childSpeakingStart !== null && (Date.now() - this.childSpeakingStart >= this.minEpisodeDuration)) ? 1 : 0;

    return {
      total_child_sounds: this.episodes.length + activeChildSound,

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
      current_state: isChildState
        ? 'child_speaking'
        : isAdultState
          ? 'adult_speaking'
          : 'silence',
      audio_level: p?.rmsLevel || 0,
      current_pitch_hz: p?.frequency || 0,
      pitch_classification: rawClass,
      pitch_confidence: p?.confidence || 0,
    };
  }

  reset(): void {
    this.episodes = [];
    this.childSpeakingStart = null;
    this.childSilentSince = null;
    this.adultSpeakingEnd = null;
    this.adultVoiceCount = 0;
    this.inAdultVoice = false;
  }

  stop(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
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

function rawClassMatch(val: string, targets: string[]): boolean {
  return targets.includes(val);
}

