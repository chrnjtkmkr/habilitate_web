import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type ChildInsert = Database['public']['Tables']['children']['Insert'];
type ChildUpdate = Database['public']['Tables']['children']['Update'];

export function useChildren(centerId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ['children', centerId, search],
    queryFn: async () => {
      let query = supabase
        .from('children')
        .select('*, primary_therapist:profiles!children_primary_therapist_id_fkey(full_name), supervising_therapist_profile:profiles!children_supervising_therapist_id_fkey(full_name)')
        .eq('center_id', centerId!)
        .is('deleted_at', null)
        .order('full_name');
      if (search) {
        query = query.ilike('full_name', `%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Enrich with trajectory data from v_pulse_clinical
      const { data: clinical } = await supabase
        .from('v_pulse_clinical')
        .select('child_id, trajectory, active_goal_count, sessions_completed, last_session_date')
        .eq('center_id', centerId!);

      const clinicalMap = new Map<string, {
        trajectory: string | null;
        active_goal_count: number;
        sessions_completed: number;
        last_session_date: string | null;
      }>();
      for (const row of clinical ?? []) {
        if (row.child_id) {
          clinicalMap.set(row.child_id, {
            trajectory: row.trajectory as string | null,
            active_goal_count: row.active_goal_count ?? 0,
            sessions_completed: row.sessions_completed ?? 0,
            last_session_date: row.last_session_date,
          });
        }
      }

      return (data ?? []).map(child => ({
        ...child,
        trajectory: clinicalMap.get(child.id)?.trajectory ?? null,
        active_goal_count: clinicalMap.get(child.id)?.active_goal_count ?? 0,
        sessions_completed: clinicalMap.get(child.id)?.sessions_completed ?? 0,
        last_session_date: clinicalMap.get(child.id)?.last_session_date ?? null,
      }));
    },
    enabled: !!centerId,
  });
}

export type ChildWithStats = NonNullable<ReturnType<typeof useChildren>['data']>[number];

export function useChild(childId: string | undefined) {
  return useQuery({
    queryKey: ['child', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*, primary_therapist:profiles!children_primary_therapist_id_fkey(full_name, rci_registration_number), supervising_therapist_profile:profiles!children_supervising_therapist_id_fkey(full_name, rci_registration_number)')
        .eq('id', childId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!childId,
  });
}

export function useCreateChild(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ child, actorId }: { child: Omit<ChildInsert, 'center_id'>; actorId: string }) => {
      const { data, error } = await supabase
        .from('children')
        .insert({ ...child, center_id: centerId })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Insert returned no data');
      await supabase.from('audit_log').insert({
        action: 'child.created',
        actor_id: actorId,
        center_id: centerId,
        entity_id: data.id,
        entity_type: 'child',
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['children', centerId] }),
  });
}

export function useUpdateChild(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, updates, actorId }: { childId: string; updates: ChildUpdate; actorId: string }) => {
      const { data, error } = await supabase
        .from('children')
        .update(updates)
        .eq('id', childId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'child.updated',
        actor_id: actorId,
        center_id: centerId,
        entity_id: childId,
        entity_type: 'child',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['children', centerId] });
      qc.invalidateQueries({ queryKey: ['child'] });
    },
  });
}

export function useChildSessions(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-sessions', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, scheduled_date, status, therapist_id, profiles!sessions_therapist_id_fkey(full_name), discipline:disciplines!sessions_discipline_id_fkey(display_name)')
        .eq('child_id', childId!)
        .order('scheduled_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}
