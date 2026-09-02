import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type UserRole = Database['public']['Enums']['user_role'];

export function useRoster(centerId: string | undefined) {
  return useQuery({
    queryKey: ['roster', centerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, role, is_active, user_id, profiles!inner(id, full_name, phone_e164, rci_registration_number, credential_class, is_active, discipline_id, discipline:disciplines!profiles_discipline_id_fkey(display_name))')
        .eq('center_id', centerId!)
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
  });
}

export function useUpdateMembershipRole(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId, role, actorId }: { membershipId: string; role: UserRole; actorId: string }) => {
      const { data, error } = await supabase
        .from('memberships')
        .update({ role })
        .eq('id', membershipId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'membership.role_changed',
        actor_id: actorId,
        center_id: centerId,
        entity_id: membershipId,
        entity_type: 'membership',
        after_state: { role } as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', centerId] }),
  });
}

export function useDisciplines() {
  return useQuery({
    queryKey: ['disciplines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disciplines')
        .select('id, display_name')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetMemberDiscipline(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, disciplineId }: { userId: string; disciplineId: string | null }) => {
      const { error } = await supabase.rpc('set_member_discipline', {
        p_user_id: userId,
        p_discipline_id: disciplineId as string,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', centerId] }),
  });
}

export function useMyCareTeamChildIds(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-care-team-children', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('child_care_team')
        .select('child_id')
        .eq('therapist_id', userId!)
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []).map((r) => r.child_id);
    },
    enabled: !!userId,
  });
}

export function useDeactivateMembership(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId, actorId }: { membershipId: string; actorId: string }) => {
      const { data, error } = await supabase
        .from('memberships')
        .update({ is_active: false })
        .eq('id', membershipId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'membership.deactivated',
        actor_id: actorId,
        center_id: centerId,
        entity_id: membershipId,
        entity_type: 'membership',
      });
    },
    onSuccess: () => {
      // The DB trigger (0043) cascades deactivation to child_care_team rows,
      // so we must refresh every query whose data depends on care-team state.
      // Note: this only refreshes THIS browser's cache. The deactivated
      // therapist on their own device won't refetch until their queries
      // remount or staleTime expires (refetchOnWindowFocus is off).
      qc.invalidateQueries({ queryKey: ['roster', centerId] });
      qc.invalidateQueries({ queryKey: ['my-care-team-children'] });
      qc.invalidateQueries({ queryKey: ['children'] });
      qc.invalidateQueries({ queryKey: ['child'] });
      qc.invalidateQueries({ queryKey: ['child-notes'] });
      qc.invalidateQueries({ queryKey: ['child-sessions'] });
    },
  });
}

// Care team for a specific child — all active members with names and disciplines
export function useChildCareTeam(childId: string | undefined) {
  return useQuery({
    queryKey: ['child-care-team', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('child_care_team')
        .select('id, therapist_id, discipline_id, role, is_active, therapist:profiles!child_care_team_therapist_id_fkey(full_name), discipline:disciplines!child_care_team_discipline_id_fkey(display_name)')
        .eq('child_id', childId!)
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!childId,
  });
}

// Add a member to a child's care team.
// RLS restricts to center_owner and supervising_therapist — no client guard needed.
export function useAddCareTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ childId, therapistId, disciplineId }: { childId: string; therapistId: string; disciplineId: string | null }) => {
      const { error } = await supabase
        .from('child_care_team')
        .upsert({
          child_id: childId,
          therapist_id: therapistId,
          discipline_id: disciplineId,
          role: 'lead',
          is_active: true,
        }, { onConflict: 'child_id,therapist_id,discipline_id' });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['child-care-team', vars.childId] });
    },
  });
}

// Remove a member by deactivating (preserves history).
// RLS restricts to center_owner and supervising_therapist.
export function useRemoveCareTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ careTeamId, childId }: { careTeamId: string; childId: string }) => {
      const { error } = await supabase
        .from('child_care_team')
        .update({ is_active: false })
        .eq('id', careTeamId);
      if (error) throw error;
      return childId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['child-care-team', vars.childId] });
    },
  });
}
