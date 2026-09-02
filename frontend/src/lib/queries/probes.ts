import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type ProbeInsert = Database['public']['Tables']['probes']['Insert'];

export function useProbesForSession(sessionId: string | undefined, attributeId: string) {
  return useQuery({
    queryKey: ['probes', sessionId, attributeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('probes')
        .select('*')
        .eq('session_id', sessionId!)
        .eq('attribute_id', attributeId)
        .order('captured_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
  });
}

export function useConfirmProbe(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (probeId: string) => {
      const { data, error } = await supabase
        .from('probes')
        .update({ therapist_confirmed: true, valid: true })
        .eq('id', probeId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['probes', sessionId] });
    },
  });
}

export function useVoidProbe(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (probeId: string) => {
      const { data, error } = await supabase
        .from('probes')
        .update({ valid: false, void_reason: 'therapist_voided' })
        .eq('id', probeId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['probes', sessionId] });
    },
  });
}

export function useProbesForDateRange(
  childId: string | undefined,
  attributeId: string,
  periodStart: string,
  periodEnd: string,
) {
  return useQuery({
    queryKey: ['probes-range', childId, attributeId, periodStart, periodEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('probes')
        .select('id, attribute_id, captured_at, raw, score, valid, therapist_confirmed')
        .eq('child_id', childId!)
        .eq('attribute_id', attributeId)
        .gte('captured_at', periodStart + 'T00:00:00')
        .lte('captured_at', periodEnd + 'T23:59:59')
        .order('captured_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId && !!periodStart && !!periodEnd,
  });
}

export function useInsertManualProbe(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (probe: Omit<ProbeInsert, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('probes').insert(probe);
      if (error) throw error;
    },
    // No retry on auth/RLS errors — log once and stop
    retry: false,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['probes', sessionId] });
    },
    onError: (err) => {
      console.error('[probe-insert] failed (no retry):', err.message);
    },
  });
}
