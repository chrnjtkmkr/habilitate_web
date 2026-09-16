export interface VoiceMetrics {
  adultPct: number;
  childPct: number;
  silencePct: number;
  therapistToChildTransitions: number;
  childToTherapistTransitions: number;
  longestChildSpeechSec: number;
  longestSilenceSec: number;
  totalVoiceSegments: number;
}

type VoiceState = 'silence' | 'child_speaking' | 'adult_speaking';

const SAMPLE_INTERVAL_SEC = 5;

export function computeVoiceMetrics(
  samples: Array<{ voiceState: string | null; time: number }>,
): VoiceMetrics {
  if (samples.length === 0) {
    return {
      adultPct: 0, childPct: 0, silencePct: 100,
      therapistToChildTransitions: 0, childToTherapistTransitions: 0,
      longestChildSpeechSec: 0, longestSilenceSec: 0, totalVoiceSegments: 0,
    };
  }

  const sorted = [...samples].sort((a, b) => a.time - b.time);
  let adult = 0, child = 0, silence = 0;

  for (const s of sorted) {
    if (s.voiceState === 'adult_speaking') adult++;
    else if (s.voiceState === 'child_speaking') child++;
    else silence++;
  }

  const total = sorted.length;
  const adultPct = (adult / total) * 100;
  const childPct = (child / total) * 100;
  const silencePct = (silence / total) * 100;

  // Transitions: allow one silence sample gap (2-sample window)
  let therapistToChild = 0;
  let childToTherapist = 0;

  // Track last non-silence speaker for transition counting
  let lastSpeaker: 'adult_speaking' | 'child_speaking' | null = null;
  for (const s of sorted) {
    const vs = s.voiceState as VoiceState;
    if (vs === 'child_speaking' || vs === 'adult_speaking') {
      if (lastSpeaker && lastSpeaker !== vs) {
        if (lastSpeaker === 'adult_speaking' && vs === 'child_speaking') therapistToChild++;
        else if (lastSpeaker === 'child_speaking' && vs === 'adult_speaking') childToTherapist++;
      }
      lastSpeaker = vs;
    }
  }

  // Contiguous run analysis
  let longestChildSpeechSec = 0;
  let longestSilenceSec = 0;
  let totalVoiceSegments = 0;

  let currentRun = 0;
  let currentState: VoiceState | null = null;

  for (const s of sorted) {
    const vs = (s.voiceState ?? 'silence') as VoiceState;
    if (vs === currentState) {
      currentRun++;
    } else {
      // Finalize previous run
      if (currentState === 'child_speaking') {
        longestChildSpeechSec = Math.max(longestChildSpeechSec, currentRun * SAMPLE_INTERVAL_SEC);
      } else if (currentState === 'silence') {
        longestSilenceSec = Math.max(longestSilenceSec, currentRun * SAMPLE_INTERVAL_SEC);
      }

      // Count start of a new voice segment
      if (vs !== 'silence' && (currentState === 'silence' || currentState === null)) {
        totalVoiceSegments++;
      }
      // Also count transition from one speaker to another as a new voice segment
      if (vs !== 'silence' && currentState !== 'silence' && currentState !== null && vs !== currentState) {
        totalVoiceSegments++;
      }

      currentRun = 1;
      currentState = vs;
    }
  }

  // Finalize last run
  if (currentState === 'child_speaking') {
    longestChildSpeechSec = Math.max(longestChildSpeechSec, currentRun * SAMPLE_INTERVAL_SEC);
  } else if (currentState === 'silence') {
    longestSilenceSec = Math.max(longestSilenceSec, currentRun * SAMPLE_INTERVAL_SEC);
  }

  return {
    adultPct, childPct, silencePct,
    therapistToChildTransitions: therapistToChild,
    childToTherapistTransitions: childToTherapist,
    longestChildSpeechSec,
    longestSilenceSec,
    totalVoiceSegments,
  };
}
