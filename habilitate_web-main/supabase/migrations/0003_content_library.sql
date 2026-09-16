-- Activities: global content library, text PK from seed data (ACT-0001 etc)
create table activities (
  id text primary key,
  name text not null,
  framework_source framework_source not null,
  framework_citation text,
  developmental_domain activity_domain not null,
  diagnostic_profile_applicability diagnostic_profile[] not null default '{}',
  skill_level skill_level not null,
  target_age_min_months int not null,
  target_age_max_months int not null,
  duration_minutes int not null default 5,
  materials_required jsonb not null default '[]',
  prompting_hierarchy jsonb not null default '[]',
  mastery_criteria text not null,
  therapist_steps jsonb not null default '[]',
  parent_explanation jsonb not null default '{}',
  validation_status validation_status not null default 'draft_pending_clinical_validation',
  source_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_age_range check (target_age_min_months < target_age_max_months)
);

create trigger activities_updated_at
  before update on activities
  for each row execute function set_updated_at();

create index idx_activities_domain_skill on activities(developmental_domain, skill_level);
create index idx_activities_age on activities(target_age_min_months, target_age_max_months);
create index idx_activities_diagnostic on activities using gin (diagnostic_profile_applicability);

-- Intake instruments: single JSONB payload, only one active at a time
create table intake_instruments (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  payload jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger intake_instruments_updated_at
  before update on intake_instruments
  for each row execute function set_updated_at();

-- Only one row can have is_active = true
create unique index idx_intake_instruments_active
  on intake_instruments (is_active) where (is_active = true);
