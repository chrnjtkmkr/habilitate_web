import { supabase } from '../supabase';
import { getTipsForDomains } from './parentTipsLibrary';
import { differenceInMonths } from 'date-fns';

export interface GoalWorked {
  goalName: string;
  domain: string;
  observationText: string;
}

export interface ReportContent {
  language: 'en' | 'hi';
  centerName: string;
  therapistName: string;
  supervisorName: string;
  childFirstName: string;
  childAgeYearsMonths: string;
  periodLabel: string;
  sessionsAttended: number;
  sessionsScheduled: number;
  goalsWorked: GoalWorked[];
  parentTips: Array<{ tipText: string; linkedGoalName?: string }>;
  nextSessionDate?: string;
  closingNote: string;
}

const encouragementLinesEn = [
  'Practicing at home can help.',
  'Small wins each day add up.',
  "{{childName}}'s effort is what counts most.",
];

const encouragementLinesHi = [
  '\u0918\u0930 \u092a\u0930 \u0905\u092d\u094d\u092f\u093e\u0938 \u0915\u0930\u0928\u0947 \u0938\u0947 \u092e\u0926\u0926 \u092e\u093f\u0932\u0924\u0940 \u0939\u0948\u0964',
  '\u0939\u0930 \u0926\u093f\u0928 \u0915\u0940 \u091b\u094b\u091f\u0940 \u091c\u0940\u0924 \u092c\u0921\u093c\u093e \u092b\u0930\u094d\u0915 \u0932\u093e\u0924\u0940 \u0939\u0948\u0964',
  '{{childName}} \u0915\u0940 \u092e\u0947\u0939\u0928\u0924 \u0938\u092c\u0938\u0947 \u091c\u094d\u092f\u093e\u0926\u093e \u092e\u093e\u092f\u0928\u0947 \u0930\u0916\u0924\u0940 \u0939\u0948\u0964',
];

function getPerformanceLine(
  ratio: number,
  childName: string,
  language: 'en' | 'hi',
): string {
  if (ratio > 0.6) {
    return language === 'en'
      ? `${childName} responded well to many of the prompts and showed steady progress.`
      : `${childName} \u0928\u0947 \u0915\u0908 \u0917\u0924\u093f\u0935\u093f\u0927\u093f\u092f\u094b\u0902 \u092e\u0947\u0902 \u0905\u091a\u094d\u091b\u093e \u091c\u0935\u093e\u092c \u0926\u093f\u092f\u093e \u0914\u0930 \u0932\u0917\u093e\u0924\u093e\u0930 \u0924\u0930\u0915\u094d\u0915\u0940 \u0926\u093f\u0916\u093e\u0908\u0964`;
  }
  if (ratio >= 0.3) {
    return language === 'en'
      ? `${childName} is making steady progress with some support from the therapist.`
      : `${childName} \u0925\u0947\u0930\u0947\u092a\u093f\u0938\u094d\u091f \u0915\u0940 \u092e\u0926\u0926 \u0938\u0947 \u0932\u0917\u093e\u0924\u093e\u0930 \u0924\u0930\u0915\u094d\u0915\u0940 \u0915\u0930 \u0930\u0939\u093e \u0939\u0948\u0964`;
  }
  return language === 'en'
    ? `This is a new skill for ${childName} and we are giving extra time to build comfort with it.`
    : `\u092f\u0939 ${childName} \u0915\u0947 \u0932\u093f\u090f \u0928\u092f\u093e \u0915\u094c\u0936\u0932 \u0939\u0948 \u0914\u0930 \u0939\u092e \u0907\u0938\u092e\u0947\u0902 \u0938\u0939\u091c \u0939\u094b\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0905\u0924\u093f\u0930\u093f\u0915\u094d\u0924 \u0938\u092e\u092f \u0926\u0947 \u0930\u0939\u0947 \u0939\u0948\u0902\u0964`;
}

function getEncouragementLine(
  index: number,
  childName: string,
  language: 'en' | 'hi',
): string {
  const lines = language === 'en' ? encouragementLinesEn : encouragementLinesHi;
  return lines[index % lines.length].replace(/\{\{childName\}\}/g, childName);
}

export async function generateReportContent(
  childId: string,
  periodStart: string,
  periodEnd: string,
  language: 'en' | 'hi',
): Promise<ReportContent> {
  // Fetch child with therapist + supervisor names
  const { data: child, error: childErr } = await supabase
    .from('children')
    .select(
      '*, primary_therapist:profiles!children_primary_therapist_id_fkey(full_name), supervising_therapist_profile:profiles!children_supervising_therapist_id_fkey(full_name)',
    )
    .eq('id', childId)
    .single();
  if (childErr || !child) throw new Error('Could not load child');

  // Fetch center
  const { data: center } = await supabase
    .from('centers')
    .select('name, city, state, contact_phone')
    .eq('id', child.center_id)
    .single();

  // Fetch all sessions in the period
  const { data: allSessions } = await supabase
    .from('sessions')
    .select('id, status, scheduled_date')
    .eq('child_id', childId)
    .gte('scheduled_date', periodStart)
    .lte('scheduled_date', periodEnd);

  const sessions = allSessions ?? [];
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  // Fetch session_activities for completed sessions, joined with goals
  const completedIds = completedSessions.map((s) => s.id);
  let sessionActivities: Array<{
    id: string;
    goal_id: string | null;
    session_id: string;
    activity_id: string;
  }> = [];

  if (completedIds.length > 0) {
    const { data: sa } = await supabase
      .from('session_activities')
      .select('id, goal_id, session_id, activity_id')
      .in('session_id', completedIds);
    sessionActivities = sa ?? [];
  }

  // Fetch all goals for this child that were worked on
  const goalIds = [
    ...new Set(
      sessionActivities.map((sa) => sa.goal_id).filter((g): g is string => !!g),
    ),
  ];

  let goals: Array<{
    id: string;
    name: string;
    target_domain: string;
  }> = [];
  if (goalIds.length > 0) {
    const { data: g } = await supabase
      .from('goals')
      .select('id, name, target_domain')
      .in('id', goalIds);
    goals = g ?? [];
  }

  // Fetch trials for these session_activities
  const saIds = sessionActivities.map((sa) => sa.id);
  let trials: Array<{
    session_activity_id: string;
    response: string;
  }> = [];
  if (saIds.length > 0) {
    const { data: t } = await supabase
      .from('trials')
      .select('session_activity_id, response')
      .in('session_activity_id', saIds);
    trials = t ?? [];
  }

  // Build per-goal stats
  const childFirstName = child.full_name.split(' ')[0];
  const goalsWorked: GoalWorked[] = goals.map((goal, idx) => {
    const goalSaIds = sessionActivities
      .filter((sa) => sa.goal_id === goal.id)
      .map((sa) => sa.id);

    const goalTrials = trials.filter((t) =>
      goalSaIds.includes(t.session_activity_id),
    );

    const totalTrials = goalTrials.length;
    const positive = goalTrials.filter(
      (t) => t.response === 'responded' || t.response === 'partial',
    ).length;
    const ratio = totalTrials > 0 ? positive / totalTrials : 0;

    // Count unique sessions where this goal was worked on
    const sessionsWithGoal = new Set(
      sessionActivities
        .filter((sa) => sa.goal_id === goal.id)
        .map((sa) => sa.session_id),
    ).size;

    const performanceLine = getPerformanceLine(ratio, childFirstName, language);
    const encouragementLine = getEncouragementLine(idx, childFirstName, language);

    const intro =
      language === 'en'
        ? `${childFirstName} worked on ${goal.name} during ${sessionsWithGoal} session(s) this week.`
        : `${childFirstName} \u0928\u0947 \u0907\u0938 \u0939\u092b\u094d\u0924\u0947 ${sessionsWithGoal} \u0938\u0947\u0936\u0928 \u092e\u0947\u0902 ${goal.name} \u092a\u0930 \u0915\u093e\u092e \u0915\u093f\u092f\u093e\u0964`;

    return {
      goalName: goal.name,
      domain: goal.target_domain,
      observationText: `${intro} ${performanceLine} ${encouragementLine}`,
    };
  });

  // Sort goals by number of session activities (most active first)
  const goalActivityCount = new Map<string, number>();
  for (const sa of sessionActivities) {
    if (sa.goal_id) {
      goalActivityCount.set(
        sa.goal_id,
        (goalActivityCount.get(sa.goal_id) ?? 0) + 1,
      );
    }
  }
  goalsWorked.sort(
    (a, b) =>
      (goalActivityCount.get(
        goals.find((g) => g.name === b.goalName)?.id ?? '',
      ) ?? 0) -
      (goalActivityCount.get(
        goals.find((g) => g.name === a.goalName)?.id ?? '',
      ) ?? 0),
  );

  // Parent tips for top 3 domains by activity count
  const topDomains = goalsWorked.slice(0, 3).map((g) => g.domain);
  const parentTips = getTipsForDomains(topDomains, childFirstName, language, 3);

  // Next session
  const { data: nextSession } = await supabase
    .from('sessions')
    .select('scheduled_date')
    .eq('child_id', childId)
    .gt('scheduled_date', periodEnd)
    .eq('status', 'scheduled')
    .order('scheduled_date')
    .limit(1);

  const ageMonths = differenceInMonths(new Date(), new Date(child.date_of_birth));
  const ageYears = Math.floor(ageMonths / 12);
  const ageRem = ageMonths % 12;
  const childAgeYearsMonths =
    language === 'en'
      ? `${ageYears}y ${ageRem}m`
      : `${ageYears} \u0938\u093e\u0932 ${ageRem} \u092e\u0939\u0940\u0928\u0947`;

  const periodLabel =
    language === 'en'
      ? `${periodStart} to ${periodEnd}`
      : `${periodStart} \u0938\u0947 ${periodEnd}`;

  const closingNote =
    language === 'en'
      ? `Thank you for your support. We look forward to continued progress with ${childFirstName}.`
      : `\u0906\u092a\u0915\u0947 \u0938\u0939\u092f\u094b\u0917 \u0915\u0947 \u0932\u093f\u090f \u0927\u0928\u094d\u092f\u0935\u093e\u0926\u0964 \u0939\u092e ${childFirstName} \u0915\u0940 \u0928\u093f\u0930\u0902\u0924\u0930 \u092a\u094d\u0930\u0917\u0924\u093f \u0915\u0940 \u0909\u092e\u094d\u092e\u0940\u0926 \u0915\u0930\u0924\u0947 \u0939\u0948\u0902\u0964`;

  return {
    language,
    centerName: center?.name ?? '',
    therapistName:
      (child.primary_therapist as { full_name: string } | null)?.full_name ?? '',
    supervisorName:
      (
        child.supervising_therapist_profile as { full_name: string } | null
      )?.full_name ?? '',
    childFirstName,
    childAgeYearsMonths,
    periodLabel,
    sessionsAttended: completedSessions.length,
    sessionsScheduled: sessions.length,
    goalsWorked,
    parentTips,
    nextSessionDate: nextSession?.[0]?.scheduled_date,
    closingNote,
  };
}
