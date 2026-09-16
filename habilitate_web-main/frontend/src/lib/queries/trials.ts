  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database, Json } from '../../types/supabase';

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
    mutationFn: async ({ sessionId, activityId, sessionActivityId, responseStatus, trialNumber, promptLevel, wordCount, adultVoiceCount, metrics }: {
      sessionId: string;
      activityId: string;
      sessionActivityId: string;
      responseStatus: TrialResponse;
      trialNumber: number;
      promptLevel?: string | null;
      wordCount?: number | null;
      adultVoiceCount?: number | null;
      metrics?: Json | null;
    }) => {
      // Bind the payload to the requested session/activity before writing. RLS
      // then additionally verifies that the authenticated user owns the session.
      const { data: activity, error: activityError } = await supabase
        .from('session_activities')
        .select('id')
        .eq('id', sessionActivityId)
        .eq('session_id', sessionId)
        .eq('activity_id', activityId)
        .maybeSingle();
      if (activityError) throw activityError;
      if (!activity) throw new Error('Activity does not belong to this session');

      const responsePayload = {
        session_activity_id: sessionActivityId,
        response: responseStatus,
        trial_number: trialNumber,
        prompt_level: promptLevel ?? null,
        word_count: wordCount ?? null,
        adult_voice_count: adultVoiceCount ?? null,
        metrics: metrics ?? null,
        recorded_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('trials')
        .upsert(
          responsePayload,
          { onConflict: 'session_activity_id,trial_number', ignoreDuplicates: false },
        )
        .select('id')
        .maybeSingle();
      if (error && (error as { code?: string }).code === 'PGRST204') {
        // Older linked databases may not have migration 0063 yet. Preserve the
        // response and metrics in the existing notes column until it is applied.
        const fallback = await supabase
          .from('trials')
          .upsert(
            {
              session_activity_id: sessionActivityId,
              response: responseStatus,
              trial_number: trialNumber,
              prompt_level: promptLevel ?? null,
              notes: JSON.stringify({ word_count: wordCount, adult_voice_count: adultVoiceCount, metrics }),
              recorded_at: responsePayload.recorded_at,
            },
            { onConflict: 'session_activity_id,trial_number', ignoreDuplicates: false },
          )
          .select('id')
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        return fallback.data;
      }
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

export function useDeleteTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, activityId, sessionActivityId, trialNumber }: {
      sessionId: string;
      activityId: string;
      sessionActivityId: string;
      trialNumber: number;
    }) => {
      const { data: activity, error: activityError } = await supabase
        .from('session_activities')
        .select('id')
        .eq('id', sessionActivityId)
        .eq('session_id', sessionId)
        .eq('activity_id', activityId)
        .maybeSingle();
      if (activityError) throw activityError;
      if (!activity) throw new Error('Activity does not belong to this session');

      const { error } = await supabase
        .from('trials')
        .delete()
        .eq('session_activity_id', sessionActivityId)
        .eq('trial_number', trialNumber);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['trials', vars.sessionActivityId] });
      qc.invalidateQueries({ queryKey: ['trials-session'] });
    },
  });
}
