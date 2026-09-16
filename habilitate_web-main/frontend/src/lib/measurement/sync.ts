import { supabase } from '../supabase';
import {
  getPendingSamples,
  markSynced,
  markFailed,
  cleanupSynced,
  type LocalSample,
} from './db';

const POLL_INTERVAL = 10_000;
const BATCH_SIZE = 100;

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastSyncAt: Date | null = null;

function toDbRow(s: LocalSample) {
  return {
    id: s.id,
    session_id: s.session_id,
    session_activity_id: s.session_activity_id,
    recorded_at: s.recorded_at,
    head_pose: s.head_pose,
    motion_score: s.motion_score,
    audio_activity_flag: s.audio_activity_flag,
    composite_score: s.composite_score,
    sampling_version: s.sampling_version,
    child_voice_count: s.child_voice_count,
    adult_voice_count: s.adult_voice_count,
    voice_state: s.voice_state,
  };
}

export async function flushNow() {
  if (!navigator.onLine) return;

  const allPending = await getPendingSamples(BATCH_SIZE);
  // Don't sync samples that still need a session_activity_id backfill
  const pending = allPending.filter((s) => !s.pending_activity_link);
  if (pending.length === 0) return;

  const rows = pending.map(toDbRow);
  const { error } = await supabase.from('engagement_samples').insert(rows);

  if (!error) {
    await markSynced(pending.map((s) => s.id));
    lastSyncAt = new Date();
    return;
  }

  console.error('[cv-sync] supabase insert failed:', error.message, 'code:', error.code, 'rows:', rows.length);

  // 4xx = client error (RLS, FK constraint, etc.) — mark as failed, don't retry
  const status = (error as { code?: string }).code;
  const isClientError = status && /^(2|4)/.test(status);
  if (isClientError || error.message?.includes('violates')) {
    await markFailed(
      pending.map((s) => s.id),
      error.message ?? 'Unknown client error',
    );
  }
  // 5xx or network failure — leave as pending for next cycle
}

function onOnline() {
  flushNow();
}

export function start() {
  // Run cleanup of old synced rows on startup
  cleanupSynced();

  if (intervalId) return;
  intervalId = setInterval(flushNow, POLL_INTERVAL);
  window.addEventListener('online', onOnline);
  // Attempt immediate sync
  flushNow();
}

export function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  window.removeEventListener('online', onOnline);
}

export function getLastSyncAt(): Date | null {
  return lastSyncAt;
}
