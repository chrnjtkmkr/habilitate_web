import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
type SessionStatus = Database['public']['Enums']['session_status'];
type SessionUpdate = Database['public']['Tables']['sessions']['Update'];

export function useSessions(centerId: string | undefined, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['sessions', centerId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('sessions')
        .select('*, child:children!sessions_child_id_fkey(full_name), therapist:profiles!sessions_therapist_id_fkey(full_name)')
        .eq('center_id', centerId!)
        .order('scheduled_date')
        .order('scheduled_time', { nullsFirst: false });
      if (dateFrom) query = query.gte('scheduled_date', dateFrom);
      if (dateTo) query = query.lte('scheduled_date', dateTo);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
  });
}

// Extended query for the sessions list page — includes engagement + activity counts
export function useSessionsList(centerId: string | undefined, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['sessions-list', centerId, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('sessions')
        .select('*, child:children!sessions_child_id_fkey(full_name), therapist:profiles!sessions_therapist_id_fkey(full_name), discipline:disciplines!sessions_discipline_id_fkey(display_name), engagement_samples(composite_score), session_activities(id, trials:trials(id))')
        .eq('center_id', centerId!)
        .order('scheduled_date', { ascending: false })
        .order('scheduled_time', { ascending: false, nullsFirst: true });
      if (dateFrom) query = query.gte('scheduled_date', dateFrom);
      if (dateTo) query = query.lte('scheduled_date', dateTo);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
  });
}

export function useCreateSession(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessions, actorId }: { sessions: Omit<SessionInsert, 'center_id'>[]; actorId: string }) => {
      const rows = sessions.map((s) => ({ ...s, center_id: centerId }));
      const { data, error } = await supabase
        .from('sessions')
        .insert(rows)
        .select('id');
      if (error) throw error;
      await supabase.from('audit_log').insert({
        action: 'session.scheduled',
        actor_id: actorId,
        center_id: centerId,
        entity_id: data[0]?.id ?? '',
        entity_type: 'session',
        after_state: { count: rows.length } as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
    },
  });
}

export function useUpdateSession(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      updates,
      action,
      actorId,
    }: {
      sessionId: string;
      updates: SessionUpdate;
      action: string;
      actorId: string;
    }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', sessionId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action,
        actor_id: actorId,
        center_id: centerId,
        entity_id: sessionId,
        entity_type: 'session',
        after_state: updates as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useMarkPresent(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, actorId }: { sessionId: string; actorId: string }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('sessions')
        .update({
          status: 'in_progress' as SessionStatus,
          started_at: now,
          attendance_marked_at: now,
          attendance_marked_by_user_id: actorId,
        })
        .eq('id', sessionId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'session.attendance_marked',
        actor_id: actorId,
        center_id: centerId,
        entity_id: sessionId,
        entity_type: 'session',
        after_state: { status: 'present' } as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useMarkAbsent(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, reason, actorId }: { sessionId: string; reason: string; actorId: string }) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('sessions')
        .update({
          status: 'no_show' as SessionStatus,
          no_show_reason: reason || null,
          attendance_marked_at: now,
          attendance_marked_by_user_id: actorId,
        })
        .eq('id', sessionId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'session.attendance_marked',
        actor_id: actorId,
        center_id: centerId,
        entity_id: sessionId,
        entity_type: 'session',
        after_state: { status: 'absent', reason } as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useCancelSession(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, reason, actorId }: { sessionId: string; reason: string; actorId: string }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update({
          status: 'cancelled' as SessionStatus,
          cancellation_reason: reason || null,
        })
        .eq('id', sessionId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'session.cancelled',
        actor_id: actorId,
        center_id: centerId,
        entity_id: sessionId,
        entity_type: 'session',
        after_state: { reason } as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, child:children!sessions_child_id_fkey(id, full_name, date_of_birth, diagnostic_profile), therapist:profiles!sessions_therapist_id_fkey(full_name)')
        .eq('id', sessionId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });
}

export function useSessionActivities(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session-activities', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_activities')
        .select('*, activity:activities(*), goal:goals(id, name)')
        .eq('session_id', sessionId!)
        .order('ordering');
      if (error) throw error;
      // Deduplicate: some sessions have double-inserted activities (same ordering + activity_id).
      // Keep the first row per ordering value (the one the session run page actually used).
      const seen = new Set<number>();
      return (data ?? []).filter((sa) => {
        if (seen.has(sa.ordering)) return false;
        seen.add(sa.ordering);
        return true;
      });
    },
    enabled: !!sessionId,
  });
}

export function useStartSession(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      activityIds,
      goalMap,
      actorId,
    }: {
      sessionId: string;
      activityIds: string[];
      goalMap?: Record<string, string>;
      actorId: string;
    }) => {
      const now = new Date().toISOString();
      const { data: sessData, error: sessErr } = await supabase
        .from('sessions')
        .update({ status: 'in_progress' as SessionStatus, started_at: now })
        .eq('id', sessionId)
        .select('id');
      if (sessErr) throw sessErr;
      if (!sessData || sessData.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      const rows = activityIds.map((activityId, i) => ({
        session_id: sessionId,
        activity_id: activityId,
        ordering: i,
        plan_origin: 'therapist_added' as const,
        goal_id: goalMap?.[activityId] ?? null,
      }));
      const { error: saErr } = await supabase
        .from('session_activities')
        .insert(rows);
      if (saErr) throw saErr;

      await supabase.from('audit_log').insert({
        action: 'session.started',
        actor_id: actorId,
        center_id: centerId,
        entity_id: sessionId,
        entity_type: 'session',
        after_state: { activity_count: activityIds.length } as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
      qc.invalidateQueries({ queryKey: ['session'] });
      qc.invalidateQueries({ queryKey: ['session-activities'] });
    },
  });
}

export function useEndSessionActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionActivityId }: { sessionActivityId: string }) => {
      const { data, error } = await supabase
        .from('session_activities')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionActivityId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session-activities'] });
    },
  });
}

export function useStartSessionActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionActivityId }: { sessionActivityId: string }) => {
      const { data, error } = await supabase
        .from('session_activities')
        .update({ started_at: new Date().toISOString() })
        .eq('id', sessionActivityId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session-activities'] });
    },
  });
}

export function useUpdateSessionActivityNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionActivityId, notes }: { sessionActivityId: string; notes: string }) => {
      const { data, error } = await supabase
        .from('session_activities')
        .update({ therapist_notes: notes })
        .eq('id', sessionActivityId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session-activities'] });
    },
  });
}

export function useEngagementSamples(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['engagement-samples', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engagement_samples')
        .select('recorded_at, composite_score, motion_score, audio_activity_flag, head_pose, session_activity_id, child_voice_count, adult_voice_count, voice_state')
        .eq('session_id', sessionId!)
        .order('recorded_at');
      if (error) throw error;
      return (data ?? []).map((s) => ({
        time: new Date(s.recorded_at).getTime(),
        score: s.composite_score ?? 0,
        motionScore: s.motion_score ?? 0,
        audioActivity: s.audio_activity_flag,
        headPose: s.head_pose as { yaw: number; pitch: number; roll: number } | null,
        sessionActivityId: s.session_activity_id,
        childVoiceCount: s.child_voice_count,
        adultVoiceCount: s.adult_voice_count,
        voiceState: s.voice_state,
      }));
    },
    enabled: !!sessionId,
  });
}

export function useFinalizeSession(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, finalNote, actorId }: { sessionId: string; finalNote?: string; actorId: string }) => {
      const updates: SessionUpdate = {
        status: 'completed' as SessionStatus,
        ended_at: new Date().toISOString(),
      };
      if (finalNote) updates.therapist_notes = finalNote;
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', sessionId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }
      await supabase.from('audit_log').insert({
        action: 'session.completed',
        actor_id: actorId,
        center_id: centerId,
        entity_id: sessionId,
        entity_type: 'session',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}
