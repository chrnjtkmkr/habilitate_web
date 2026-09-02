/**
 * 5-second engagement_samples adapter for the CV pipeline.
 *
 * Reads CVMetrics from CVPipeline every 5 seconds and writes a row
 * to the engagement_samples table via the existing IndexedDB + Supabase
 * offline-first sync pipeline (db.ts / sync.ts).
 */

import type { CVMetrics } from '../../cv/CVPipeline';
import { enqueueSample, backfillSessionActivityId, type LocalSample } from './db';
import * as sync from './sync';

const SAMPLE_INTERVAL_MS = 5000;
export const SAMPLING_VERSION = 'cv-pipeline-v2';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Composite engagement score from CVMetrics.
 * Formula: (social_gaze% * 0.4) + (voice_rate * 0.3) + (hand_active% * 0.3)
 * All inputs normalized to 0-1.
 */
export function computeCompositeScore(metrics: CVMetrics, sessionMinutes: number): number {
  const gazeComponent = (metrics.social_gaze_percentage / 100) * 0.4;
  const voiceComponent = clamp01(metrics.total_child_sounds / Math.max(1, sessionMinutes * 8)) * 0.3;
  const handComponent = (metrics.hand_active_percentage / 100) * 0.3;
  return clamp01(gazeComponent + voiceComponent + handComponent);
}

function computeMotionScore(metrics: CVMetrics): number {
  const handActive = metrics.hand_active_percentage / 100;
  const eventRate = clamp01((metrics.reaching_events + metrics.grasp_events) / 10);
  return clamp01(handActive * 0.7 + eventRate * 0.3);
}

export class CVAdapter {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private sessionStartTime = 0;
  private sessionId = '';
  private sessionActivityId = '';
  private getMetrics: (() => CVMetrics) | null = null;
  private isPaused = false;
  private prevChildSounds = 0;
  private prevAdultSounds = 0;

  start(opts: {
    sessionId: string;
    sessionActivityId: string;
    getMetrics: () => CVMetrics;
  }) {
    this.sessionId = opts.sessionId;
    this.sessionActivityId = opts.sessionActivityId;
    this.getMetrics = opts.getMetrics;
    this.sessionStartTime = Date.now();
    this.isPaused = false;

    sync.start();

    this.intervalId = setInterval(() => {
      if (!this.isPaused) this.takeSample();
    }, SAMPLE_INTERVAL_MS);
  }

  /** Update the activity ID for future samples (activity transitions) */
  updateSessionActivityId(id: string) {
    this.sessionActivityId = id;
  }

  /** Legacy: backfill early samples that had no activity id.
   *  No longer needed since adapter now defers start until a real ID is available.
   *  Kept for clearing any stale IndexedDB rows from prior broken sessions. */
  async backfillActivityId(sessionActivityId: string) {
    this.sessionActivityId = sessionActivityId;
    await backfillSessionActivityId(this.sessionId, sessionActivityId);
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    sync.stop();
  }

  private async takeSample() {
    if (!this.getMetrics) return;
    const metrics = this.getMetrics();
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;

    const composite = computeCompositeScore(metrics, sessionMinutes);
    const motion = computeMotionScore(metrics);

    // Windowed voice_state: did child or adult speak in this 5-second window?
    const childSpoke = metrics.total_child_sounds > this.prevChildSounds;
    const adultSpoke = metrics.adult_voice_count > this.prevAdultSounds;
    this.prevChildSounds = metrics.total_child_sounds;
    this.prevAdultSounds = metrics.adult_voice_count;

    let voiceState: 'child_speaking' | 'adult_speaking' | 'silence' | 'noise';
    if (childSpoke && adultSpoke) {
      voiceState = metrics.voice_state as typeof voiceState;
      if (voiceState === 'silence' || voiceState === 'noise') voiceState = 'child_speaking';
    } else if (childSpoke) {
      voiceState = 'child_speaking';
    } else if (adultSpoke) {
      voiceState = 'adult_speaking';
    } else {
      voiceState = 'silence';
    }

    const sample: Omit<LocalSample, 'sync_status'> = {
      id: crypto.randomUUID(),
      session_id: this.sessionId,
      session_activity_id: this.sessionActivityId,
      recorded_at: new Date().toISOString(),
      head_pose: {
        yaw: metrics.face_yaw_degrees,
        pitch: metrics.face_pitch_degrees,
        roll: 0,
      },
      motion_score: motion,
      audio_activity_flag: voiceState !== 'silence',
      composite_score: composite,
      sampling_version: SAMPLING_VERSION,
      child_voice_count: metrics.total_child_sounds,
      adult_voice_count: metrics.adult_voice_count,
      voice_state: voiceState,
      pending_activity_link: false,
    };

    await enqueueSample(sample);
  }
}
