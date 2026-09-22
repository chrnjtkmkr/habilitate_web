import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useSessionEvents(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-events', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_events')
        .select('*')
        .eq('session_id', sessionId!)
        .order('recorded_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
  });
}

export function useCreateSessionEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      sessionActivityId?: string | null;
      eventType: 'spontaneous_initiation' | 'state_change' | 'state_override_cleared';
      stateValue?: string | null;
      /** 'band' = signed-off engine state; 'band_estimate' = unvalidated
       *  estimate, kept for clinical validation. Default 'therapist'. */
      source?: 'therapist' | 'band' | 'band_estimate';
      note?: string | null;
      recordedByUserId?: string;
    }) => {
      const { data, error } = await supabase
        .from('session_events')
        .insert({
          session_id: params.sessionId,
          session_activity_id: params.sessionActivityId ?? null,
          event_type: params.eventType,
          state_value: params.stateValue ?? null,
          note: params.note ?? null,
          recorded_at: new Date().toISOString(),
          recorded_by_user_id: params.recordedByUserId ?? null,
          source: params.source ?? 'therapist',
        })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['session-events', vars.sessionId] });
    },
  });
}
