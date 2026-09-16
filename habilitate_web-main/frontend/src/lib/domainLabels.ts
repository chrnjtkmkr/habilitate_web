import type { Database } from '../types/supabase';

type ActivityDomain = Database['public']['Enums']['activity_domain'];
type SkillLevel = Database['public']['Enums']['skill_level'];
type DiagnosticProfile = Database['public']['Enums']['diagnostic_profile'];

export const domainI18nKeys: Record<ActivityDomain, string> = {
  joint_attention: 'domain_joint_attention',
  expressive_language: 'domain_expressive_language',
  receptive_language: 'domain_receptive_language',
  motor_imitation: 'domain_motor_imitation_activity',
  play_skills: 'domain_play_skills_activity',
  social_reciprocity: 'domain_social_reciprocity_activity',
  self_regulation: 'domain_self_regulation_activity',
  attention_executive: 'domain_attention_executive_activity',
  gross_motor: 'domain_gross_motor',
  fine_motor: 'domain_fine_motor',
};

export const skillLevelI18nKeys: Record<SkillLevel, string> = {
  emerging: 'skill_level_emerging',
  established: 'skill_level_established',
  mastery: 'skill_level_mastery',
};

export const ALL_DOMAINS: ActivityDomain[] = [
  'joint_attention', 'expressive_language', 'receptive_language',
  'motor_imitation', 'play_skills', 'social_reciprocity',
  'self_regulation', 'attention_executive',
  'gross_motor', 'fine_motor',
];

export const ALL_SKILL_LEVELS: SkillLevel[] = ['emerging', 'established', 'mastery'];

export const diagnosticI18nKeys: Record<DiagnosticProfile, string> = {
  autism: 'diagnostic_autism',
  speech_delay: 'diagnostic_speech_delay',
  adhd: 'diagnostic_adhd',
  specific_learning_disability: 'diagnostic_specific_learning_disability',
  global_developmental_delay: 'diagnostic_global_developmental_delay',
};

export const ALL_DIAGNOSTIC_PROFILES: DiagnosticProfile[] = [
  'autism', 'speech_delay', 'adhd',
  'specific_learning_disability', 'global_developmental_delay',
];
