import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface SessionEngagement {
  session_id: string;
  ended_at: string;
  avg_engagement_pct: number;
}

// Returns avg engagement % for the last 5 completed sessions of a child.
export function useChildEngagementHistory(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-engagement-history', childId],
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, ended_at')
        .eq('child_id', childId!)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(5);

      if (!sessions || sessions.length === 0) return [];

      const results: SessionEngagement[] = [];
      for (const s of sessions) {
        const { data: samples } = await supabase
          .from('engagement_samples')
          .select('composite_score')
          .eq('session_id', s.id)
          .not('composite_score', 'is', null);

        if (samples && samples.length > 0) {
          const sum = samples.reduce((acc, e) => acc + (e.composite_score ?? 0), 0);
          results.push({
            session_id: s.id,
            ended_at: s.ended_at ?? '',
            avg_engagement_pct: Math.round((sum / samples.length) * 100),
          });
        }
      }
      return results;
    },
    enabled: !!childId,
    staleTime: 120_000,
  });
}
