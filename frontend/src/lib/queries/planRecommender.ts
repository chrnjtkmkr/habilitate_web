import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { generatePlan } from '../planRecommender/index';
import type { RecommenderInput, PlanOutput, RecommendedActivity } from '../planRecommender/types';
import type { Database } from '../../types/supabase';

type PlanOrigin = Database['public']['Enums']['plan_origin'];

export function useRecommendPlan(
  sessionId: string | undefined,
  childId: string | undefined,
  durationMinutes: number,
  sessionDisciplineId?: string | null,
) {
  return useQuery({
    queryKey: ['recommend-plan', sessionId, childId, durationMinutes, sessionDisciplineId],
    queryFn: async (): Promise<PlanOutput> => {
      // 1. Fetch child
      const { data: child, error: childErr } = await supabase
        .from('children')
        .select('id, date_of_birth, diagnostic_profile')
        .eq('id', childId!)
        .single();
      if (childErr) throw childErr;

      const chronologicalAgeMonths = Math.floor(
        (Date.now() - new Date(child.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
      );

      // 2. Fetch latest completed intake assessment's computed_outputs
      const { data: intake } = await supabase
        .from('intake_assessments')
        .select('computed_outputs')
        .eq('child_id', childId!)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const intakeOutputs = intake?.computed_outputs as RecommenderInput['intakeOutputs'] | null;

      // 3. Fetch active goals
      const { data: goals, error: goalsErr } = await supabase
        .from('goals')
        .select('id, name, target_domain, target_skill_level, status')
        .eq('child_id', childId!)
        .eq('status', 'active');
      if (goalsErr) throw goalsErr;

      // 4. Fetch all validated activities (drafts have no card content and are not clinically approved)
      const { data: activities, error: actErr } = await supabase
        .from('activities')
        .select('id, name, developmental_domain, skill_level, diagnostic_profile_applicability, target_age_min_months, target_age_max_months, duration_minutes')
        .eq('validation_status', 'validated');
      if (actErr) throw actErr;

      // 5. Fetch recent 3 sessions with their activities and trials
      const { data: recentSessions, error: sessErr } = await supabase
        .from('sessions')
        .select('id, session_activities:session_activities(activity_id, goal_id, trials:trials(response))')
        .eq('child_id', childId!)
        .eq('status', 'completed')
        .neq('id', sessionId!)
        .order('scheduled_date', { ascending: false })
        .limit(3);
      if (sessErr) throw sessErr;

      const input: RecommenderInput = {
        child: {
          diagnostic_profile: (child.diagnostic_profile as Database['public']['Enums']['diagnostic_profile'][]) ?? [],
          chronological_age_months: chronologicalAgeMonths,
        },
        intakeOutputs: intakeOutputs ?? { baseline_skill_bands: {} },
        activeGoals: (goals ?? []).map((g) => ({
          id: g.id,
          name: g.name,
          target_domain: g.target_domain,
          target_skill_level: g.target_skill_level,
          status: g.status,
        })),
        allActivities: (activities ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          developmental_domain: a.developmental_domain,
          skill_level: a.skill_level,
          diagnostic_profile_applicability: a.diagnostic_profile_applicability,
          target_age_min_months: a.target_age_min_months,
          target_age_max_months: a.target_age_max_months,
          duration_minutes: a.duration_minutes,
        })),
        recentSessions: (recentSessions ?? []).map((s) => ({
          session_activities: ((s as Record<string, unknown>).session_activities as Array<{
            activity_id: string;
            goal_id: string | null;
            trials: { response: Database['public']['Enums']['trial_response'] }[];
          }>) ?? [],
        })),
        durationMinutes,
        sessionDisciplineId: sessionDisciplineId ?? null,
      };

      return generatePlan(input);
    },
    enabled: !!sessionId && !!childId,
    staleTime: Infinity, // plan doesn't change unless manually rebuilt
  });
}

export function useAcceptPlan(centerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      originalPlan,
      finalActivities,
      wasEdited,
      goalMap,
      actorId,
    }: {
      sessionId: string;
      originalPlan: PlanOutput;
      finalActivities: RecommendedActivity[];
      wasEdited: boolean;
      goalMap?: Record<string, string>;
      actorId: string;
    }) => {
      // 1. Persist the AI recommendation to session_plans (audit trail)
      const now = new Date().toISOString();
      const { data: planRow, error: planError } = await supabase
        .from('session_plans')
        .insert({
          session_id: sessionId,
          generator_version: originalPlan.generatorVersion,
          recommended_activity_ids: originalPlan.activities.map((a) => a.activityId),
          reasoning: originalPlan as unknown as Database['public']['Tables']['session_plans']['Insert']['reasoning'],
          plan: originalPlan as unknown as Database['public']['Tables']['session_plans']['Insert']['plan'],
          generated_at: now,
          accepted_at: now,
          accepted_by: actorId,
          was_edited: wasEdited,
        })
        .select('id')
        .maybeSingle();
      if (planError) throw planError;

      // 2. Update session status to in_progress
      const { data: sessData, error: sessErr } = await supabase
        .from('sessions')
        .update({ status: 'in_progress' as Database['public']['Enums']['session_status'], started_at: now })
        .eq('id', sessionId)
        .select('id');
      if (sessErr) throw sessErr;
      if (!sessData || sessData.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      // 3. Insert session_activities from the accepted plan
      const rows = finalActivities.map((a, i) => ({
        session_id: sessionId,
        activity_id: a.activityId,
        ordering: i,
        plan_origin: 'ai_recommended' as PlanOrigin,
        goal_id: a.goalId ?? goalMap?.[a.activityId] ?? null,
      }));
      const { error: saErr } = await supabase
        .from('session_activities')
        .insert(rows);
      if (saErr) throw saErr;

      // 4. Audit log
      await supabase.from('audit_log').insert({
        action: 'session_plan.accepted',
        actor_id: actorId,
        center_id: centerId,
        entity_id: sessionId,
        entity_type: 'session',
        after_state: {
          session_plan_id: planRow?.id ?? null,
          wasEdited,
          activityCount: finalActivities.length,
        } as unknown as Database['public']['Tables']['audit_log']['Insert']['after_state'],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions-list'] });
      qc.invalidateQueries({ queryKey: ['session'] });
      qc.invalidateQueries({ queryKey: ['session-activities'] });
      qc.invalidateQueries({ queryKey: ['session-plans'] });
    },
  });
}
