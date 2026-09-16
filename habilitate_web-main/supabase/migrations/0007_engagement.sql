-- Engagement samples: high-volume, 5-second sampling interval
-- FUTURE: partition this table by range on recorded_at when volume warrants it.
-- Suggested partition scheme: monthly partitions on recorded_at.
create table engagement_samples (
  id uuid primary key default gen_random_uuid(),
  session_activity_id uuid not null references session_activities(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  head_pose jsonb,
  motion_score numeric(5,3) constraint chk_motion_score check (motion_score >= 0 and motion_score <= 1),
  audio_activity_flag boolean not null default false,
  composite_score numeric(5,3) constraint chk_composite_score check (composite_score >= 0 and composite_score <= 1),
  sampling_version text not null default '1.0',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_engagement_session_time on engagement_samples(session_id, recorded_at);
create index idx_engagement_session_activity on engagement_samples(session_activity_id);
