-- Extensions
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "btree_gin" with schema "extensions";

-- Enums
create type user_role as enum ('center_owner', 'supervising_therapist', 'therapist');
create type language_code as enum ('en', 'hi');
create type diagnostic_profile as enum ('autism', 'speech_delay', 'adhd');
create type skill_level as enum ('emerging', 'established', 'mastery');

create type activity_domain as enum (
  'attention_executive',
  'expressive_language',
  'joint_attention',
  'motor_imitation',
  'play_skills',
  'receptive_language',
  'self_regulation',
  'social_reciprocity'
);

create type intake_baseline_domain as enum (
  'communication',
  'social_reciprocity',
  'motor_imitation',
  'play_skills',
  'self_regulation',
  'attention_executive'
);

create type framework_source as enum (
  'ESDM', 'HANEN', 'NDBI', 'PECS', 'DIR', 'BARKLEY_ADHD', 'VBMAPP'
);

create type validation_status as enum (
  'draft_pending_clinical_validation', 'validated'
);

create type goal_status as enum ('active', 'retired', 'mastered');
create type session_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type trial_response as enum ('correct', 'prompted', 'incorrect', 'no_response');
create type plan_origin as enum ('ai_recommended', 'therapist_added', 'therapist_substituted');
create type intake_status as enum ('not_started', 'in_progress', 'completed');
create type report_status as enum ('draft', 'awaiting_approval', 'approved', 'sent', 'failed');
create type report_channel as enum ('whatsapp', 'sms', 'email');

-- Shared trigger function to auto-update updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Map intake baseline domains to activity domains
-- communication -> {expressive_language, receptive_language}
-- social_reciprocity -> {social_reciprocity, joint_attention}
-- others map 1-to-1
create or replace function intake_to_activity_domains(d intake_baseline_domain)
returns activity_domain[] as $$
begin
  case d
    when 'communication' then
      return array['expressive_language', 'receptive_language']::activity_domain[];
    when 'social_reciprocity' then
      return array['social_reciprocity', 'joint_attention']::activity_domain[];
    when 'motor_imitation' then
      return array['motor_imitation']::activity_domain[];
    when 'play_skills' then
      return array['play_skills']::activity_domain[];
    when 'self_regulation' then
      return array['self_regulation']::activity_domain[];
    when 'attention_executive' then
      return array['attention_executive']::activity_domain[];
  end case;
end;
$$ language plpgsql immutable;
