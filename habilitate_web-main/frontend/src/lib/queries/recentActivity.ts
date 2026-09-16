import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type RecentActivityEvent =
  | { type: 'session_completed'; timestamp: string; child_name: string; therapist_name: string; trial_count: number; avg_engagement_pct: number | null }
  | { type: 'report_sent'; timestamp: string; child_name: string; period_label: string }
  | { type: 'intake_completed'; timestamp: string; child_name: string };

export function useRecentActivity(centerId: string | undefined) {
  return useQuery({
    queryKey: ['recent-activity', centerId],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 48);
      const cutoffISO = cutoff.toISOString();

      const events: RecentActivityEvent[] = [];

      // Completed sessions in last 48h
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, ended_at, child:children!sessions_child_id_fkey(full_name), therapist:profiles!sessions_therapist_id_fkey(full_name)')
        .eq('center_id', centerId!)
        .eq('status', 'completed')
        .gte('ended_at', cutoffISO)
        .order('ended_at', { ascending: false })
        .limit(10);

      if (sessions) {
        for (const s of sessions) {
          // Get trial count
          const { count: trialCount } = await supabase
            .from('trials')
            .select('id', { count: 'exact', head: true })
            .in('session_activity_id', (
              await supabase
                .from('session_activities')
                .select('id')
                .eq('session_id', s.id)
            ).data?.map(sa => sa.id) ?? []);

          // Get avg engagement
          const { data: engData } = await supabase
            .from('engagement_samples')
            .select('composite_score')
            .eq('session_id', s.id)
            .not('composite_score', 'is', null);

          let avgEng: number | null = null;
          if (engData && engData.length > 0) {
            const sum = engData.reduce((acc, e) => acc + (e.composite_score ?? 0), 0);
            avgEng = Math.round((sum / engData.length) * 100);
          }

          events.push({
            type: 'session_completed',
            timestamp: s.ended_at!,
            child_name: (s.child as { full_name: string })?.full_name ?? '—',
            therapist_name: (s.therapist as { full_name: string })?.full_name ?? '—',
            trial_count: trialCount ?? 0,
            avg_engagement_pct: avgEng,
          });
        }
      }

      // Reports approved/sent in last 48h
      const { data: reports } = await supabase
        .from('parent_reports')
        .select('id, status, approved_at, sent_at, period_start, period_end, child:children!parent_reports_child_id_fkey(full_name)')
        .eq('center_id', centerId!)
        .in('status', ['approved', 'sent'])
        .or(`approved_at.gte.${cutoffISO},sent_at.gte.${cutoffISO}`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (reports) {
        for (const r of reports) {
          events.push({
            type: 'report_sent',
            timestamp: r.sent_at ?? r.approved_at ?? r.period_end,
            child_name: (r.child as { full_name: string })?.full_name ?? '—',
            period_label: `${r.period_start} — ${r.period_end}`,
          });
        }
      }

      // Completed intakes in last 48h
      const { data: intakes } = await supabase
        .from('intake_assessments')
        .select('id, completed_at, child:children!intake_assessments_child_id_fkey(full_name)')
        .eq('status', 'completed')
        .gte('completed_at', cutoffISO)
        .order('completed_at', { ascending: false })
        .limit(5);

      if (intakes) {
        for (const ia of intakes) {
          events.push({
            type: 'intake_completed',
            timestamp: ia.completed_at!,
            child_name: (ia.child as { full_name: string })?.full_name ?? '—',
          });
        }
      }

      // Sort all events by timestamp desc, take top 10
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return events.slice(0, 10);
    },
    enabled: !!centerId,
    staleTime: 60_000,
  });
}
