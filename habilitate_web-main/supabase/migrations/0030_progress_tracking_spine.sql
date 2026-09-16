-- Progress-tracking data spine: attributes, probes, baselines, milestones, personal bests
-- Tables for multi-attribute pediatric progress measurement

----------------------------------------------------------------------
-- ATTRIBUTES (config table — read-only for authenticated users)
----------------------------------------------------------------------
create table if not exists attributes (
  id text primary key,
  parent_label text not null,
  capture_method text not null check (capture_method in ('system', 'therapist')),
  scale_type text not null,
  config jsonb not null default '{}',
  sort_order int,
  active boolean not null default true
);

----------------------------------------------------------------------
-- PROBES (one trial of one attribute in one session)
----------------------------------------------------------------------
create table if not exists probes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  attribute_id text not null references attributes(id),
  captured_at timestamptz not null default now(),
  method text not null,
  raw jsonb not null,
  score numeric,
  valid boolean not null default true,
  void_reason text,
  therapist_confirmed boolean not null default false,
  therapist_override jsonb,
  created_at timestamptz not null default now()
);

create index idx_probes_session on probes(session_id);
create index idx_probes_child_attribute on probes(child_id, attribute_id);
create index idx_probes_captured_at on probes(captured_at);

----------------------------------------------------------------------
-- CHILD ATTRIBUTE BASELINES (frozen week-1 anchor, NEVER updated)
----------------------------------------------------------------------
create table if not exists child_attribute_baselines (
  child_id uuid not null references children(id) on delete cascade,
  attribute_id text not null references attributes(id),
  baseline_value numeric,
  baseline_window text,
  frozen_at timestamptz not null default now(),
  primary key (child_id, attribute_id)
);

----------------------------------------------------------------------
-- MILESTONES (once ever, dated, immutable)
----------------------------------------------------------------------
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  attribute_id text not null references attributes(id),
  milestone_key text not null,
  achieved_at timestamptz not null,
  probe_id uuid references probes(id),
  unique (child_id, attribute_id, milestone_key)
);

----------------------------------------------------------------------
-- PERSONAL BESTS (one row per child+attribute+metric, updated when beaten)
----------------------------------------------------------------------
create table if not exists personal_bests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  attribute_id text not null references attributes(id),
  metric text not null,
  value numeric not null,
  achieved_at timestamptz not null,
  probe_id uuid references probes(id),
  unique (child_id, attribute_id, metric)
);

----------------------------------------------------------------------
-- VIEW: running totals per child+attribute (derived, only climbs)
----------------------------------------------------------------------
create or replace view v_child_attribute_totals
  with (security_invoker = on)
as
select
  child_id,
  attribute_id,
  count(*) as probe_count,
  sum(score) as score_sum
from probes
where valid = true
group by child_id, attribute_id;

----------------------------------------------------------------------
-- RLS: enable on all new tables
----------------------------------------------------------------------
alter table attributes enable row level security;
alter table probes enable row level security;
alter table child_attribute_baselines enable row level security;
alter table milestones enable row level security;
alter table personal_bests enable row level security;

----------------------------------------------------------------------
-- RLS: attributes — read-only config table for all authenticated
----------------------------------------------------------------------
drop policy if exists "attributes_read_authenticated" on attributes;
create policy "attributes_read_authenticated"
  on attributes for select
  to authenticated
  using (true);

----------------------------------------------------------------------
-- RLS: probes — child ownership via children table
----------------------------------------------------------------------
drop policy if exists "probes_select_via_child" on probes;
create policy "probes_select_via_child"
  on probes for select
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = probes.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

drop policy if exists "probes_insert_via_session" on probes;
create policy "probes_insert_via_session"
  on probes for insert
  to authenticated
  with check (
    exists (
      select 1 from sessions s
      where s.id = probes.session_id
        and s.therapist_id = auth.uid()
    )
  );

drop policy if exists "probes_update_via_session" on probes;
create policy "probes_update_via_session"
  on probes for update
  to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = probes.session_id
        and s.therapist_id = auth.uid()
    )
  );

----------------------------------------------------------------------
-- RLS: child_attribute_baselines — child ownership
----------------------------------------------------------------------
drop policy if exists "baselines_select_via_child" on child_attribute_baselines;
create policy "baselines_select_via_child"
  on child_attribute_baselines for select
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = child_attribute_baselines.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

drop policy if exists "baselines_insert_via_child" on child_attribute_baselines;
create policy "baselines_insert_via_child"
  on child_attribute_baselines for insert
  to authenticated
  with check (
    exists (
      select 1 from children c
      where c.id = child_attribute_baselines.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

----------------------------------------------------------------------
-- RLS: milestones — child ownership
----------------------------------------------------------------------
drop policy if exists "milestones_select_via_child" on milestones;
create policy "milestones_select_via_child"
  on milestones for select
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = milestones.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

drop policy if exists "milestones_insert_via_child" on milestones;
create policy "milestones_insert_via_child"
  on milestones for insert
  to authenticated
  with check (
    exists (
      select 1 from children c
      where c.id = milestones.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

----------------------------------------------------------------------
-- RLS: personal_bests — child ownership
----------------------------------------------------------------------
drop policy if exists "personal_bests_select_via_child" on personal_bests;
create policy "personal_bests_select_via_child"
  on personal_bests for select
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = personal_bests.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

drop policy if exists "personal_bests_insert_via_child" on personal_bests;
create policy "personal_bests_insert_via_child"
  on personal_bests for insert
  to authenticated
  with check (
    exists (
      select 1 from children c
      where c.id = personal_bests.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

drop policy if exists "personal_bests_update_via_child" on personal_bests;
create policy "personal_bests_update_via_child"
  on personal_bests for update
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = personal_bests.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

----------------------------------------------------------------------
-- STEP 3: SEED ATTRIBUTES
-- Build-time defaults, pending Anant sign-off
----------------------------------------------------------------------
insert into attributes (id, parent_label, capture_method, scale_type, config, sort_order)
values
  ('response_to_name', 'Response to Name', 'system', 'latency',
   '{"window_ms":3000,"valid_angle_deg":30,"best_margin_ms":300,"void_rules":["off_frame","distress"]}'::jsonb,
   1),
  ('looks_at_you', 'Looks at You', 'system', 'duration',
   '{"min_duration_ms":1000,"best_margin_ms":500,"void_rules":["off_frame"]}'::jsonb,
   2),
  ('stays_activity', 'Stays with Activity', 'system', 'duration',
   '{"best_margin_ms":30000,"void_rules":["distress_break"]}'::jsonb,
   3),
  ('follows_instruction', 'Follows Instruction', 'therapist', 'prompt_level',
   '{"prompt_levels":["independent","verbal_cue","no_response"]}'::jsonb,
   4),
  ('copies_you', 'Copies You', 'therapist', 'prompt_level',
   '{"prompt_levels":["copied","partial","no"]}'::jsonb,
   5),
  ('asks_for_wants', 'Asks for Wants', 'therapist', 'modality',
   '{"modalities":["word","sound","gesture","reach"]}'::jsonb,
   6)
on conflict (id) do nothing;
