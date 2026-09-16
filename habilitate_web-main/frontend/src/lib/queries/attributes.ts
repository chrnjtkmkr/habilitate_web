import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

// Personal bests for a child — small, static during a session.
export function useChildPersonalBests(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-personal-bests', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_bests')
        .select('attribute_id, metric, value')
        .eq('child_id', childId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
    staleTime: Infinity,
  });
}

export function useAttributeConfig(attributeId: string) {
  return useQuery({
    queryKey: ['attribute-config', attributeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attributes')
        .select('config')
        .eq('id', attributeId)
        .single();
      if (error) throw error;
      return data.config as Record<string, unknown>;
    },
    staleTime: Infinity,
  });
}
