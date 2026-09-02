-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  center_id uuid not null references centers(id) on delete cascade,
  therapist_id uuid not null references profiles(id),
  status session_status not null default 'scheduled',
  scheduled_date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  therapist_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sessions_updated_at
  before update on sessions
  for each row execute function set_updated_at();

create index idx_sessions_child on sessions(child_id);
create index idx_sessions_center on sessions(center_id);
create index idx_sessions_therapist_date on sessions(therapist_id, scheduled_date);

-- Session plans: audit record of what the rule engine recommended
create table session_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  recommended_activity_ids text[] not null default '{}',
  reasoning jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_session_plans_session on session_plans(session_id);

-- Session activities: what actually ran, with plan_origin tracking
create table session_activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  activity_id text not null references activities(id),
  plan_origin plan_origin not null default 'therapist_added',
  ordering int not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  therapist_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger session_activities_updated_at
  before update on session_activities
  for each row execute function set_updated_at();

create index idx_session_activities_session on session_activities(session_id);

-- Trials
create table trials (
  id uuid primary key default gen_random_uuid(),
  session_activity_id uuid not null references session_activities(id) on delete cascade,
  trial_number int not null,
  response trial_response not null,
  prompt_level text,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_activity_id, trial_number)
);

create index idx_trials_session_activity on trials(session_activity_id);
