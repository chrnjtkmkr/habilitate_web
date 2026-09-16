import type { Activity, Goal, RecentSessionData, ScoredActivity } from './types';
import { getBaselineBandForDomain, skillLevelIndex } from './eligibility';

// Map discipline_id to developmental domains it is most relevant for.
// Activities in these domains score a bonus when the session's discipline matches.
// This is a soft boost, not a hard filter — cross-disciplinary work remains available.
const DISCIPLINE_DOMAIN_MAP: Record<string, string[]> = {
  speech_therapy: ['expressive_language', 'receptive_language', 'social_reciprocity'],
  occupational_therapy: ['fine_motor', 'motor_imitation', 'play_skills', 'self_regulation'],
  behavioural_therapy: ['joint_attention', 'social_reciprocity', 'self_regulation', 'attention_executive'],
  physiotherapy: ['gross_motor', 'motor_imitation'],
  special_education: ['attention_executive', 'play_skills', 'receptive_language', 'fine_motor'],
};

// Score component weights — total max = 110 (100 base + 10 discipline bonus)
// a. Goal alignment (40): activity linked to an active goal gets full points
// b. Domain balance (20): penalise domains that appeared recently
// c. Recency / variety (15): penalise repeated activities
// d. Skill-level fit (15): exact match > one band up
// e. Performance signal (10): bimodal — mastery and struggle are both valuable
// f. Discipline relevance (10): activity domain matches session discipline

function scoreGoalAlignment(activity: Activity, goals: Goal[]): { points: number; matchedGoal: Goal | null } {
  const match = goals.find(
    (g) => g.target_domain === activity.developmental_domain && g.target_skill_level === activity.skill_level,
  );
  return { points: match ? 40 : 0, matchedGoal: match ?? null };
}

function scoreDomainBalance(activity: Activity, recentSessions: RecentSessionData[], allActivities: Activity[]): number {
  // Count how many of the last 3 sessions included an activity in this domain
  let sessionsWithDomain = 0;
  for (const session of recentSessions.slice(0, 3)) {
    const hasDomain = session.session_activities.some((sa) => {
      const act = allActivities.find((a) => a.id === sa.activity_id);
      return act?.developmental_domain === activity.developmental_domain;
    });
    if (hasDomain) sessionsWithDomain++;
  }

  // Full 20 if not seen, 10 if seen once, 0 if seen 2+ times
  if (sessionsWithDomain === 0) return 20;
  if (sessionsWithDomain === 1) return 10;
  return 0;
}

function scoreRecency(activity: Activity, recentSessions: RecentSessionData[]): number {
  // If this exact activity_id appeared in last 3 sessions, 0 points; otherwise 15
  for (const session of recentSessions.slice(0, 3)) {
    if (session.session_activities.some((sa) => sa.activity_id === activity.id)) {
      return 0;
    }
  }
  return 15;
}

function scoreSkillFit(activity: Activity, baselineSkillBands: Record<string, string>): number {
  const childBand = getBaselineBandForDomain(activity.developmental_domain, baselineSkillBands);
  if (!childBand) return 15; // no data — assume good fit

  const childIdx = skillLevelIndex(childBand);
  const activityIdx = skillLevelIndex(activity.skill_level);
  if (childIdx === -1 || activityIdx === -1) return 15;

  // Exact match = 15, one band up = 8, below = 15 (also fine)
  if (activityIdx === childIdx) return 15;
  if (activityIdx === childIdx + 1) return 8;
  return 15; // below child's level — also a good fit
}

function scorePerformance(activity: Activity, recentSessions: RecentSessionData[]): number {
  // Collect trial responses for this activity across last 2 sessions
  const recentTrials: string[] = [];
  for (const session of recentSessions.slice(0, 2)) {
    for (const sa of session.session_activities) {
      if (sa.activity_id === activity.id) {
        for (const trial of sa.trials) {
          recentTrials.push(trial.response);
        }
      }
    }
  }

  if (recentTrials.length === 0) return 5; // no data — neutral score

  // "Positive" responses: responded, partial, correct
  const positiveCount = recentTrials.filter(
    (r) => r === 'responded' || r === 'partial' || r === 'correct',
  ).length;
  const positiveRate = positiveCount / recentTrials.length;

  // Bimodal scoring: >70% (mastery practice) = 10, <30% (struggling) = 10, 30-70% (plateau) = 5
  if (positiveRate > 0.7) return 10;
  if (positiveRate < 0.3) return 10;
  return 5;
}

function scoreDisciplineRelevance(activity: Activity, disciplineId: string | null | undefined): number {
  if (!disciplineId || disciplineId === 'unspecified') return 0; // no bonus
  const relevantDomains = DISCIPLINE_DOMAIN_MAP[disciplineId];
  if (!relevantDomains) return 0;
  return relevantDomains.includes(activity.developmental_domain) ? 10 : 0;
}

export function scoreActivity(
  activity: Activity,
  goals: Goal[],
  recentSessions: RecentSessionData[],
  baselineSkillBands: Record<string, string>,
  allActivities: Activity[],
  sessionDisciplineId?: string | null,
): ScoredActivity {
  const { points: goal_alignment, matchedGoal } = scoreGoalAlignment(activity, goals);
  const domain_balance = scoreDomainBalance(activity, recentSessions, allActivities);
  const recency = scoreRecency(activity, recentSessions);
  const skill_fit = scoreSkillFit(activity, baselineSkillBands);
  const performance = scorePerformance(activity, recentSessions);
  const discipline_relevance = scoreDisciplineRelevance(activity, sessionDisciplineId);

  return {
    activity,
    goalId: matchedGoal?.id ?? null,
    score: goal_alignment + domain_balance + recency + skill_fit + performance + discipline_relevance,
    breakdown: { goal_alignment, domain_balance, recency, skill_fit, performance, discipline_relevance },
  };
}
