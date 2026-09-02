import type { Database } from '../../types/supabase';

type ActivityDomain = Database['public']['Enums']['activity_domain'];
type SkillLevel = Database['public']['Enums']['skill_level'];
type DiagnosticProfile = Database['public']['Enums']['diagnostic_profile'];
type TrialResponse = Database['public']['Enums']['trial_response'];

export interface Activity {
  id: string;
  name: string;
  developmental_domain: ActivityDomain;
  skill_level: SkillLevel;
  diagnostic_profile_applicability: DiagnosticProfile[];
  target_age_min_months: number;
  target_age_max_months: number;
  duration_minutes: number;
}

export interface Goal {
  id: string;
  name: string;
  target_domain: ActivityDomain;
  target_skill_level: SkillLevel;
  status: string;
}

export interface RecentSessionData {
  session_activities: {
    activity_id: string;
    goal_id: string | null;
    trials: {
      response: TrialResponse;
    }[];
  }[];
}

export interface RecommenderInput {
  child: {
    diagnostic_profile: DiagnosticProfile[];
    chronological_age_months: number;
  };
  intakeOutputs: {
    baseline_skill_bands: Record<string, string>;
  };
  activeGoals: Goal[];
  allActivities: Activity[];
  recentSessions: RecentSessionData[];
  durationMinutes: number;
  // The discipline this session is being delivered in — used for scoring, not filtering.
  sessionDisciplineId?: string | null;
}

export interface ScoreBreakdown {
  goal_alignment: number;
  domain_balance: number;
  recency: number;
  skill_fit: number;
  performance: number;
  discipline_relevance: number;
}

export interface ScoredActivity {
  activity: Activity;
  goalId: string | null;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface RecommendedActivity {
  activityId: string;
  goalId: string | null;
  sequenceIndex: number;
  durationMinutes: number;
  rationale: { key: string; values?: Record<string, string | number> }[];
}

export interface PlanOutput {
  activities: RecommendedActivity[];
  generatorVersion: string;
  totalDurationMinutes: number;
  fallbackUsed: boolean;
  activityNames: Record<string, string>;
}
