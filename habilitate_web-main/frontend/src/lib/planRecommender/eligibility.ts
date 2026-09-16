import type { Activity, RecommenderInput } from './types';

// Maps intake baseline domains to activity domains.
// Intake uses broader categories; activities use more specific ones.
const INTAKE_TO_ACTIVITY_DOMAIN: Record<string, string[]> = {
  communication: ['expressive_language', 'receptive_language'],
  social_reciprocity: ['social_reciprocity', 'joint_attention'],
  motor_imitation: ['motor_imitation'],
  play_skills: ['play_skills'],
  self_regulation: ['self_regulation'],
  attention_executive: ['attention_executive'],
};

// The skill_level enum has 3 ordered values
const SKILL_LEVEL_ORDER = ['emerging', 'established', 'mastery'] as const;

function skillLevelIndex(level: string): number {
  return SKILL_LEVEL_ORDER.indexOf(level as typeof SKILL_LEVEL_ORDER[number]);
}

// Get the intake baseline band for an activity's domain.
// joint_attention uses social_reciprocity, expressive/receptive_language use communication.
function getBaselineBandForDomain(
  activityDomain: string,
  baselineSkillBands: Record<string, string>,
): string | null {
  for (const [intakeDomain, activityDomains] of Object.entries(INTAKE_TO_ACTIVITY_DOMAIN)) {
    if (activityDomains.includes(activityDomain)) {
      return baselineSkillBands[intakeDomain] ?? null;
    }
  }
  return null;
}

export { getBaselineBandForDomain, skillLevelIndex, SKILL_LEVEL_ORDER };

// Rule: Activity's diagnostic_profile_applicability must overlap with child's diagnostic_profile
function matchesDiagnosticProfile(activity: Activity, childProfiles: string[]): boolean {
  return activity.diagnostic_profile_applicability.some((p) => childProfiles.includes(p));
}

// Rule: Activity's age range must encompass child's age, with +/- 6 month tolerance
function matchesAgeRange(activity: Activity, childAgeMonths: number): boolean {
  return (
    childAgeMonths >= activity.target_age_min_months - 6 &&
    childAgeMonths <= activity.target_age_max_months + 6
  );
}

// Rule: Activity skill_level must match child's baseline band ± 1 band upward only.
// A child at 'emerging' can attempt 'emerging' or 'established' but not 'mastery'.
// A child at 'established' can attempt 'emerging', 'established', or 'mastery'.
function matchesSkillLevel(
  activity: Activity,
  baselineSkillBands: Record<string, string>,
): boolean {
  const childBand = getBaselineBandForDomain(activity.developmental_domain, baselineSkillBands);
  if (!childBand) return true; // no baseline data — allow activity

  const childIdx = skillLevelIndex(childBand);
  const activityIdx = skillLevelIndex(activity.skill_level);
  if (childIdx === -1 || activityIdx === -1) return true; // unknown band — allow

  // Activity can be at child's level or one band up, and any band below
  return activityIdx <= childIdx + 1;
}

export interface EligibilityOptions {
  skipAge?: boolean;
  skipSkillLevel?: boolean;
}

export function filterEligibleActivities(
  allActivities: Activity[],
  child: RecommenderInput['child'],
  intakeOutputs: RecommenderInput['intakeOutputs'],
  options?: EligibilityOptions,
): Activity[] {
  return allActivities.filter((activity) => {
    // Always require diagnostic profile match
    if (!matchesDiagnosticProfile(activity, child.diagnostic_profile)) return false;

    if (!options?.skipAge && !matchesAgeRange(activity, child.chronological_age_months)) {
      return false;
    }
    if (!options?.skipSkillLevel && !matchesSkillLevel(activity, intakeOutputs.baseline_skill_bands)) {
      return false;
    }
    return true;
  });
}
