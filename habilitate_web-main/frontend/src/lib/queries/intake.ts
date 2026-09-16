import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Json } from '../../types/supabase';
import { computeOutputs } from '../intake/computeOutputs';

export function useActiveInstrument() {
  return useQuery({
    queryKey: ['intake-instrument'],
    queryFn: async () => {
      // maybeSingle: returns null when no active instrument exists,
      // rather than throwing 406 (which .single() does on zero rows).
      const { data, error } = await supabase
        .from('intake_instruments')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useChildIntake(childId: string | undefined) {
  return useQuery({
    queryKey: ['intake-assessment', childId],
    queryFn: async () => {
      const { data: assessment, error: aErr } = await supabase
        .from('intake_assessments')
        .select('*')
        .eq('child_id', childId!)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (aErr) throw aErr;
      if (!assessment) return null;

      const { data: responses, error: rErr } = await supabase
        .from('intake_responses')
        .select('*')
        .eq('assessment_id', assessment.id);
      if (rErr) throw rErr;

      return { assessment, responses: responses ?? [] };
    },
    enabled: !!childId,
  });
}

export function useStartOrResumeIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      childId,
      instrumentId,
      userId,
      centerId,
    }: {
      childId: string;
      instrumentId: string;
      userId: string;
      centerId: string;
    }) => {
      // Check for existing in_progress assessment
      const { data: existing } = await supabase
        .from('intake_assessments')
        .select('*')
        .eq('child_id', childId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) return existing;

      // Create new assessment
      const { data, error } = await supabase
        .from('intake_assessments')
        .insert({
          child_id: childId,
          instrument_id: instrumentId,
          administered_by: userId,
          status: 'in_progress',
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Insert returned no data');

      // Update child intake_status
      const { data: childData, error: childErr } = await supabase
        .from('children')
        .update({ intake_status: 'in_progress' })
        .eq('id', childId)
        .select('id');
      if (childErr) throw childErr;
      if (!childData || childData.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      // Audit log
      await supabase.from('audit_log').insert({
        action: 'intake.started',
        actor_id: userId,
        center_id: centerId,
        entity_id: data.id,
        entity_type: 'intake_assessment',
      });

      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['intake-assessment', vars.childId] });
      qc.invalidateQueries({ queryKey: ['child', vars.childId] });
    },
  });
}

export function useUpsertResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      assessmentId: string;
      itemId: string;
      responseValue: Json;
      childId: string;
    }) => {
      // Try update first, then insert
      const { data: existing } = await supabase
        .from('intake_responses')
        .select('id')
        .eq('assessment_id', params.assessmentId)
        .eq('item_id', params.itemId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('intake_responses')
          .update({ response_value: params.responseValue, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
        }
      } else {
        const { error } = await supabase
          .from('intake_responses')
          .insert({
            assessment_id: params.assessmentId,
            item_id: params.itemId,
            response_value: params.responseValue,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['intake-assessment', vars.childId] });
    },
  });
}

export function useFinalizeIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assessmentId,
      childId,
      childDob,
      instrumentPayload,
      responses,
      userId,
      centerId,
    }: {
      assessmentId: string;
      childId: string;
      childDob: string;
      instrumentPayload: Json;
      responses: Map<string, Json>;
      userId: string;
      centerId: string;
    }) => {
      const outputs = computeOutputs(instrumentPayload, responses, childDob);

      // Update assessment
      const { data: aData, error: aErr } = await supabase
        .from('intake_assessments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          computed_outputs: outputs as Json,
        })
        .eq('id', assessmentId)
        .select('id');
      if (aErr) throw aErr;
      if (!aData || aData.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      // Update child status (diagnostic_profile is NOT overwritten —
      // the therapist's working tags from Add Child / Edit Child are
      // the source of truth; the clinical DX-002 answer lives in
      // computed_outputs.child_profile.diagnostic_profile)
      const { data: cData, error: cErr } = await supabase
        .from('children')
        .update({
          intake_status: 'completed',
        })
        .eq('id', childId)
        .select('id');
      if (cErr) throw cErr;
      if (!cData || cData.length === 0) {
        throw new Error('Save failed — you may no longer have access to this record. Refresh and try again.');
      }

      // Audit log
      await supabase.from('audit_log').insert({
        action: 'intake.completed',
        actor_id: userId,
        center_id: centerId,
        entity_id: assessmentId,
        entity_type: 'intake_assessment',
        after_state: outputs as Json,
      });

      return outputs;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['intake-assessment', vars.childId] });
      qc.invalidateQueries({ queryKey: ['child', vars.childId] });
      qc.invalidateQueries({ queryKey: ['children'] });
    },
  });
}
