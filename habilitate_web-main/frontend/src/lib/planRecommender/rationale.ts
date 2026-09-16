import type { ScoredActivity, Goal, RecentSessionData, Activity } from './types';
import { getBaselineBandForDomain } from './eligibility';

interface RationaleBullet {
  key: string;
  values?: Record<string, string | number>;
}

function domainLabel(domain: string): string {
  return domain.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const WARMUP_DOMAINS = new Set(['joint_attention', 'social_reciprocity']);
const COOLDOWN_DOMAINS = new Set(['play_skills', 'self_regulation']);

export function buildRationale(
  scored: ScoredActivity,
  goals: Goal[],
  recentSessions: RecentSessionData[],
  baselineSkillBands: Record<string, string>,
  allActivities: Activity[],
  positionInPlan: number,
  planLength: number,
  sessionDisciplineId?: string | null,
): RationaleBullet[] {
  const bullets: RationaleBullet[] = [];

  // Goal alignment
  if (scored.breakdown.goal_alignment > 0 && scored.goalId) {
    const goal = goals.find((g) => g.id === scored.goalId);
    if (goal) {
      bullets.push({ key: 'rationale_goal_aligned', values: { goalName: goal.name } });
    }
  }

  // Domain balance
  if (scored.breakdown.domain_balance >= 20) {
    let sessionsSince = 0;
    for (const session of recentSessions.slice(0, 3)) {
      const hasDomain = session.session_activities.some((sa) => {
        const act = allActivities.find((a) => a.id === sa.activity_id);
        return act?.developmental_domain === scored.activity.developmental_domain;
      });
      if (!hasDomain) sessionsSince++;
      else break;
    }
    bullets.push({
      key: 'rationale_domain_underused',
      values: { domain: domainLabel(scored.activity.developmental_domain), sessionsSince: pluralize(sessionsSince || 3, 'session') },
    });
  }

  // Recency — new activity
  if (scored.breakdown.recency >= 15) {
    bullets.push({ key: 'rationale_new_activity' });
  }

  // Skill-level fit
  if (scored.breakdown.skill_fit > 0) {
    const band = getBaselineBandForDomain(scored.activity.developmental_domain, baselineSkillBands);
    if (band) {
      bullets.push({
        key: 'rationale_skill_match',
        values: { domain: domainLabel(scored.activity.developmental_domain), level: scored.activity.skill_level },
      });
    }
  }

  // Performance signal
  if (scored.breakdown.performance >= 10) {
    // Determine which kind: mastery or struggling
    const recentTrials: string[] = [];
    for (const session of recentSessions.slice(0, 2)) {
      for (const sa of session.session_activities) {
        if (sa.activity_id === scored.activity.id) {
          for (const trial of sa.trials) {
            recentTrials.push(trial.response);
          }
        }
      }
    }
    if (recentTrials.length > 0) {
      const positiveCount = recentTrials.filter(
        (r) => r === 'responded' || r === 'partial' || r === 'correct',
      ).length;
      const rate = Math.round((positiveCount / recentTrials.length) * 100);
      if (rate > 70) {
        bullets.push({
          key: 'rationale_mastery_practice',
          values: { domain: domainLabel(scored.activity.developmental_domain), recentRate: rate },
        });
      } else {
        bullets.push({
          key: 'rationale_struggling_reinforcement',
          values: { domain: domainLabel(scored.activity.developmental_domain), recentRate: rate },
        });
      }
    }
  }

  // Discipline relevance
  if (scored.breakdown.discipline_relevance > 0 && sessionDisciplineId) {
    bullets.push({
      key: 'rationale_discipline_match',
      values: { discipline: sessionDisciplineId.replace(/_/g, ' ') },
    });
  }

  // Position-based rationale
  if (positionInPlan === 0 && WARMUP_DOMAINS.has(scored.activity.developmental_domain)) {
    bullets.push({ key: 'rationale_warmup_position' });
  }
  if (positionInPlan === planLength - 1 && COOLDOWN_DOMAINS.has(scored.activity.developmental_domain)) {
    bullets.push({ key: 'rationale_cooldown_position' });
  }

  // Keep max 3 bullets
  return bullets.slice(0, 3);
}
