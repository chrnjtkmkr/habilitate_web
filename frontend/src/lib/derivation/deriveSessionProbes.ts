/**
 * deriveSessionProbes — runs at session-finalize to compute milestones,
 * personal bests, and baselines from confirmed+valid probes.
 *
 * Reads only probes where therapist_confirmed=true AND valid=true.
 * All writes are idempotent: ON CONFLICT DO NOTHING for milestones/baselines,
 * conditional upsert for personal bests (only if beaten by margin).
 *
 * Running totals come from v_child_attribute_totals (view), no write needed.
 */

import { supabase } from '../supabase';

// Milestone definitions per attribute
const MILESTONE_DEFS: Record<string, { key: string; check: (raw: Record<string, unknown>) => boolean }[]> = {
  response_to_name: [
    {
      key: 'first_orient',
      check: (raw) => raw.orientation === 'looked',
    },
    // first_orient_mother: requires caller=mother data — not yet captured, skip for now
  ],
};

// Personal-best metric definitions per attribute
// direction: 'lower' = smaller is better (latency), 'higher' = bigger is better (duration)
const PERSONAL_BEST_DEFS: Record<string, { metric: string; rawKey: string; direction: 'lower' | 'higher'; marginConfigKey: string }[]> = {
  // SHELVED: latency unreliable until occlusion-robust tracking. Re-enable when detection
  // tracks through the head-turn. Count-based milestones/totals only for v1.
  // response_to_name: [
  //   { metric: 'fastest_latency_ms', rawKey: 'latency_ms', direction: 'lower', marginConfigKey: 'best_margin_ms' },
  // ],
  looks_at_you: [
    { metric: 'longest_duration_ms', rawKey: 'duration_ms', direction: 'higher', marginConfigKey: 'best_margin_ms' },
  ],
  stays_activity: [
    { metric: 'longest_duration_ms', rawKey: 'duration_ms', direction: 'higher', marginConfigKey: 'best_margin_ms' },
  ],
};

export async function deriveSessionProbes(sessionId: string): Promise<void> {
  // 1. Fetch confirmed + valid probes for this session
  const { data: probes, error: probesErr } = await supabase
    .from('probes')
    .select('id, child_id, attribute_id, captured_at, raw, score')
    .eq('session_id', sessionId)
    .eq('therapist_confirmed', true)
    .eq('valid', true);
  if (probesErr) throw probesErr;
  if (!probes || probes.length === 0) return;

  const childId = probes[0].child_id;

  // 2. Fetch session and child for baseline window check
  const [sessionRes, childRes] = await Promise.all([
    supabase.from('sessions').select('scheduled_date').eq('id', sessionId).single(),
    supabase.from('children').select('created_at').eq('id', childId).single(),
  ]);
  if (sessionRes.error || childRes.error) throw sessionRes.error || childRes.error;

  const sessionDate = new Date(sessionRes.data.scheduled_date);
  const childCreatedAt = new Date(childRes.data.created_at);
  const daysSinceCreation = (sessionDate.getTime() - childCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  const isWeekOne = daysSinceCreation <= 7;

  // 3. Group probes by attribute
  const byAttribute = new Map<string, typeof probes>();
  for (const p of probes) {
    const list = byAttribute.get(p.attribute_id) ?? [];
    list.push(p);
    byAttribute.set(p.attribute_id, list);
  }

  // 4. Fetch attribute configs for best_margin
  const attrIds = [...byAttribute.keys()];
  const { data: attrs } = await supabase
    .from('attributes')
    .select('id, config')
    .in('id', attrIds);
  const attrConfig = new Map<string, Record<string, unknown>>();
  for (const a of attrs ?? []) {
    attrConfig.set(a.id, a.config as Record<string, unknown>);
  }

  // 5. Process each attribute
  for (const [attributeId, attrProbes] of byAttribute) {
    const config = attrConfig.get(attributeId) ?? {};

    // --- BASELINES (freeze week-1 anchor) ---
    // Clinical record only — NEVER rendered on the parent-facing progress report.
    // Baselines can produce backward-moving comparisons; parent view uses monotonic counts only.
    if (isWeekOne) {
      const scores = attrProbes.map((p) => p.score).filter((s): s is number => s !== null);
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const windowStr = `${sessionDate.toISOString().slice(0, 10)} (week 1)`;
        await supabase.from('child_attribute_baselines').upsert(
          {
            child_id: childId,
            attribute_id: attributeId,
            baseline_value: avg,
            baseline_window: windowStr,
          },
          { onConflict: 'child_id,attribute_id', ignoreDuplicates: true },
        );
      }
    }

    // --- MILESTONES (once ever, idempotent) ---
    const milestoneDefs = MILESTONE_DEFS[attributeId];
    if (milestoneDefs) {
      for (const def of milestoneDefs) {
        const qualifying = attrProbes.find((p) => def.check(p.raw as Record<string, unknown>));
        if (qualifying) {
          await supabase.from('milestones').upsert(
            {
              child_id: childId,
              attribute_id: attributeId,
              milestone_key: def.key,
              achieved_at: qualifying.captured_at,
              probe_id: qualifying.id,
            },
            { onConflict: 'child_id,attribute_id,milestone_key', ignoreDuplicates: true },
          );
        }
      }
    }

    // --- PERSONAL BESTS (beaten by margin only) ---
    const bestDefs = PERSONAL_BEST_DEFS[attributeId];
    if (bestDefs) {
      for (const def of bestDefs) {
        const margin = typeof config[def.marginConfigKey] === 'number'
          ? (config[def.marginConfigKey] as number)
          : 0;

        // Find session best
        let sessionBestProbe: (typeof attrProbes)[number] | null = null;
        let sessionBestValue: number | null = null;
        for (const p of attrProbes) {
          const raw = p.raw as Record<string, unknown>;
          const val = typeof raw[def.rawKey] === 'number' ? (raw[def.rawKey] as number) : null;
          if (val === null) continue;
          if (sessionBestValue === null ||
            (def.direction === 'lower' && val < sessionBestValue) ||
            (def.direction === 'higher' && val > sessionBestValue)) {
            sessionBestValue = val;
            sessionBestProbe = p;
          }
        }
        if (sessionBestValue === null || !sessionBestProbe) continue;

        // Fetch existing personal best
        const { data: existing } = await supabase
          .from('personal_bests')
          .select('id, value')
          .eq('child_id', childId)
          .eq('attribute_id', attributeId)
          .eq('metric', def.metric)
          .maybeSingle();

        const shouldUpdate = !existing ||
          (def.direction === 'lower' && sessionBestValue < existing.value - margin) ||
          (def.direction === 'higher' && sessionBestValue > existing.value + margin);

        if (shouldUpdate) {
          await supabase.from('personal_bests').upsert(
            {
              child_id: childId,
              attribute_id: attributeId,
              metric: def.metric,
              value: sessionBestValue,
              achieved_at: sessionBestProbe.captured_at,
              probe_id: sessionBestProbe.id,
            },
            { onConflict: 'child_id,attribute_id,metric' },
          );
        }
      }
    }
  }
}
