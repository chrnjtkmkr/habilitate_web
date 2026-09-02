import type { ScoredActivity } from './types';

// Warm-up domains — approachable, social activities that ease the child in
const WARMUP_DOMAINS = new Set(['joint_attention', 'social_reciprocity']);
// Cool-down domains — calming, low-demand activities to wind down
const COOLDOWN_DOMAINS = new Set(['play_skills', 'self_regulation']);

export function sequenceActivities(
  scoredActivities: ScoredActivity[],
  durationMinutes: number,
): ScoredActivity[] {
  // Sort by score descending
  const sorted = [...scoredActivities].sort((a, b) => b.score - a.score);

  // Greedy select to fill target duration, hard upper bound = target + 5
  const upperBound = durationMinutes + 5;
  const selected: ScoredActivity[] = [];
  let totalDuration = 0;

  // Estimate plan size to compute goal cap (40% of slots)
  const avgDuration = sorted.length > 0
    ? sorted.reduce((s, a) => s + a.activity.duration_minutes, 0) / sorted.length
    : 10;
  const estimatedSlots = Math.max(1, Math.round(durationMinutes / avgDuration));
  const goalCap = Math.max(1, Math.floor(estimatedSlots * 0.4));
  const goalCounts: Record<string, number> = {};

  for (const item of sorted) {
    let effectiveScore = item.score;
    const gId = item.goalId ?? '__none__';
    if (goalCounts[gId] && goalCounts[gId] >= goalCap) {
      effectiveScore -= 30;
    }

    if (totalDuration + item.activity.duration_minutes <= upperBound && effectiveScore > 0) {
      selected.push(item);
      totalDuration += item.activity.duration_minutes;
      goalCounts[gId] = (goalCounts[gId] ?? 0) + 1;
    }
    if (totalDuration >= durationMinutes) break;
  }

  if (selected.length === 0) return [];

  // Reorder for clinical flow: warm-up first, cool-down last, middle by score
  const warmup = selected.filter((s) => WARMUP_DOMAINS.has(s.activity.developmental_domain));
  const cooldown = selected.filter((s) => COOLDOWN_DOMAINS.has(s.activity.developmental_domain));
  const middle = selected.filter(
    (s) =>
      !WARMUP_DOMAINS.has(s.activity.developmental_domain) &&
      !COOLDOWN_DOMAINS.has(s.activity.developmental_domain),
  );

  // Pick best warm-up and best cool-down (by score)
  const bestWarmup = warmup.length > 0 ? warmup[0] : null;
  const bestCooldown = cooldown.length > 0 ? cooldown[cooldown.length > 1 ? cooldown.length - 1 : 0] : null;

  // Build the final order
  const result: ScoredActivity[] = [];

  if (bestWarmup) {
    result.push(bestWarmup);
  }

  // Add remaining warm-ups (not the chosen one) and middle activities
  const remainingWarmups = warmup.filter((s) => s !== bestWarmup);
  const middleAndRest = [...remainingWarmups, ...middle].sort((a, b) => b.score - a.score);
  result.push(...middleAndRest);

  // Add cool-downs except the chosen last one, then the chosen last
  const remainingCooldowns = cooldown.filter((s) => s !== bestCooldown);
  if (remainingCooldowns.length > 0) {
    result.push(...remainingCooldowns);
  }
  if (bestCooldown && bestCooldown !== bestWarmup) {
    result.push(bestCooldown);
  }

  return result;
}
