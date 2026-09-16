import { pickLang } from '../i18nField';

// Format an age range in months as a readable years string.
// 18-36 → "1½–3 yrs", 36-72 → "3–6 yrs", 60-60 → "5 yrs"
export function formatAgeRange(minMonths: number, maxMonths: number): string {
  const toYears = (m: number): string => {
    const y = Math.floor(m / 12);
    const remainder = m % 12;
    if (remainder === 0) return String(y);
    if (remainder === 6) return `${y}\u00BD`; // ½
    // For other remainders, round to nearest half
    return remainder >= 9 ? String(y + 1) : remainder >= 3 ? `${y}\u00BD` : String(y);
  };
  const min = toYears(minMonths);
  const max = toYears(maxMonths);
  if (min === max) return `${min} yrs`;
  return `${min}\u2013${max} yrs`;
}

// Check if a child's age in months is within an activity's target range
// using the same ±6-month tolerance the recommender uses.
export function isAgeAppropriate(childAgeMonths: number, minMonths: number, maxMonths: number): boolean {
  return childAgeMonths >= minMonths - 6 && childAgeMonths <= maxMonths + 6;
}

// Activity type matching the supabase select('*, activity:activities(*)') shape
type Activity = {
  name: string;
  developmental_domain: string;
  mastery_criteria: string | null;
  prompting_hierarchy: unknown;
  therapist_steps: unknown;
  parent_explanation: unknown;
  materials_required: unknown;
};

// Pick the Hindi or English version of a DB text field based on the current
// i18n language. Returns Hindi when lang starts with 'hi' AND the _hi value
// is a non-empty string; otherwise returns the English value. A null or empty
// _hi field always falls back to English — never renders blank.
export function pickField(en: string | null | undefined, hi: string | null | undefined, lang: string): string | null {
  if (lang.startsWith('hi') && hi && hi.trim().length > 0) return hi;
  return en ?? null;
}

// Same logic for jsonb string arrays (therapist_steps, materials_required).
// Returns the Hindi array when it has entries; otherwise the English array.
// Never mixes languages within one array.
export function pickArrayField(en: unknown, hi: unknown, lang: string): string[] {
  if (lang.startsWith('hi')) {
    const hiArr = hi as string[] | null;
    if (hiArr && hiArr.length > 0) return hiArr;
  }
  const enArr = en as string[] | null;
  return enArr ?? [];
}

export function getDomainIcon(domain: string): string {
  switch (domain) {
    case 'joint_attention': return '👁️';
    case 'receptive_language': return '👂';
    case 'expressive_language': return '💬';
    case 'motor_imitation': return '🖐️';
    case 'play_skills': return '🧩';
    case 'social_reciprocity': return '🤝';
    case 'self_regulation': return '🧘';
    case 'attention_executive': return '🎯';
    default: return '♪';
  }
}

// Simplify mastery_criteria into "action — X of Y times" format.
// Split on commas outside parentheses to avoid breaking quoted examples.
export function getSimplifiedGoal(act: Activity): string {
  const source = act.mastery_criteria;
  if (!source) return getWhyThisMatters(act, 'en')?.split('.')[0] ?? 'Setup pending';

  const firstSentence = source.split('.')[0].trim();

  // Split on commas not inside parens/quotes
  const clauses: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of firstSentence) {
    if (ch === '(' || ch === '\u2018' || ch === '\u2019') depth++;
    if (ch === ')' || ch === '\u2019') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { clauses.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) clauses.push(cur.trim());

  const mainAction = clauses[0];
  const ratioMatch = firstSentence.match(/(\d+)\s+of\s+(\d+)/);
  if (ratioMatch && clauses.length > 1) {
    return `${mainAction} — ${ratioMatch[0]} times`;
  }

  return clauses.length <= 2 ? firstSentence : mainAction;
}

export function getMaterialsLine(act: Activity): string | null {
  const mats = act.materials_required as string[] | null;
  if (!mats || mats.length === 0) return null;
  return mats.join(' · ');
}

// Format enum-style strings for display: replace underscores with spaces, sentence case.
// "gestural_cue" → "Gestural cue", "hand_over_hand" → "Hand over hand"
export function formatEnumLabel(s: string): string {
  const spaced = s.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function getHelpLadder(act: Activity): string[] {
  const hierarchy = act.prompting_hierarchy as string[] | null;
  if (!hierarchy) return [];
  return hierarchy.map(formatEnumLabel);
}

export function getWhyThisMatters(act: Activity, lang: string): string | null {
  const text = pickLang(act.parent_explanation, lang);
  return text || null;
}
