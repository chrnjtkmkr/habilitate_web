// Prompt-level inference engine.
//
// We have: audio diarization (voice_state) + head pose (yaw/pitch/roll).
// We do NOT have: hand tracking, body pose, or gaze target.
//
// Therefore we can confidently detect:
//   - Verbal prompts (adult voice active before trial response)
//   - Independent (no adult voice, child responded, head down toward materials)
//
// We CANNOT auto-detect:
//   - Gestural prompts (requires hand tracking — therapist pointing, tapping)
//   - Physical prompts (requires body contact detection — hand-over-hand)
//
// Gestural and Physical are reserved for therapist manual correction only.
// Hand tracking is on the roadmap for Q3.

export type InferredLevel = 'independent' | 'verbal_prompt' | 'gestural_prompt' | 'physical_prompt' | 'unclear';
export type Confidence = 'high' | 'medium' | 'low' | 'very_low';

export interface EngagementSample {
  time: number;
  voiceState: string | null;
  headPose: { yaw: number; pitch: number; roll: number } | null;
}

export interface TrialContext {
  trial: {
    id: string;
    recorded_at: string;
    response: string;
  };
  windowSamples: EngagementSample[];
}

export interface InferenceResult {
  trialId: string;
  inferredLevel: InferredLevel;
  confidence: Confidence;
  signalSummary: {
    adult_voice_pct: number;
    child_voice_pct: number;
    silence_pct: number;
    avg_head_pitch: number;
    avg_head_yaw: number;
    sample_count: number;
  };
}

function computeWindowStats(samples: EngagementSample[]) {
  if (samples.length === 0) {
    return { adultPct: 0, childPct: 0, silencePct: 100, avgPitch: 0, avgYaw: 0, hasPose: false };
  }

  let adult = 0, child = 0, silence = 0;
  let pitchSum = 0, yawSum = 0, poseCount = 0;

  for (const s of samples) {
    if (s.voiceState === 'adult_speaking') adult++;
    else if (s.voiceState === 'child_speaking') child++;
    else silence++;

    if (s.headPose) {
      pitchSum += Math.abs(s.headPose.pitch);
      yawSum += Math.abs(s.headPose.yaw);
      poseCount++;
    }
  }

  const total = samples.length;
  return {
    adultPct: (adult / total) * 100,
    childPct: (child / total) * 100,
    silencePct: (silence / total) * 100,
    avgPitch: poseCount > 0 ? pitchSum / poseCount : 0,
    avgYaw: poseCount > 0 ? yawSum / poseCount : 0,
    hasPose: poseCount > 0,
  };
}

export function inferPromptLevel(ctx: TrialContext): InferenceResult {
  const stats = computeWindowStats(ctx.windowSamples);
  const responded = ctx.trial.response === 'responded' || ctx.trial.response === 'partial';

  const signalSummary = {
    adult_voice_pct: Math.round(stats.adultPct * 10) / 10,
    child_voice_pct: Math.round(stats.childPct * 10) / 10,
    silence_pct: Math.round(stats.silencePct * 10) / 10,
    avg_head_pitch: Math.round(stats.avgPitch * 10) / 10,
    avg_head_yaw: Math.round(stats.avgYaw * 10) / 10,
    sample_count: ctx.windowSamples.length,
  };

  // Rule 1: Verbal prompt — HIGH confidence
  // Adult voice dominant in pre-response window
  if (stats.adultPct >= 40) {
    return { trialId: ctx.trial.id, inferredLevel: 'verbal_prompt', confidence: 'high', signalSummary };
  }

  // Rule 2: Verbal prompt — MEDIUM confidence
  // Moderate adult voice presence
  if (stats.adultPct >= 20) {
    return { trialId: ctx.trial.id, inferredLevel: 'verbal_prompt', confidence: 'medium', signalSummary };
  }

  // Rule 3: Independent — MEDIUM confidence
  // Very little adult voice, child responded, head pitch suggests looking down at materials
  if (stats.adultPct < 10 && responded && stats.hasPose && stats.avgPitch > 8) {
    return { trialId: ctx.trial.id, inferredLevel: 'independent', confidence: 'medium', signalSummary };
  }

  // Rule 4: Independent — LOW confidence
  // Very little adult voice, child responded, but head pose unavailable or ambiguous
  if (stats.adultPct < 10 && responded) {
    return { trialId: ctx.trial.id, inferredLevel: 'independent', confidence: 'low', signalSummary };
  }

  // Rule 5: Unclear — catch-all
  // Signals contradict, insufficient data, or child didn't respond with minimal adult voice
  // We explicitly do NOT auto-classify as gestural_prompt or physical_prompt
  // because we lack hand tracking data to detect pointing, tapping, or hand-over-hand.
  return { trialId: ctx.trial.id, inferredLevel: 'unclear', confidence: 'very_low', signalSummary };
}
