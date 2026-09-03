/**
 * ResponseToNameDetector — detects plausible "name was called" moments
 * during a live session and emits candidate probe data.
 *
 * Algorithm:
 * 1. Debounced speech detection: adult_speaking must be sustained for
 *    MIN_SPEECH_MS, then silence must last MIN_SILENCE_MS, before a
 *    speech-end fires. Brief pitch-detector blips are rejected.
 * 2. Precondition gate at speech-end:
 *    - face NOT visible → child turned away → OPEN window (valid trial)
 *    - face visible, |yaw| >= validAngleDeg → looking away → OPEN window
 *    - face visible, |yaw| < validAngleDeg → already oriented → SKIP
 * 3. Within window: face becomes visible AND |yaw| < validAngleDeg → LOOKED
 * 4. Window expires without qualifying turn → DID_NOT_LOOK
 *
 * Pure logic class — no React, no Supabase. SessionRun calls tick() per frame.
 */

import type { CVMetrics } from './CVPipeline';

export interface RTNCandidate {
  capturedAt: string;
  looked: boolean;
  latencyMs: number | null;
}

export interface RTNConfig {
  windowMs: number;
  validAngleDeg: number;
  debug?: boolean;
}

const MAX_CANDIDATES_PER_SESSION = 30;
const COOLDOWN_MS = 5000;

// Speech debounce: reject blips shorter than these durations.
// 150ms floor catches a short spoken name ("Rahul!") which is ~150-400ms.
// Too low risks triggering on 1-frame noise; too high rejects real name-calls.
const MIN_SPEECH_MS = 100;
const MIN_SILENCE_AFTER_SPEECH_MS = 150;

type State = 'idle' | 'watching' | 'cooldown';

export class ResponseToNameDetector {
  private config: RTNConfig;
  private state: State = 'idle';
  private speechEndTime = 0;
  private cooldownUntil = 0;
  private _candidateCount = 0;
  private _speechEndCount = 0;
  private _rejectedBlips = 0;

  // Debounce state
  private adultSpeakingStart: number | null = null;
  private adultSpeakingSustained = false; // true once speaking >= MIN_SPEECH_MS
  private silenceStart: number | null = null;

  private debug: boolean;

  constructor(config: RTNConfig) {
    this.config = config;
    this.debug = config.debug ?? false;
  }

  private log(msg: string): void {
    if (this.debug) console.log(msg);
  }

  get candidateCount(): number {
    return this._candidateCount;
  }

  get speechEndCount(): number {
    return this._speechEndCount;
  }

  get rejectedBlips(): number {
    return this._rejectedBlips;
  }

  // Trigger name-call window explicitly (e.g. via speech recognition or adult voice end)
  triggerNameCall(): void {
    if (this._candidateCount >= MAX_CANDIDATES_PER_SESSION) return;
    const now = Date.now();
    this.state = 'watching';
    this.speechEndTime = now;
    this.log(`[RTN] name-call triggered | OPENED (${this.config.windowMs}ms window)`);
  }

  // Called every frame (~15fps) with latest CVMetrics.
  // Returns a candidate when a detection window closes, null otherwise.
  tick(metrics: CVMetrics): RTNCandidate | null {
    const now = Date.now();
    const voiceState = metrics.voice_state;
    const faceVisible = metrics.face_detected && metrics.face_state !== 'not_visible';
    const yaw = faceVisible ? Math.abs(metrics.face_yaw_degrees) : null;

    // --- Speech debounce ---
    const speechEndEvent = this.updateSpeechDebounce(voiceState, now);

    let result: RTNCandidate | null = null;

    switch (this.state) {
      case 'idle': {
        if (speechEndEvent) {
          this._speechEndCount++;
          if (this._candidateCount >= MAX_CANDIDATES_PER_SESSION) {
            this.log(`[RTN] speech-end detected but at session cap (${this._candidateCount}), skipping`);
            break;
          }

          // PRECONDITION GATE: Open 3s observation window on speech-end
          this.log(`[RTN] speech-end detected | OPENED (${this.config.windowMs}ms window)`);
          this.state = 'watching';
          this.speechEndTime = now;
        }
        break;
      }

      case 'watching': {
        const elapsed = now - this.speechEndTime;

        // LOOKED = face visible AND |yaw| < threshold (after min reaction time of 150ms)
        if (elapsed >= 150 && faceVisible && yaw! < this.config.validAngleDeg) {
          result = {
            capturedAt: new Date(this.speechEndTime).toISOString(),
            looked: true,
            latencyMs: elapsed,
          };
          this.log(`[RTN] LOOKED | latency=${elapsed}ms | face reappeared at yaw=${metrics.face_yaw_degrees.toFixed(1)}°`);
          this._candidateCount++;
          this.state = 'cooldown';
          this.cooldownUntil = now + COOLDOWN_MS;
          break;
        }

        // Window expired
        if (elapsed >= this.config.windowMs) {
          result = {
            capturedAt: new Date(this.speechEndTime).toISOString(),
            looked: false,
            latencyMs: null,
          };
          const faceInfo = faceVisible
            ? `face=visible yaw=${metrics.face_yaw_degrees.toFixed(1)}°`
            : 'face=NOT visible';
          this.log(`[RTN] DID_NOT_LOOK | window expired after ${elapsed}ms | ${faceInfo}`);
          this._candidateCount++;
          this.state = 'cooldown';
          this.cooldownUntil = now + COOLDOWN_MS;
        }
        break;
      }

      case 'cooldown': {
        if (now >= this.cooldownUntil) {
          this.state = 'idle';
        }
        break;
      }
    }

    return result;
  }

  // Returns true when a debounced speech-end event fires
  private updateSpeechDebounce(voiceState: string, now: number): boolean {
    if (voiceState === 'adult_speaking') {
      // Currently speaking
      this.silenceStart = null;
      if (this.adultSpeakingStart === null) {
        this.adultSpeakingStart = now;
        this.adultSpeakingSustained = false;
      } else if (!this.adultSpeakingSustained && now - this.adultSpeakingStart >= MIN_SPEECH_MS) {
        this.adultSpeakingSustained = true;
      }
      return false;
    }

    // Not speaking
    if (this.adultSpeakingStart !== null && !this.adultSpeakingSustained) {
      // Speech was too short — reject blip
      this._rejectedBlips++;
      this.adultSpeakingStart = null;
      this.silenceStart = null;
      return false;
    }

    if (this.adultSpeakingSustained) {
      // Real speech happened, now waiting for sustained silence
      if (this.silenceStart === null) {
        this.silenceStart = now;
      }
      if (now - this.silenceStart >= MIN_SILENCE_AFTER_SPEECH_MS) {
        // Debounced speech-end
        this.adultSpeakingStart = null;
        this.adultSpeakingSustained = false;
        this.silenceStart = null;
        return true;
      }
    }

    return false;
  }

  reset(): void {
    this.state = 'idle';
    this.speechEndTime = 0;
    this.cooldownUntil = 0;
    this._candidateCount = 0;
    this._speechEndCount = 0;
    this._rejectedBlips = 0;
    this.adultSpeakingStart = null;
    this.adultSpeakingSustained = false;
    this.silenceStart = null;
  }
}
