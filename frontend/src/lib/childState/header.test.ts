import { describe, expect, it } from 'vitest';

import {
  bandClaim,
  displayedChildState,
  overrideFromEvents,
  stateRegions,
  timelineSegments,
  type StateEventRow,
} from './header';

const START = Date.parse('2026-09-22T10:00:00Z');
const at = (sec: number) => new Date(START + sec * 1000).toISOString();
const ev = (sec: number, event_type: string, state_value: string | null, source = 'therapist'): StateEventRow =>
  ({ event_type, state_value, recorded_at: at(sec), source });

describe('header child state', () => {
  it('shows nothing, not Regulated, when there is no override and no band claim', () => {
    expect(displayedChildState(null, null)).toBeNull();
  });

  it('only shows band claims, and not when the data is stale', () => {
    expect(bandClaim('insufficient', false)).toBeNull();
    expect(bandClaim('establishing', false)).toBeNull();
    expect(bandClaim('amber', true)).toBeNull();
    expect(bandClaim('amber', false)).toBe('amber');
  });

  it('therapist override wins over the band', () => {
    expect(displayedChildState({ state: 'dysregulated', at: START }, 'regulated')).toBe('dysregulated');
    expect(displayedChildState(null, 'amber')).toBe('amber');
  });
});

describe('overrideFromEvents', () => {
  it('restores the last therapist override, ignoring band events', () => {
    const o = overrideFromEvents([
      ev(10, 'state_change', 'amber'),
      ev(20, 'state_change', 'regulated', 'band'),
    ]);
    expect(o).toEqual({ state: 'amber', at: START + 10_000 });
  });

  it('is cleared by back to auto', () => {
    expect(overrideFromEvents([ev(10, 'state_change', 'amber'), ev(30, 'state_override_cleared', null)])).toBeNull();
  });

  it('treats legacy rows without a source as therapist entries', () => {
    expect(overrideFromEvents([{ event_type: 'state_change', state_value: 'dysregulated', recorded_at: at(5) }])?.state)
      .toBe('dysregulated');
  });
});

describe('stateRegions / timelineSegments', () => {
  const events = [
    ev(60, 'state_change', 'amber'),
    ev(120, 'state_override_cleared', null),
    ev(0, 'state_change', 'regulated', 'band'),
    ev(90, 'state_change', null, 'band'),
    ev(150, 'state_change', 'dysregulated', 'band'),
  ];

  it('therapist line ends at back to auto', () => {
    expect(stateRegions(events, 'therapist', START, 300)).toEqual([{ startSec: 60, endSec: 120, state: 'amber' }]);
  });

  it('band line has a gap where the band lost its state, and runs to session end', () => {
    expect(stateRegions(events, 'band', START, 300)).toEqual([
      { startSec: 0, endSec: 90, state: 'regulated' },
      { startSec: 150, endSec: 300, state: 'dysregulated' },
    ]);
  });

  it('segments cover the whole session with gaps as none', () => {
    const segs = timelineSegments(stateRegions(events, 'therapist', START, 300), 300);
    expect(segs).toEqual([
      { state: 'none', durationSec: 60 },
      { state: 'amber', durationSec: 60 },
      { state: 'none', durationSec: 180 },
    ]);
  });

  it('a therapist state change replaces the previous one without a gap', () => {
    const r = stateRegions([ev(0, 'state_change', 'regulated'), ev(40, 'state_change', 'amber')], 'therapist', START, 100);
    expect(r).toEqual([
      { startSec: 0, endSec: 40, state: 'regulated' },
      { startSec: 40, endSec: 100, state: 'amber' },
    ]);
  });
});
