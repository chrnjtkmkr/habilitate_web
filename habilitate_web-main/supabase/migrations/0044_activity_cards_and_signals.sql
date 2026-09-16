-- 0044_activity_cards_and_signals.sql
-- Activity card template fields + measurement bucket lookup + activity-to-signal mapping.
--
-- SAFETY: the activities table is EMPTY in production (zero rows). Every change
-- here is additive (new columns, new tables, new seed rows). Nothing existing is
-- altered or dropped, so this cannot break existing behaviour.

----------------------------------------------------------------------
-- 1. EXTEND ACTIVITIES WITH CARD FIELDS
----------------------------------------------------------------------
-- Layer 1 (parent-facing summary)
alter table activities add column if not exists goal_one_line text;
alter table activities add column if not exists measuring_now text;

-- Layer 2 (expanded card)
alter table activities add column if not exists what_this_is text;
alter table activities add column if not exists why_we_do_it text;
alter table activities add column if not exists why_this_works text;
alter table activities add column if not exists what_good_looks_like text;
alter table activities add column if not exists what_we_measure_how text;
alter table activities add column if not exists how_this_helps text;
alter table activities add column if not exists what_we_dont_measure text;

-- Supervisor-only
alter table activities add column if not exists clinical_reference text;

-- Structured mastery (replaces free-text mastery_criteria for new cards).
-- The existing mastery_criteria column is left untouched for backward compatibility.
alter table activities add column if not exists mastery_behaviour text;
alter table activities add column if not exists mastery_frequency_num int;
alter table activities add column if not exists mastery_frequency_denom int;
alter table activities add column if not exists mastery_sessions int;

----------------------------------------------------------------------
-- 2. MEASUREMENT BUCKET LOOKUP TABLE
----------------------------------------------------------------------
create table if not exists measurement_bucket (
  id text primary key,
  display_name text not null,
  is_auto_measured boolean not null,
  sort_order int not null default 0
);

insert into measurement_bucket (id, display_name, is_auto_measured, sort_order) values
  ('cam_face',          'Camera — looking / attention', true,  1),
  ('cam_hands',         'Camera — hand movement',       true,  2),
  ('voice',             'Microphone — sounds and speech',true, 3),
  ('therapist_scored',  'Therapist scores it',          false, 4)
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 3. FK FROM ACTIVITIES TO MEASUREMENT BUCKET
----------------------------------------------------------------------
alter table activities
  add column if not exists measurement_bucket_id text references measurement_bucket(id);

----------------------------------------------------------------------
-- 4. ACTIVITY-TO-SIGNAL MAPPING TABLE
----------------------------------------------------------------------
-- This mapping was previously absent. It lets the platform know which
-- signal/attribute each activity genuinely exposes, and enforces the
-- activity-to-signal honesty rule.
create table if not exists activity_signals (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null references activities(id) on delete cascade,
  attribute_id text not null references attributes(id),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique (activity_id, attribute_id)
);

create index if not exists idx_activity_signals_activity
  on activity_signals(activity_id);

----------------------------------------------------------------------
-- 5. RLS — mirror the pattern used by activities (0011) and attributes (0030):
--    enable RLS, read-only for authenticated, no client write policies.
----------------------------------------------------------------------

-- measurement_bucket
alter table measurement_bucket enable row level security;

drop policy if exists "measurement_bucket_read_authenticated" on measurement_bucket;
create policy "measurement_bucket_read_authenticated"
  on measurement_bucket for select
  to authenticated
  using (true);

-- activity_signals
alter table activity_signals enable row level security;

drop policy if exists "activity_signals_read_authenticated" on activity_signals;
create policy "activity_signals_read_authenticated"
  on activity_signals for select
  to authenticated
  using (true);
