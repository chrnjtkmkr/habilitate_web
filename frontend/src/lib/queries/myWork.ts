import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface MyWorkData {
  totalHours: number;
  sessionCount: number;
  childCount: number;
  noteCount: number;
  sinceDate: string | null;
  disciplines: string[];
  children: Array<{ id: string; full_name: string }>;
}

export interface Moment {
  kind: 'personal_best' | 'milestone';
  childName: string;
  attributeId: string;
  attributeLabel: string;
  metric: string | null;
  value: number | null;
  date: string;
}

export function useMyWork(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-work', userId],
    queryFn: async (): Promise<MyWorkData> => {
      // Completed sessions for this therapist
      const { data: sessions, error: sessErr } = await supabase
        .from('sessions')
        .select('id, child_id, scheduled_date, duration_minutes, discipline:disciplines!sessions_discipline_id_fkey(display_name)')
        .eq('therapist_id', userId!)
        .eq('status', 'completed')
        .order('scheduled_date');
      if (sessErr) throw sessErr;

      const sessionCount = sessions?.length ?? 0;
      const totalMinutes = (sessions ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
      const totalHours = Math.round(totalMinutes / 60);

      const childIds = [...new Set((sessions ?? []).map(s => s.child_id))];
      const childCount = childIds.length;
      const sinceDate = sessions && sessions.length > 0 ? sessions[0].scheduled_date : null;

      const discSet = new Set<string>();
      for (const s of sessions ?? []) {
        const disc = s.discipline as { display_name: string } | null;
        if (disc?.display_name) discSet.add(disc.display_name);
      }

      // Notes count
      const { count: noteCount, error: noteErr } = await supabase
        .from('session_notes')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', userId!);
      if (noteErr) throw noteErr;

      // Children names (for on-screen list, never for sharing)
      let children: Array<{ id: string; full_name: string }> = [];
      if (childIds.length > 0) {
        const { data: childRows, error: childErr } = await supabase
          .from('children')
          .select('id, full_name')
          .in('id', childIds)
          .order('full_name');
        if (childErr) throw childErr;
        children = childRows ?? [];
      }

      return {
        totalHours,
        sessionCount,
        childCount,
        noteCount: noteCount ?? 0,
        sinceDate,
        disciplines: [...discSet],
        children,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyMoments(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-moments', userId],
    queryFn: async (): Promise<Moment[]> => {
      const moments: Moment[] = [];

      // Personal bests where probe → session → therapist_id = me
      // PostgREST inner join: probe!inner filters out nulls, then
      // probe.session!inner ensures the session exists and we can filter on it.
      const { data: bests, error: bestErr } = await supabase
        .from('personal_bests')
        .select('attribute_id, metric, value, achieved_at, attribute:attributes!inner(parent_label), probe:probes!inner(session:sessions!inner(therapist_id, child:children!inner(full_name)))')
        .eq('probe.session.therapist_id', userId!)
        .order('achieved_at', { ascending: false });
      if (bestErr) throw bestErr;

      for (const b of bests ?? []) {
        const attr = b.attribute as unknown as { parent_label: string } | null;
        const probe = b.probe as unknown as { session: { child: { full_name: string } } } | null;
        if (!attr || !probe) continue;
        moments.push({
          kind: 'personal_best',
          childName: probe.session.child.full_name,
          attributeId: b.attribute_id,
          attributeLabel: attr.parent_label,
          metric: b.metric,
          value: b.value,
          date: b.achieved_at,
        });
      }

      // Milestones where probe → session → therapist_id = me
      const { data: milestones, error: msErr } = await supabase
        .from('milestones')
        .select('attribute_id, milestone_key, achieved_at, attribute:attributes!inner(parent_label), probe:probes!inner(session:sessions!inner(therapist_id, child:children!inner(full_name)))')
        .eq('probe.session.therapist_id', userId!)
        .order('achieved_at', { ascending: false });
      if (msErr) throw msErr;

      for (const m of milestones ?? []) {
        const attr = m.attribute as unknown as { parent_label: string } | null;
        const probe = m.probe as unknown as { session: { child: { full_name: string } } } | null;
        if (!attr || !probe) continue;
        moments.push({
          kind: 'milestone',
          childName: probe.session.child.full_name,
          attributeId: m.attribute_id,
          attributeLabel: attr.parent_label,
          metric: m.milestone_key,
          value: null,
          date: m.achieved_at,
        });
      }

      // Sort newest first
      moments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return moments;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

// Build shareable text from NUMBERS ONLY.
// Never receives child names, centre names, moment details, or clinical data.
export function buildShareText(
  totalHours: number,
  childCount: number,
  noteCount: number,
  disciplines: string[],
  sinceLabel: string,
  lang: string,
): string {
  if (lang.startsWith('hi')) {
    let text = `${sinceLabel} \u0938\u0947 \u092e\u0948\u0902\u0928\u0947 ${childCount} \u092c\u091a\u094d\u091a\u094b\u0902 \u0915\u0947 \u0938\u093e\u0925 ${totalHours} \u0918\u0902\u091f\u0947 \u0925\u0947\u0930\u0947\u092a\u0940 \u092e\u0947\u0902 \u0926\u093f\u090f \u0939\u0948\u0902\u0964`;
    if (noteCount > 0) {
      text += ` ${noteCount} \u0928\u094b\u091f\u094d\u0938 \u0915\u0947\u092f\u0930 \u091f\u0940\u092e \u0915\u0947 \u0938\u093e\u0925 \u0938\u093e\u091d\u093e \u0915\u093f\u090f\u0964`;
    }
    if (disciplines.length > 0) {
      text += ` \u0935\u093f\u0937\u092f: ${disciplines.join(', ')}\u0964`;
    }
    text += '\n\u2014 Habilitate Labs';
    return text;
  }

  let text = `Since ${sinceLabel}, I have given ${totalHours} hours of therapy to ${childCount} children.`;
  if (noteCount > 0) {
    text += ` ${noteCount} notes shared with care teams.`;
  }
  if (disciplines.length > 0) {
    text += ` Disciplines: ${disciplines.join(', ')}.`;
  }
  text += '\n\u2014 Habilitate Labs';
  return text;
}

// Convert milliseconds to a readable seconds string.
// Rounds to whole seconds — the tracking does not justify decimal precision.
function msToSeconds(ms: number): string {
  return String(Math.round(ms / 1000));
}

// Build a human sentence for a moment. Per-attribute, not generic.
// Used only on-screen, never in share text.
export function buildMomentSentence(m: Moment, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const child = m.childName;

  if (m.kind === 'personal_best' && m.value != null) {
    // Specific sentences per attribute + metric
    if (m.attributeId === 'looks_at_you' && m.metric === 'longest_duration_ms') {
      return t('moment_pb_looked_at_you', { child, seconds: msToSeconds(m.value) });
    }
    if (m.attributeId === 'stays_activity' && m.metric === 'longest_duration_ms') {
      return t('moment_pb_stayed_with_activity', { child, seconds: msToSeconds(m.value) });
    }
    // Fallback for unknown personal bests
    return t('moment_pb_generic', { child, label: m.attributeLabel });
  }

  if (m.kind === 'personal_best') {
    return t('moment_pb_generic', { child, label: m.attributeLabel });
  }

  // Milestones — specific per attribute
  if (m.attributeId === 'looks_at_you') {
    return t('moment_ms_looked_at_you', { child });
  }
  // Fallback for unknown milestones
  return t('moment_ms_generic', { child, label: m.attributeLabel });
}
