import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type ParentInsert = Database['public']['Tables']['parents']['Insert'];

export function useParents(childId: string | undefined) {
  return useQuery({
    queryKey: ['parents', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parents')
        .select('*')
        .eq('child_id', childId!)
        .is('deleted_at', null)
        .order('is_primary_contact', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useCreateParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parent: ParentInsert) => {
      const { data, error } = await supabase
        .from('parents')
        .insert(parent)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Insert returned no data');
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['parents', vars.child_id] });
    },
  });
}
