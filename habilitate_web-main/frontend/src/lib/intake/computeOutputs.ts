import { differenceInMonths } from 'date-fns';
import type { Json } from '../../types/supabase';

interface InstrumentPayload {
  version?: string;
  sections: Section[];
}

interface Section {
  section_id: string;
  domain?: string;
  scoring_method?: string;
  skill_band_mapping?: Record<string, string>;
  items: Item[];
}

interface Item {
  id: string;
}



type Outputs = {
  child_profile: {
    diagnostic_profile: string[];
    chronological_age_months: number;
    primary_language: string | null;
    household_languages: string[];
  };
  baseline_skill_bands: Record<string, string>;
  family_context: {
    parent_literacy_level: string | null;
    home_practice_capacity: string | null;
    home_practice_partners: string[];
    family_priorities: string | null;
  };
  activity_eligibility_filter: {
    version: string;
    applied_rule: string;
  };
};

function getResponseValue(responses: Map<string, Json>, itemId: string): Json | undefined {
  return responses.get(itemId);
}

function parseBandMapping(mapping: Record<string, string>, score: number): string {
  for (const [range, band] of Object.entries(mapping)) {
    const [min, max] = range.split('-').map(Number);
    if (score >= min && score <= max) return band;
  }
  // Fallback — if score exceeds all ranges, return the last band
  const entries = Object.entries(mapping);
  return entries[entries.length - 1][1];
}

export function computeOutputs(
  instrumentPayloadRaw: Json,
  responses: Map<string, Json>,
  childDob: string,
): Outputs {
  const payload = instrumentPayloadRaw as unknown as InstrumentPayload;

  // 1. Child profile
  const dxResponse = getResponseValue(responses, 'DX-002');
  const diagnosticProfile = Array.isArray(dxResponse)
    ? (dxResponse as string[]).filter((v) =>
        ['autism', 'speech_delay', 'adhd', 'specific_learning_disability', 'global_developmental_delay'].includes(v),
      )
    : [];

  const chronologicalAgeMonths = differenceInMonths(new Date(), new Date(childDob));

  const primaryLang = getResponseValue(responses, 'DEM-008');
  const householdLangs = getResponseValue(responses, 'DEM-007');

  // 2. Baseline skill bands
  const baselineSkillBands: Record<string, string> = {};
  const scoredSections = payload.sections.filter(
    (s) => s.domain && s.scoring_method === 'sum_items_then_map_to_skill_band' && s.skill_band_mapping,
  );

  for (const section of scoredSections) {
    let sum = 0;
    for (const item of section.items) {
      const val = getResponseValue(responses, item.id);
      if (val !== undefined && val !== null && typeof val === 'number') {
        sum += val;
      }
    }
    const band = parseBandMapping(section.skill_band_mapping!, sum);
    baselineSkillBands[section.domain!] = band;
  }

  // 3. Family context
  const literacyLevel = getResponseValue(responses, 'FAM-001');
  const homePracticeCapacity = getResponseValue(responses, 'FAM-003');
  const homePracticePartners = getResponseValue(responses, 'FAM-002');
  const familyPriorities = getResponseValue(responses, 'FAM-005');

  // 4. Activity eligibility filter
  const activityEligibilityFilter = {
    version: payload.version ?? '1.0.0-draft',
    applied_rule:
      'Activity is eligible if: diagnostic_profile_applicability includes one of child profiles, target_age_range includes chronological age, skill_level matches one band above current.',
  };

  return {
    child_profile: {
      diagnostic_profile: diagnosticProfile,
      chronological_age_months: chronologicalAgeMonths,
      primary_language: typeof primaryLang === 'string' ? primaryLang : null,
      household_languages: Array.isArray(householdLangs) ? (householdLangs as string[]) : [],
    },
    baseline_skill_bands: baselineSkillBands,
    family_context: {
      parent_literacy_level: typeof literacyLevel === 'string' ? literacyLevel : null,
      home_practice_capacity: typeof homePracticeCapacity === 'string' ? homePracticeCapacity : null,
      home_practice_partners: Array.isArray(homePracticePartners) ? (homePracticePartners as string[]) : [],
      family_priorities: typeof familyPriorities === 'string' ? familyPriorities : null,
    },
    activity_eligibility_filter: activityEligibilityFilter,
  };
}
