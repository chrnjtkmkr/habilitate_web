-- 0015_sessions_gap_closure.sql
-- Part 1: Add 'no_show' enum value and new columns to sessions.
-- The enum value cannot be used in the same transaction it's created,
-- so the view that references 'no_show' is in migration 0016.

-- ============================================================
-- ENUM: add no_show
-- ============================================================
alter type session_status add value if not exists 'no_show';

-- ============================================================
-- SESSIONS: new columns
-- ============================================================
alter table sessions add column if not exists scheduled_time time;
alter table sessions add column if not exists duration_minutes int;
alter table sessions add column if not exists attendance_marked_at timestamptz;
alter table sessions add column if not exists attendance_marked_by_user_id uuid;
alter table sessions add column if not exists no_show_reason text;
alter table sessions add column if not exists cancellation_reason text;

-- FK on attendance_marked_by_user_id (idempotent)
alter table sessions drop constraint if exists fk_sessions_attendance_marked_by;
alter table sessions add constraint fk_sessions_attendance_marked_by
  foreign key (attendance_marked_by_user_id) references profiles(id) on delete set null;

-- Duration sanity check
alter table sessions drop constraint if exists chk_sessions_duration_minutes;
alter table sessions add constraint chk_sessions_duration_minutes
  check (duration_minutes is null or duration_minutes between 5 and 240);

-- Default duration for new sessions; existing rows stay null until backfilled
alter table sessions alter column duration_minutes set default 45;
