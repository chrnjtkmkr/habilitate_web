import { openDB as idbOpen, type IDBPDatabase } from 'idb';

const DB_NAME = 'habilitate-measurement';
const DB_VERSION = 1;
const STORE = 'engagement_samples';

export interface LocalSample {
  id: string;
  session_id: string;
  session_activity_id: string;
  recorded_at: string;
  head_pose: { yaw: number; pitch: number; roll: number } | null;
  motion_score: number | null;
  audio_activity_flag: boolean;
  composite_score: number | null;
  sampling_version: string;
  child_voice_count: number;
  adult_voice_count: number;
  voice_state: 'child_speaking' | 'adult_speaking' | 'silence' | 'noise';
  sync_status: 'pending' | 'synced' | 'failed';
  synced_at?: string;
  failure_reason?: string;
  pending_activity_link?: boolean;
}

let dbInstance: IDBPDatabase | null = null;

export async function openMeasurementDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await idbOpen(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('session_id', 'session_id');
        store.createIndex('recorded_at', 'recorded_at');
        store.createIndex('sync_status', 'sync_status');
      }
    },
  });
  return dbInstance;
}

export async function enqueueSample(sample: Omit<LocalSample, 'sync_status'>) {
  const db = await openMeasurementDB();
  const row: LocalSample = { ...sample, sync_status: 'pending' };
  await db.put(STORE, row);
}

export async function getPendingSamples(limit = 200): Promise<LocalSample[]> {
  const db = await openMeasurementDB();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.store.index('sync_status');
  const results: LocalSample[] = [];
  let cursor = await index.openCursor(IDBKeyRange.only('pending'));
  while (cursor && results.length < limit) {
    results.push(cursor.value as LocalSample);
    cursor = await cursor.continue();
  }
  // Sort oldest first by recorded_at
  results.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  return results;
}

export async function markSynced(ids: string[]) {
  const db = await openMeasurementDB();
  const tx = db.transaction(STORE, 'readwrite');
  const now = new Date().toISOString();
  for (const id of ids) {
    const row = (await tx.store.get(id)) as LocalSample | undefined;
    if (row) {
      row.sync_status = 'synced';
      row.synced_at = now;
      await tx.store.put(row);
    }
  }
  await tx.done;
}

export async function markFailed(ids: string[], reason: string) {
  const db = await openMeasurementDB();
  const tx = db.transaction(STORE, 'readwrite');
  for (const id of ids) {
    const row = (await tx.store.get(id)) as LocalSample | undefined;
    if (row) {
      row.sync_status = 'failed';
      row.failure_reason = reason;
      await tx.store.put(row);
    }
  }
  await tx.done;
}

export async function countPending(): Promise<number> {
  const db = await openMeasurementDB();
  return db.countFromIndex(STORE, 'sync_status', IDBKeyRange.only('pending'));
}

export async function clearAll() {
  const db = await openMeasurementDB();
  await db.clear(STORE);
}

// Backfill session_activity_id on samples that were recorded before
// the first session_activity row was created.
export async function backfillSessionActivityId(sessionId: string, sessionActivityId: string) {
  const db = await openMeasurementDB();
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.store.index('session_id');
  let cursor = await index.openCursor(IDBKeyRange.only(sessionId));
  while (cursor) {
    const row = cursor.value as LocalSample;
    if (row.pending_activity_link) {
      row.session_activity_id = sessionActivityId;
      row.pending_activity_link = false;
      await cursor.update(row);
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Deletes synced rows older than 24 hours
export async function cleanupSynced() {
  const db = await openMeasurementDB();
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.store.index('sync_status');
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let cursor = await index.openCursor(IDBKeyRange.only('synced'));
  while (cursor) {
    const row = cursor.value as LocalSample;
    if (row.synced_at && row.synced_at < cutoff) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
