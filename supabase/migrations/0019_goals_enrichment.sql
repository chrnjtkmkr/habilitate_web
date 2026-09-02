-- Add name, description, target_domain, target_skill_level to goals.
-- Make activity_id nullable (it's a source reference, not always set).
-- Add goal_id to session_activities for goal-activity linking.

-- goals: add new columns
alter table goals add column if not exists name text;
alter table goals add column if not exists description text;
alter table goals add column if not exists target_domain activity_domain;
alter table goals add column if not exists target_skill_level skill_level;

-- Backfill existing rows from linked activity
update goals g set
  name = coalesce(g.name, a.name),
  target_domain = coalesce(g.target_domain, a.developmental_domain),
  target_skill_level = coalesce(g.target_skill_level, a.skill_level)
from activities a
where g.activity_id = a.id
  and (g.name is null or g.target_domain is null or g.target_skill_level is null);

-- Now make name and target_domain not null (with defaults for safety)
alter table goals alter column name set not null;
alter table goals alter column target_domain set not null;
alter table goals alter column target_skill_level set not null;

-- Make activity_id nullable (source activity is optional)
alter table goals alter column activity_id drop not null;

-- session_activities: add goal_id
alter table session_activities add column if not exists goal_id uuid references goals(id) on delete set null;
create index if not exists idx_session_activities_goal on session_activities(goal_id);
