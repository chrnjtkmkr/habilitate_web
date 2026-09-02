import { supabase } from '../supabase';
import { inferPromptLevel, type InferenceResult, type EngagementSample } from './promptLevelInference';
import { getTrialWindowSamples } from './trialWindow';

// Run batch prompt-level inference for all trials in a session.
// Called once at session finalization. Fire-and-forget — errors are logged, not thrown.
export async function batchInferTrialsForSession(sessionId: string): Promise<InferenceResult[]> {
  // 1. Fetch all session_activities for this session
  const { data: saRows, error: saErr } = await supabase
    .from('session_activities')
    .select('id')
    .eq('session_id', sessionId);
  if (saErr || !saRows?.length) {
    console.warn('[promptInference] No session_activities found for session', sessionId);
    return [];
  }

  const saIds = saRows.map(sa => sa.id);

  // 2. Fetch all trials for those session_activities
  const { data: trials, error: trialErr } = await supabase
    .from('trials')
    .select('id, session_activity_id, response, recorded_at, trial_number')
    .in('session_activity_id', saIds)
    .order('recorded_at');
  if (trialErr || !trials?.length) {
    console.warn('[promptInference] No trials found for session', sessionId);
    return [];
  }

  // 3. Fetch all engagement_samples for the session
  const { data: rawSamples, error: engErr } = await supabase
    .from('engagement_samples')
    .select('recorded_at, voice_state, head_pose')
    .eq('session_id', sessionId)
    .order('recorded_at');
  if (engErr) {
    console.warn('[promptInference] Failed to fetch engagement_samples', engErr);
    return [];
  }

  const allSamples: EngagementSample[] = (rawSamples ?? []).map(s => ({
    time: new Date(s.recorded_at).getTime(),
    voiceState: s.voice_state,
    headPose: s.head_pose as { yaw: number; pitch: number; roll: number } | null,
  }));

  // 4. Infer prompt level for each trial
  const results: InferenceResult[] = [];
  for (const trial of trials) {
    const windowSamples = getTrialWindowSamples(trial.recorded_at, allSamples);
    const result = inferPromptLevel({
      trial: { id: trial.id, recorded_at: trial.recorded_at, response: trial.response },
      windowSamples,
    });
    results.push(result);
  }

  // 5. Bulk upsert into trial_prompt_inferences
  const rows = results.map(r => ({
    trial_id: r.trialId,
    inferred_level: r.inferredLevel,
    confidence: r.confidence,
    signal_summary: r.signalSummary,
  }));

  const { error: upsertErr } = await supabase
    .from('trial_prompt_inferences')
    .upsert(rows, { onConflict: 'trial_id' });

  if (upsertErr) {
    console.error('[promptInference] Upsert failed', upsertErr);
  } else {
    console.log('[promptInference] Batch inference for session', sessionId, '— inferred', results.length, 'trials');
  }

  return results;
}
