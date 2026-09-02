-- Children
create table children (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references centers(id) on delete cascade,
  full_name text not null,
  date_of_birth date not null,
  gender text,
  primary_language language_code not null default 'hi',
  primary_therapist_id uuid references profiles(id),
  supervising_therapist_id uuid references profiles(id),
  diagnostic_profile diagnostic_profile[] not null default '{}',
  intake_status intake_status not null default 'not_started',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger children_updated_at
  before update on children
  for each row execute function set_updated_at();

create index idx_children_center on children(center_id) where deleted_at is null;
create index idx_children_therapist on children(primary_therapist_id) where deleted_at is null;

-- Parents
create table parents (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  full_name text not null,
  phone text not null constraint chk_e164_phone check (phone ~ '^\+[1-9]\d{6,14}$'),
  relationship text,
  preferred_language language_code not null default 'hi',
  is_primary_contact boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger parents_updated_at
  before update on parents
  for each row execute function set_updated_at();

-- Only one primary contact per child
create unique index idx_parents_primary_contact
  on parents (child_id) where (is_primary_contact = true and deleted_at is null);

-- Intake assessments (header record per child)
create table intake_assessments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  instrument_id uuid not null references intake_instruments(id),
  administered_by uuid not null references profiles(id),
  status intake_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  computed_outputs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger intake_assessments_updated_at
  before update on intake_assessments
  for each row execute function set_updated_at();

create index idx_intake_assessments_child on intake_assessments(child_id);

-- Intake responses (normalized item rows)
create table intake_responses (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references intake_assessments(id) on delete cascade,
  item_id text not null,
  response_value jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, item_id)
);

create trigger intake_responses_updated_at
  before update on intake_responses
  for each row execute function set_updated_at();
