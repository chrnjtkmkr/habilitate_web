import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useMilestones(childId: string | undefined) {
  return useQuery({
    queryKey: ['milestones', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('child_id', childId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useAttributeTotals(childId: string | undefined) {
  return useQuery({
    queryKey: ['attribute-totals', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_child_attribute_totals')
        .select('*')
        .eq('child_id', childId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useBaselines(childId: string | undefined) {
  return useQuery({
    queryKey: ['baselines', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('child_attribute_baselines')
        .select('*')
        .eq('child_id', childId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useAllAttributes() {
  return useQuery({
    queryKey: ['attributes-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attributes')
        .select('id, parent_label, sort_order')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
  });
}
