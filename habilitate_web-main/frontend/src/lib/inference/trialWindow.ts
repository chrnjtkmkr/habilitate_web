import type { EngagementSample } from './promptLevelInference';

const WINDOW_MS = 10_000; // 10-second pre-response window

// Extract engagement samples in the 10-sec window before trial response timestamp.
export function getTrialWindowSamples(
  trialRecordedAt: string,
  allSamples: EngagementSample[],
): EngagementSample[] {
  const trialTime = new Date(trialRecordedAt).getTime();
  const windowStart = trialTime - WINDOW_MS;

  return allSamples.filter(s => s.time >= windowStart && s.time <= trialTime);
}
