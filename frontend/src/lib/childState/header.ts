import type { ChildState } from './engine';

// How the session header's child state is chosen, and how the recorded
// session events turn back into timelines for the report.
//
//   Header = therapist override if set, else the band engine's state
//   (which the engine withholds until thresholds are clinically signed
//   off), else no state at all. A missing state is never shown as
//   "Regulated".
//
//   Events (session_events):
//     therapist state_change            override set to state_value
//     therapist state_override_cleared  override ended, back to auto
//     band state_change                 engine state; null = no state

export type ClaimState = 'regulated' | 'amber' | 'dysregulated';

export const isClaimState = (s: ChildState | string | null | undefined): s is ClaimState =>
  s === 'regulated' || s === 'amber' || s === 'dysregulated';

export interface StateOverride {
  state: ClaimState;
  at: number; // epoch ms
}

/** The engine's state if it is a claim the product may show, else null. */
export function bandClaim(state: ChildState | undefined, stale: boolean): ClaimState | null {
  return !stale && isClaimState(state) ? state : null;
}

export function displayedChildState(override: StateOverride | null, band: ClaimState | null): ClaimState | null {
  return override?.state ?? band;
}

export interface StateEventRow {
  event_type: string;
  state_value: string | null;
  recorded_at: string;
  source?: string | null;
}

const isTherapist = (e: StateEventRow) => (e.source ?? 'therapist') === 'therapist';

/** The override in force after these events (for resuming after a refresh). */
export function overrideFromEvents(events: StateEventRow[]): StateOverride | null {
  let current: StateOverride | null = null;
  for (const e of sortByTime(events)) {
    if (!isTherapist(e)) continue;
    if (e.event_type === 'state_override_cleared') current = null;
    else if (e.event_type === 'state_change' && isClaimState(e.state_value)) {
      current = { state: e.state_value, at: new Date(e.recorded_at).getTime() };
    }
  }
  return current;
}

export interface StateRegion {
  startSec: number;
  endSec: number;
  state: ClaimState;
}

/**
 * Regions where a state was in force, for one source. Therapist regions
 * end at "back to auto"; band regions end when the band loses its state.
 * Gaps (no state) are simply not covered by any region.
 */
export function stateRegions(
  events: StateEventRow[],
  source: 'therapist' | 'band',
  sessionStartMs: number,
  durationSec: number,
): StateRegion[] {
  const regions: StateRegion[] = [];
  let open: { state: ClaimState; startSec: number } | null = null;
  const close = (atSec: number) => {
    if (open && atSec > open.startSec) regions.push({ startSec: open.startSec, endSec: atSec, state: open.state });
    open = null;
  };

  for (const e of sortByTime(events)) {
    if ((source === 'therapist') !== isTherapist(e)) continue;
    if (e.event_type !== 'state_change' && e.event_type !== 'state_override_cleared') continue;
    const atSec = clamp((new Date(e.recorded_at).getTime() - sessionStartMs) / 1000, 0, durationSec);
    close(atSec);
    if (e.event_type === 'state_change' && isClaimState(e.state_value)) {
      open = { state: e.state_value, startSec: atSec };
    }
  }
  close(durationSec);
  return regions;
}

export type TimelineSegment = { state: ClaimState | 'none'; durationSec: number };

/** Regions laid end to end over the whole session, gaps as 'none'. */
export function timelineSegments(regions: StateRegion[], durationSec: number): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  let at = 0;
  for (const r of regions) {
    if (r.startSec > at) segments.push({ state: 'none', durationSec: r.startSec - at });
    segments.push({ state: r.state, durationSec: r.endSec - r.startSec });
    at = r.endSec;
  }
  if (durationSec > at) segments.push({ state: 'none', durationSec: durationSec - at });
  return segments;
}

function sortByTime<T extends StateEventRow>(events: T[]): T[] {
  return [...events].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
