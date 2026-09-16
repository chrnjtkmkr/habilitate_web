import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type GoalInsert = Database['public']['Tables']['goals']['Insert'];
type GoalUpdate = Database['public']['Tables']['goals']['Update'];
type GoalStatus = Database['public']['Enums']['goal_status'];

export function useGoals(childId: string | undefined) {
  return useQuery({
    queryKey: ['goals', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*, activity:activities(name, developmental_domain, skill_level)')
        .eq('child_id', childId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useActiveGoals(childId: string | undefined) {
  return useQuery({
    queryKey: ['goals', childId, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('child_id', childId!)
        .eq('status', 'active' as GoalStatus)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

export function useCreateGoal(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goal, actorId }: { goal: Omit<GoalInsert, 'center_id' | 'created_by'>; actorId: string }) => {
      const { data, error } = await supabase
        .from('goals')
        .insert({ ...goal, center_id: centerId, created_by: actorId })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Insert returned no data');
      await supabase.from('audit_log').insert({
        action: 'goal.created',
        actor_id: actorId,
        center_id: centerId,
        entity_id: data.id,
        entity_type: 'goal',
      });
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['goals', vars.goal.child_id] });
    },
  });
}

export function useUpdateGoal(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, childId, updates, actorId }: { goalId: string; childId: string; updates: GoalUpdate; actorId: string }) => {
      const { data, error } = await supabase
        .from('goals')
        .update(updates)
        .eq('id', goalId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'goal.updated',
        actor_id: actorId,
        center_id: centerId,
        entity_id: goalId,
        entity_type: 'goal',
      });
      return { childId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['goals', vars.childId] });
    },
  });
}

export function useMarkGoalMastered(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, childId, actorId }: { goalId: string; childId: string; actorId: string }) => {
      const { data, error } = await supabase
        .from('goals')
        .update({ status: 'mastered' as GoalStatus, mastered_at: new Date().toISOString() })
        .eq('id', goalId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'goal.mastered',
        actor_id: actorId,
        center_id: centerId,
        entity_id: goalId,
        entity_type: 'goal',
      });
      return { childId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['goals', vars.childId] });
    },
  });
}

export function useRetireGoal(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, childId, actorId }: { goalId: string; childId: string; actorId: string }) => {
      const { data, error } = await supabase
        .from('goals')
        .update({ status: 'retired' as GoalStatus, retired_at: new Date().toISOString() })
        .eq('id', goalId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'goal.retired',
        actor_id: actorId,
        center_id: centerId,
        entity_id: goalId,
        entity_type: 'goal',
      });
      return { childId };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['goals', vars.childId] });
    },
  });
}
