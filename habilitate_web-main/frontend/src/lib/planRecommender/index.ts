import type { RecommenderInput, PlanOutput, RecommendedActivity } from './types';
import { filterEligibleActivities } from './eligibility';
import { scoreActivity } from './scoring';
import { sequenceActivities } from './sequencing';
import { buildRationale } from './rationale';

const GENERATOR_VERSION = 'recommender-v1';
const MIN_ACTIVITIES_THRESHOLD = 3;

export function generatePlan(input: RecommenderInput): PlanOutput {
  const { child, intakeOutputs, activeGoals, allActivities, recentSessions, durationMinutes, sessionDisciplineId } = input;

  // Phase 1: filter eligible activities
  let eligible = filterEligibleActivities(allActivities, child, intakeOutputs);
  let fallbackUsed = false;

  // Fallback: if fewer than 3 eligible activities, relax constraints
  if (eligible.length < MIN_ACTIVITIES_THRESHOLD) {
    fallbackUsed = true;
    eligible = filterEligibleActivities(allActivities, child, intakeOutputs, {
      skipAge: true,
      skipSkillLevel: true,
    });

    // If still too few, return empty plan
    if (eligible.length < MIN_ACTIVITIES_THRESHOLD) {
      return {
        activities: [],
        generatorVersion: GENERATOR_VERSION,
        totalDurationMinutes: 0,
        fallbackUsed: true,
        activityNames: {},
      };
    }
  }

  // Phase 2: score each eligible activity
  const scored = eligible.map((activity) =>
    scoreActivity(activity, activeGoals, recentSessions, intakeOutputs.baseline_skill_bands, allActivities, sessionDisciplineId),
  );

  // Phase 3: sequence and select to fit duration
  const sequenced = sequenceActivities(scored, durationMinutes);

  // Phase 4: build output with rationale
  const activities: RecommendedActivity[] = sequenced.map((item, index) => ({
    activityId: item.activity.id,
    goalId: item.goalId,
    sequenceIndex: index,
    durationMinutes: item.activity.duration_minutes,
    rationale: buildRationale(
      item,
      activeGoals,
      recentSessions,
      intakeOutputs.baseline_skill_bands,
      allActivities,
      index,
      sequenced.length,
      sessionDisciplineId,
    ),
  }));

  const totalDurationMinutes = activities.reduce((sum, a) => sum + a.durationMinutes, 0);

  const activityNames: Record<string, string> = {};
  for (const a of allActivities) {
    activityNames[a.id] = a.name;
  }

  return {
    activities,
    generatorVersion: GENERATOR_VERSION,
    totalDurationMinutes,
    fallbackUsed,
    activityNames,
  };
}

export { GENERATOR_VERSION };
export type { RecommenderInput, PlanOutput, RecommendedActivity } from './types';
