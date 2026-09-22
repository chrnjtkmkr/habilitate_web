import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import {
  BASELINE_WINDOW,
  ChildStateEngine,
  type SecondBin,
  type StateResult,
} from '../lib/childState/engine';

// Live child state from the band.
//
// The Edge Function writes one public.band_seconds row per second of
// device time; this hook receives each over a Supabase Realtime
// subscription (a push, not polling) and scores it with the engine in
// the browser. On mount the last ten minutes are loaded to warm the
// baseline, so a page reload does not restart the minute of
// "establishing".

type BandSecondRow = {
  second_at: string;
  gsr: number | null;
  temp: number | null;
  motion_energy: number | null;
  hr: number | null;
  hrv: number | null;
  flapping: boolean;
};

// No new second for this long: the band is not streaming (or the link
// dropped), and the last result must not be shown as current. Longer than
// the ~6 s gap of the Edge Function reconnect that still happens every
// 60-95 s, so the display does not flicker on each one.
const STALE_AFTER_MS = 10_000;

function toBin(row: BandSecondRow): SecondBin {
  return {
    secondAt: Date.parse(row.second_at),
    gsr: row.gsr,
    temp: row.temp,
    motionEnergy: row.motion_energy,
    hr: row.hr,
    hrv: row.hrv,
    flapping: row.flapping,
  };
}

export interface LiveChildState {
  result: StateResult | null;
  /** Band clock to screen: when the second ended vs when it was scored. */
  latencyMs: number | null;
  stale: boolean;
  realtimeStatus: string;
}

export function useChildState(bandId: string | null, ageYears: number | null): LiveChildState {
  const [result, setResult] = useState<StateResult | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState('IDLE');
  const [now, setNow] = useState(() => Date.now());
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!bandId) return;

    let cancelled = false;
    const engine = new ChildStateEngine(ageYears);
    // Rows that arrive while the history is still loading are held and
    // scored afterwards, in order.
    const pending: SecondBin[] = [];
    let seeded = false;

    const score = (bin: SecondBin) => {
      const r = engine.update(bin);
      setLastReceivedAt(Date.now());
      setResult(r);
      setLatencyMs(Date.now() - (bin.secondAt + 1000));
    };

    const channel = supabase
      .channel(`band-seconds:${bandId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'band_seconds', filter: `band_id=eq.${bandId}` },
        (payload) => {
          const bin = toBin(payload.new as BandSecondRow);
          if (seeded) score(bin);
          else pending.push(bin);
        },
      )
      .subscribe((status) => {
        if (!cancelled) setRealtimeStatus(status);
      });

    void (async () => {
      const since = new Date(Date.now() - BASELINE_WINDOW * 1000).toISOString();
      const { data, error } = await supabase
        .from('band_seconds')
        .select('second_at, gsr, temp, motion_energy, hr, hrv, flapping')
        .eq('band_id', bandId)
        .gte('second_at', since)
        .order('second_at', { ascending: true })
        .limit(BASELINE_WINDOW);
      if (cancelled) return;
      if (error) console.warn('[ChildState] could not load baseline history', error.message);
      engine.seed((data ?? []).map((row) => toBin(row as BandSecondRow)));
      seeded = true;
      for (const bin of pending.sort((a, b) => a.secondAt - b.secondAt)) score(bin);
    })();

    // Re-render once a second so staleness shows even when rows stop.
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(ticker);
      void supabase.removeChannel(channel);
      setLastReceivedAt(null);
      setResult(null);
      setLatencyMs(null);
      setRealtimeStatus('IDLE');
    };
  }, [bandId, ageYears]);

  const stale = lastReceivedAt === null || now - lastReceivedAt > STALE_AFTER_MS;
  return { result, latencyMs, stale, realtimeStatus };
}
