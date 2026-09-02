import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useInferencesForSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['prompt-inferences', sessionId],
    queryFn: async () => {
      // Get all session_activity IDs for this session
      const { data: saRows } = await supabase
        .from('session_activities')
        .select('id')
        .eq('session_id', sessionId!);
      if (!saRows?.length) return [];

      // Get all trial IDs for those activities
      const { data: trialRows } = await supabase
        .from('trials')
        .select('id')
        .in('session_activity_id', saRows.map(sa => sa.id));
      if (!trialRows?.length) return [];

      // Fetch inferences for those trials
      const { data, error } = await supabase
        .from('trial_prompt_inferences')
        .select('*')
        .in('trial_id', trialRows.map(t => t.id));
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
  });
}

export function useCorrectInference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inferenceId,
      correction,
      userId,
    }: {
      inferenceId: string;
      correction: 'independent' | 'verbal_prompt' | 'gestural_prompt' | 'physical_prompt';
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from('trial_prompt_inferences')
        .update({
          therapist_correction: correction,
          corrected_by: userId,
          corrected_at: new Date().toISOString(),
        })
        .eq('id', inferenceId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompt-inferences'] });
    },
  });
}
