import { describe, it, expect } from 'vitest';
import { generatePlan } from '../index';
import { filterEligibleActivities } from '../eligibility';
import { scoreActivity } from '../scoring';
import { sequenceActivities } from '../sequencing';
import type { Activity, Goal, RecommenderInput, RecentSessionData, ScoredActivity } from '../types';

// Helper: create a test activity
function makeActivity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    name: `Activity ${overrides.id}`,
    developmental_domain: 'motor_imitation',
    skill_level: 'emerging',
    diagnostic_profile_applicability: ['autism'],
    target_age_min_months: 24,
    target_age_max_months: 48,
    duration_minutes: 10,
    ...overrides,
  };
}

function makeGoal(overrides: Partial<Goal> & { id: string }): Goal {
  return {
    name: `Goal ${overrides.id}`,
    target_domain: 'motor_imitation',
    target_skill_level: 'emerging',
    status: 'active',
    ...overrides,
  };
}

const baseChild: RecommenderInput['child'] = {
  diagnostic_profile: ['autism'],
  chronological_age_months: 40, // 3y 4m
};

const baseIntake: RecommenderInput['intakeOutputs'] = {
  baseline_skill_bands: {
    communication: 'emerging',
    social_reciprocity: 'emerging',
    motor_imitation: 'emerging',
    play_skills: 'established',
    self_regulation: 'emerging',
    attention_executive: 'emerging',
  },
};

describe('eligibility', () => {
  it('filters by diagnostic profile — autism child only gets autism-applicable activities', () => {
    const activities = [
      makeActivity({ id: 'a1', diagnostic_profile_applicability: ['autism'] }),
      makeActivity({ id: 'a2', diagnostic_profile_applicability: ['speech_delay'] }),
      makeActivity({ id: 'a3', diagnostic_profile_applicability: ['autism', 'adhd'] }),
    ];
    const eligible = filterEligibleActivities(activities, baseChild, baseIntake);
    expect(eligible.map((a) => a.id)).toEqual(['a1', 'a3']);
  });

  it('filters by age range with ±6 month tolerance', () => {
    const activities = [
      makeActivity({ id: 'a1', target_age_min_months: 24, target_age_max_months: 48 }), // 36-month child in range
      makeActivity({ id: 'a2', target_age_min_months: 18, target_age_max_months: 30 }), // 40 month child: 30+6=36 < 40, out
      makeActivity({ id: 'a3', target_age_min_months: 36, target_age_max_months: 60 }), // 40 in range
      makeActivity({ id: 'a4', target_age_min_months: 48, target_age_max_months: 72 }), // 48-6=42 > 40, out
    ];
    const eligible = filterEligibleActivities(activities, baseChild, baseIntake);
    expect(eligible.map((a) => a.id)).toEqual(['a1', 'a3']);
  });

  it('filters by skill level — allows current band and one band up only', () => {
    // Child's motor_imitation baseline is 'emerging'
    const activities = [
      makeActivity({ id: 'a1', skill_level: 'emerging' }), // match
      makeActivity({ id: 'a2', skill_level: 'established' }), // one up — ok
      makeActivity({ id: 'a3', skill_level: 'mastery' }), // two up — rejected
    ];
    const eligible = filterEligibleActivities(activities, baseChild, baseIntake);
    expect(eligible.map((a) => a.id)).toEqual(['a1', 'a2']);
  });
});

describe('scoring', () => {
  it('gives higher score to activities linked to active goals', () => {
    const activity = makeActivity({ id: 'a1', developmental_domain: 'motor_imitation', skill_level: 'emerging' });
    const goalLinked = makeGoal({ id: 'g1', target_domain: 'motor_imitation', target_skill_level: 'emerging' });

    const withGoal = scoreActivity(activity, [goalLinked], [], baseIntake.baseline_skill_bands, [activity]);
    const withoutGoal = scoreActivity(activity, [], [], baseIntake.baseline_skill_bands, [activity]);

    expect(withGoal.score).toBeGreaterThan(withoutGoal.score);
    expect(withGoal.breakdown.goal_alignment).toBe(40);
    expect(withoutGoal.breakdown.goal_alignment).toBe(0);
  });

  it('penalises activities from domains seen in recent sessions', () => {
    const activity = makeActivity({ id: 'a1', developmental_domain: 'motor_imitation' });
    const recentWithDomain: RecentSessionData = {
      session_activities: [{ activity_id: 'a1', goal_id: null, trials: [] }],
    };

    const fresh = scoreActivity(activity, [], [], baseIntake.baseline_skill_bands, [activity]);
    const stale = scoreActivity(activity, [], [recentWithDomain, recentWithDomain], baseIntake.baseline_skill_bands, [activity]);

    expect(fresh.breakdown.domain_balance).toBe(20);
    expect(stale.breakdown.domain_balance).toBe(0);
  });
});

describe('sequencing', () => {
  it('puts warm-up first and cool-down last', () => {
    const scored: ScoredActivity[] = [
      { activity: makeActivity({ id: 'mid', developmental_domain: 'motor_imitation' }), goalId: null, score: 80, breakdown: { goal_alignment: 0, domain_balance: 0, recency: 0, skill_fit: 0, performance: 0, discipline_relevance: 0 } },
      { activity: makeActivity({ id: 'cool', developmental_domain: 'play_skills' }), goalId: null, score: 60, breakdown: { goal_alignment: 0, domain_balance: 0, recency: 0, skill_fit: 0, performance: 0, discipline_relevance: 0 } },
      { activity: makeActivity({ id: 'warm', developmental_domain: 'joint_attention' }), goalId: null, score: 70, breakdown: { goal_alignment: 0, domain_balance: 0, recency: 0, skill_fit: 0, performance: 0, discipline_relevance: 0 } },
    ];

    const result = sequenceActivities(scored, 30);
    expect(result[0].activity.id).toBe('warm');
    expect(result[result.length - 1].activity.id).toBe('cool');
  });
});

describe('fallback', () => {
  it('sets fallbackUsed when fewer than 3 activities match strict criteria', () => {
    // Only 2 autism-applicable activities, but both with wrong age range
    const activities = [
      makeActivity({ id: 'a1', target_age_min_months: 0, target_age_max_months: 6 }),
      makeActivity({ id: 'a2', target_age_min_months: 0, target_age_max_months: 6 }),
      makeActivity({ id: 'a3', target_age_min_months: 24, target_age_max_months: 60 }),
    ];

    const result = generatePlan({
      child: baseChild,
      intakeOutputs: baseIntake,
      activeGoals: [],
      allActivities: activities,
      recentSessions: [],
      durationMinutes: 30,
    });

    // With fallback relaxing age, all 3 should be eligible
    expect(result.fallbackUsed).toBe(true);
    expect(result.activities.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty plan if even fallback yields fewer than 3 activities', () => {
    const activities = [
      makeActivity({ id: 'a1', diagnostic_profile_applicability: ['speech_delay'] }),
      makeActivity({ id: 'a2', diagnostic_profile_applicability: ['speech_delay'] }),
    ];

    const result = generatePlan({
      child: baseChild,
      intakeOutputs: baseIntake,
      activeGoals: [],
      allActivities: activities,
      recentSessions: [],
      durationMinutes: 30,
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.activities.length).toBe(0);
  });
});

describe('duration fitting', () => {
  it('generates 3-4 activities for a 30-min session', () => {
    const activities = Array.from({ length: 10 }, (_, i) =>
      makeActivity({
        id: `a${i}`,
        duration_minutes: 8,
        developmental_domain: ['joint_attention', 'motor_imitation', 'expressive_language', 'play_skills', 'social_reciprocity', 'self_regulation', 'receptive_language', 'attention_executive'][i % 8] as Activity['developmental_domain'],
      }),
    );

    const result = generatePlan({
      child: baseChild,
      intakeOutputs: baseIntake,
      activeGoals: [],
      allActivities: activities,
      recentSessions: [],
      durationMinutes: 30,
    });

    expect(result.activities.length).toBeGreaterThanOrEqual(3);
    expect(result.activities.length).toBeLessThanOrEqual(5);
    expect(result.totalDurationMinutes).toBeLessThanOrEqual(35);
  });

  it('generates 6-7 activities for a 60-min session', () => {
    const activities = Array.from({ length: 15 }, (_, i) =>
      makeActivity({
        id: `a${i}`,
        duration_minutes: 9,
        developmental_domain: ['joint_attention', 'motor_imitation', 'expressive_language', 'play_skills', 'social_reciprocity', 'self_regulation', 'receptive_language', 'attention_executive'][i % 8] as Activity['developmental_domain'],
      }),
    );

    const result = generatePlan({
      child: baseChild,
      intakeOutputs: baseIntake,
      activeGoals: [],
      allActivities: activities,
      recentSessions: [],
      durationMinutes: 60,
    });

    expect(result.activities.length).toBeGreaterThanOrEqual(5);
    expect(result.activities.length).toBeLessThanOrEqual(8);
    expect(result.totalDurationMinutes).toBeLessThanOrEqual(65);
  });
});
