import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface GoalProgressData {
  progress_pct: number | null;
  trial_count: number;
  has_data: boolean;
}

// Computes a heuristic progress % for a goal based on trial responses.
export function useGoalProgress(goalId: string | undefined, childId: string | undefined, goalStatus: string | undefined, activityId: string | null | undefined) {
  return useQuery({
    queryKey: ['goal-progress', goalId],
    queryFn: async (): Promise<GoalProgressData> => {
      if (goalStatus === 'mastered') return { progress_pct: 100, trial_count: 0, has_data: true };

      if (!activityId) return { progress_pct: null, trial_count: 0, has_data: false };

      // Get session_activities for this activity + child in last 4 weeks
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const { data: sessionActivities } = await supabase
        .from('session_activities')
        .select('id, session:sessions!session_activities_session_id_fkey(child_id, scheduled_date)')
        .eq('activity_id', activityId)
        .gte('created_at', fourWeeksAgo.toISOString());

      if (!sessionActivities || sessionActivities.length === 0) {
        return { progress_pct: null, trial_count: 0, has_data: false };
      }

      // Filter to this child's sessions
      const relevantSaIds = sessionActivities
        .filter(sa => (sa.session as { child_id: string })?.child_id === childId)
        .map(sa => sa.id);

      if (relevantSaIds.length === 0) return { progress_pct: null, trial_count: 0, has_data: false };

      const { data: trials } = await supabase
        .from('trials')
        .select('response')
        .in('session_activity_id', relevantSaIds);

      if (!trials || trials.length === 0) return { progress_pct: null, trial_count: 0, has_data: false };

      const responded = trials.filter(t => t.response === 'responded' || t.response === 'partial').length;
      const pct = Math.round((responded / trials.length) * 100);
      return { progress_pct: Math.min(100, Math.max(0, pct)), trial_count: trials.length, has_data: true };
    },
    enabled: !!goalId && !!childId,
    staleTime: 120_000,
  });
}
