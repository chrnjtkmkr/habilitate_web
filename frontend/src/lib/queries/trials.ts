import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type TrialResponse = Database['public']['Enums']['trial_response'];

export function useTrials(sessionActivityId: string | undefined) {
  return useQuery({
    queryKey: ['trials', sessionActivityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trials')
        .select('*')
        .eq('session_activity_id', sessionActivityId!)
        .order('trial_number');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionActivityId,
  });
}

export function useTrialsBySession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['trials-session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trials')
        .select('*, session_activity_id')
        .in('session_activity_id', (
          await supabase.from('session_activities').select('id').eq('session_id', sessionId!)
        ).data?.map((sa) => sa.id) ?? [])
        .order('trial_number');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
  });
}

export function useCreateTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionActivityId, response, trialNumber, promptLevel }: {
      sessionActivityId: string;
      response: TrialResponse;
      trialNumber: number;
      promptLevel?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('trials')
        .insert({
          session_activity_id: sessionActivityId,
          response,
          trial_number: trialNumber,
          prompt_level: promptLevel ?? null,
          recorded_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      // data may be null if RLS SELECT policy can't read the row back,
      // but the insert still succeeded (no error was thrown).
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['trials', vars.sessionActivityId] });
      qc.invalidateQueries({ queryKey: ['trials-session'] });
    },
  });
}
