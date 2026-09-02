-- Goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  center_id uuid not null references centers(id) on delete cascade,
  activity_id text not null references activities(id),
  status goal_status not null default 'active',
  mastery_criteria text not null,
  created_by uuid not null references profiles(id),
  retired_at timestamptz,
  mastered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- status and timestamps must be consistent
  constraint chk_goal_status_timestamps check (
    (status = 'active' and retired_at is null and mastered_at is null)
    or (status = 'retired' and retired_at is not null and mastered_at is null)
    or (status = 'mastered' and mastered_at is not null)
  )
);

create trigger goals_updated_at
  before update on goals
  for each row execute function set_updated_at();

create index idx_goals_child on goals(child_id);
create index idx_goals_center on goals(center_id);
create index idx_goals_activity on goals(activity_id);
