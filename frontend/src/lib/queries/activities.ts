import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Database } from '../../types/supabase';

type ActivityDomain = Database['public']['Enums']['activity_domain'];
type SkillLevel = Database['public']['Enums']['skill_level'];
type DiagnosticProfile = Database['public']['Enums']['diagnostic_profile'];

export interface ActivityFilters {
  domains?: ActivityDomain[];
  skillLevels?: SkillLevel[];
  search?: string;
  diagnosticProfiles?: DiagnosticProfile[];
  // Goal-derived defaults — used when no manual chips override them
  goalDomains?: ActivityDomain[];
  goalSkillLevels?: SkillLevel[];
  // Age filter: show activities whose range overlaps with this age (±6 month tolerance)
  childAgeMonths?: number;
}

export function useActivities(filters?: ActivityFilters) {
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: async () => {
      // Include validated catalogue activities AND custom activities.
      // Custom activities are centre-scoped via RLS — the server only returns
      // those belonging to the caller's centre, so no client-side centre
      // filter is needed.
      let query = supabase
        .from('activities')
        .select('*')
        .in('validation_status', ['validated', 'custom']);

      // Resolve effective domain/skill filters:
      // Manual chips override goal-derived ones when present.
      const effectiveDomains = (filters?.domains && filters.domains.length > 0)
        ? filters.domains
        : (filters?.goalDomains ?? []);
      const effectiveSkillLevels = (filters?.skillLevels && filters.skillLevels.length > 0)
        ? filters.skillLevels
        : (filters?.goalSkillLevels ?? []);

      if (effectiveDomains.length > 0) {
        query = query.in('developmental_domain', effectiveDomains);
      }
      if (effectiveSkillLevels.length > 0) {
        query = query.in('skill_level', effectiveSkillLevels);
      }
      if (filters?.diagnosticProfiles && filters.diagnosticProfiles.length > 0) {
        query = query.overlaps('diagnostic_profile_applicability', filters.diagnosticProfiles);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      // Age filter: activity range must overlap child age ± 6 months
      if (filters?.childAgeMonths != null) {
        const age = filters.childAgeMonths;
        query = query.lte('target_age_min_months', age + 6).gte('target_age_max_months', age - 6);
      }

      query = query.order('name', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Lightweight lookup for activity metadata by IDs. Used by the preflight
// plan card to display names, domains, and durations for both catalogue
// and custom activities — independent of the recommender's validated-only pool.
export function useActivityLookup(ids: string[]) {
  return useQuery({
    queryKey: ['activity-lookup', ids],
    queryFn: async () => {
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from('activities')
        .select('id, name, developmental_domain, duration_minutes, validation_status')
        .in('id', ids);
      if (error) throw error;
      const map: Record<string, { name: string; domain: string; duration: number; isCustom: boolean }> = {};
      for (const a of data ?? []) {
        map[a.id] = { name: a.name, domain: a.developmental_domain, duration: a.duration_minutes, isCustom: a.validation_status === 'custom' };
      }
      return map;
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Signal bucket definitions — maps plain-language choices to
// measurement_bucket_id + the attribute_ids the CV/audio pipeline
// actually measures for that bucket.
export const SIGNAL_BUCKETS = [
  {
    bucketId: 'cam_face',
    attributeIds: ['looks_at_you', 'stays_activity'],
  },
  {
    bucketId: 'cam_hands',
    attributeIds: ['points_at_things', 'reaches_for_things', 'grasps_objects', 'claps_hands', 'waves'],
  },
  {
    bucketId: 'voice',
    attributeIds: ['makes_sounds', 'asks_on_own'],
  },
  {
    bucketId: 'therapist_scored',
    attributeIds: ['follows_instruction', 'copies_you', 'asks_for_wants'],
  },
] as const;

export type SignalBucketId = (typeof SIGNAL_BUCKETS)[number]['bucketId'];

export interface CreateCustomActivityInput {
  name: string;
  signalBucketIds: SignalBucketId[];
  durationMinutes: number;
  ageMinMonths?: number;
  ageMaxMonths?: number;
  steps?: string[];
  centerId: string;
  actorId: string;
}

export function useCreateCustomActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, signalBucketIds, durationMinutes, ageMinMonths, ageMaxMonths, steps, centerId, actorId }: CreateCustomActivityInput) => {
      const id = `CUSTOM-${crypto.randomUUID()}`;
      const primaryBucket = signalBucketIds[0] ?? 'therapist_scored';

      const { error: actErr } = await supabase
        .from('activities')
        .insert({
          id,
          name,
          validation_status: 'custom',
          created_by: actorId,
          center_id: centerId,
          framework_source: 'GENERAL_PRACTICE',
          developmental_domain: 'play_skills',
          skill_level: 'emerging',
          target_age_min_months: ageMinMonths ?? 0,
          target_age_max_months: ageMaxMonths ?? 216,
          duration_minutes: durationMinutes,
          mastery_criteria: 'Therapist-assessed',
          diagnostic_profile_applicability: [],
          measurement_bucket_id: primaryBucket,
          therapist_steps: (steps && steps.length > 0 ? steps : []) as unknown as Database['public']['Tables']['activities']['Insert']['therapist_steps'],
        });
      if (actErr) throw actErr;

      // Insert activity_signals for every attribute in every selected bucket
      const signalRows: { activity_id: string; attribute_id: string; is_primary: boolean }[] = [];
      for (const bucketId of signalBucketIds) {
        const bucket = SIGNAL_BUCKETS.find((b) => b.bucketId === bucketId);
        if (!bucket) continue;
        for (const attrId of bucket.attributeIds) {
          signalRows.push({
            activity_id: id,
            attribute_id: attrId,
            is_primary: bucketId === primaryBucket,
          });
        }
      }
      if (signalRows.length > 0) {
        const { error: sigErr } = await supabase.from('activity_signals').insert(signalRows);
        if (sigErr) throw sigErr;
      }

      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
