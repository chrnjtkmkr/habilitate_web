-- 0031_disciplines_and_care_team.sql
-- Disciplines, care-team model, per-author session notes

----------------------------------------------------------------------
-- 1. DISCIPLINES
----------------------------------------------------------------------
create table if not exists disciplines (
  id text primary key,
  display_name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into disciplines (id, display_name, sort_order, is_active) values
  ('speech_therapy', 'Speech Therapy', 1, true),
  ('occupational_therapy', 'Occupational Therapy', 2, true),
  ('behavioural_therapy', 'Behavioural Therapy', 3, true),
  ('physiotherapy', 'Physiotherapy', 4, true),
  ('special_education', 'Special Education', 5, true),
  ('unspecified', 'Unspecified', 99, false)
on conflict (id) do nothing;

----------------------------------------------------------------------
-- 2. ALTER PROFILES: add discipline_id
----------------------------------------------------------------------
alter table profiles add column if not exists discipline_id text references disciplines(id);

----------------------------------------------------------------------
-- 3. CHILD_CARE_TEAM
----------------------------------------------------------------------
create table if not exists child_care_team (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  therapist_id uuid not null references profiles(id),
  discipline_id text references disciplines(id),
  role text not null default 'lead',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (child_id, therapist_id, discipline_id)
);

create index if not exists idx_child_care_team_child on child_care_team(child_id);
create index if not exists idx_child_care_team_therapist on child_care_team(therapist_id);

----------------------------------------------------------------------
-- 4. ALTER SESSIONS: add discipline_id
----------------------------------------------------------------------
alter table sessions add column if not exists discipline_id text references disciplines(id);

----------------------------------------------------------------------
-- 5. BACKFILL
----------------------------------------------------------------------
do $$
declare
  v_care_team_rows bigint;
  v_unspecified_sessions bigint;
begin
  -- 5a: insert into child_care_team from children + sessions
  with therapist_child_pairs as (
    select id as child_id, primary_therapist_id as therapist_id
      from children where primary_therapist_id is not null
    union
    select id as child_id, supervising_therapist_id as therapist_id
      from children where supervising_therapist_id is not null
    union
    select child_id, therapist_id
      from sessions
  )
  insert into child_care_team (child_id, therapist_id, discipline_id, role, is_active)
  select tcp.child_id,
         tcp.therapist_id,
         p.discipline_id,
         'lead',
         true
    from therapist_child_pairs tcp
    join profiles p on p.id = tcp.therapist_id
  on conflict (child_id, therapist_id, discipline_id) do nothing;

  -- 5b: set sessions.discipline_id from the session therapist's profile
  update sessions s
     set discipline_id = p.discipline_id
    from profiles p
   where p.id = s.therapist_id
     and p.discipline_id is not null
     and s.discipline_id is null;

  -- 5c: set remaining sessions to 'unspecified'
  update sessions
     set discipline_id = 'unspecified'
   where discipline_id is null;

  get diagnostics v_unspecified_sessions = row_count;

  -- 5d: set remaining care-team rows to 'unspecified'
  update child_care_team
     set discipline_id = 'unspecified'
   where discipline_id is null;

  -- count total care-team rows
  select count(*) into v_care_team_rows from child_care_team;

  -- 5e: raise notices
  raise notice '% sessions set to discipline_id = unspecified', v_unspecified_sessions;
  raise notice '% care-team rows created', v_care_team_rows;
end;
$$;

----------------------------------------------------------------------
-- 6. SESSIONS: discipline_id NOT NULL now that every row has a value
----------------------------------------------------------------------
alter table sessions alter column discipline_id set not null;

----------------------------------------------------------------------
-- 7. RLS: care-team helper and policy extensions
----------------------------------------------------------------------

-- Security-definer helper: is the current user on the child's care team?
create or replace function public.user_on_child_care_team(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from child_care_team ct
    where ct.child_id = p_child_id
      and ct.therapist_id = auth.uid()
      and ct.is_active = true
  );
$$;

-- Update auth_user_owns_child to include care-team membership
create or replace function auth_user_owns_child(p_child_id uuid)
returns boolean as $$
  select exists (
    select 1 from children
    where id = p_child_id
      and deleted_at is null
      and (primary_therapist_id = auth.uid() or supervising_therapist_id = auth.uid())
  )
  or user_on_child_care_team(p_child_id);
$$ language sql stable security definer;

-- children: extend SELECT for therapist to include care-team
drop policy if exists "children_select_therapist" on children;
create policy "children_select_therapist"
  on children for select
  to authenticated
  using (primary_therapist_id = auth.uid() or user_on_child_care_team(id));

-- probes: extend SELECT to include care-team
drop policy if exists "probes_select_via_child" on probes;
create policy "probes_select_via_child"
  on probes for select
  to authenticated
  using (
    user_on_child_care_team(probes.child_id)
    or exists (
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

-- child_attribute_baselines: extend SELECT to include care-team
drop policy if exists "baselines_select_via_child" on child_attribute_baselines;
create policy "baselines_select_via_child"
  on child_attribute_baselines for select
  to authenticated
  using (
    user_on_child_care_team(child_attribute_baselines.child_id)
    or exists (
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

-- milestones: extend SELECT to include care-team
drop policy if exists "milestones_select_via_child" on milestones;
create policy "milestones_select_via_child"
  on milestones for select
  to authenticated
  using (
    user_on_child_care_team(milestones.child_id)
    or exists (
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

-- personal_bests: extend SELECT to include care-team
drop policy if exists "personal_bests_select_via_child" on personal_bests;
create policy "personal_bests_select_via_child"
  on personal_bests for select
  to authenticated
  using (
    user_on_child_care_team(personal_bests.child_id)
    or exists (
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

-- intake_assessments: extend SELECT to include care-team
drop policy if exists "intake_assessments_select_via_child" on intake_assessments;
create policy "intake_assessments_select_via_child"
  on intake_assessments for select
  to authenticated
  using (
    user_on_child_care_team(intake_assessments.child_id)
    or exists (
      select 1 from children c
      where c.id = intake_assessments.child_id
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

-- intake_responses: extend SELECT to include care-team (via assessment's child)
drop policy if exists "intake_responses_select_via_assessment" on intake_responses;
create policy "intake_responses_select_via_assessment"
  on intake_responses for select
  to authenticated
  using (
    exists (
      select 1 from intake_assessments ia
      where ia.id = intake_responses.assessment_id
        and user_on_child_care_team(ia.child_id)
    )
    or exists (
      select 1 from intake_assessments ia
      join children c on c.id = ia.child_id
      where ia.id = intake_responses.assessment_id
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

-- parents: extend SELECT to include care-team
drop policy if exists "parents_select_via_child" on parents;
create policy "parents_select_via_child"
  on parents for select
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = parents.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
          or user_on_child_care_team(c.id)
        )
    )
  );

-- RLS on child_care_team itself
alter table child_care_team enable row level security;

-- care-team members and center owners/supervisors can see team rows
drop policy if exists "child_care_team_select" on child_care_team;
create policy "child_care_team_select"
  on child_care_team for select
  to authenticated
  using (
    user_on_child_care_team(child_id)
    or exists (
      select 1 from children c
      where c.id = child_care_team.child_id
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
          or c.primary_therapist_id = auth.uid()
          or c.supervising_therapist_id = auth.uid()
        )
    )
  );

-- center owners/supervisors can manage care-team rows
drop policy if exists "child_care_team_manage" on child_care_team;
create policy "child_care_team_manage"
  on child_care_team for all
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = child_care_team.child_id
        and (
          auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
          or auth_user_has_role_in(c.center_id, 'supervising_therapist'::user_role)
        )
    )
  );

-- RLS on disciplines: read-only for all authenticated
alter table disciplines enable row level security;

drop policy if exists "disciplines_read_authenticated" on disciplines;
create policy "disciplines_read_authenticated"
  on disciplines for select
  to authenticated
  using (true);

----------------------------------------------------------------------
-- 8. PER-AUTHOR SESSION NOTES
----------------------------------------------------------------------
create table if not exists session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  author_id uuid not null references profiles(id),
  discipline_id text references disciplines(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_session_notes_session on session_notes(session_id);
create index if not exists idx_session_notes_child on session_notes(child_id);

-- Backfill from sessions.therapist_notes
do $$
declare
  v_notes_migrated bigint;
begin
  insert into session_notes (session_id, child_id, author_id, discipline_id, body, created_at, updated_at)
  select s.id,
         s.child_id,
         s.therapist_id,
         s.discipline_id,
         s.therapist_notes,
         s.updated_at,
         s.updated_at
    from sessions s
   where s.therapist_notes is not null
     and s.therapist_notes <> '';

  get diagnostics v_notes_migrated = row_count;
  raise notice '% session notes migrated from therapist_notes', v_notes_migrated;
end;
$$;

-- Drop the old column
alter table sessions drop column if exists therapist_notes;

-- RLS on session_notes
alter table session_notes enable row level security;

drop policy if exists "session_notes_select_care_team" on session_notes;
create policy "session_notes_select_care_team"
  on session_notes for select
  to authenticated
  using (
    user_on_child_care_team(child_id)
    or exists (
      select 1 from children c
      where c.id = session_notes.child_id
        and (c.primary_therapist_id = auth.uid() or c.supervising_therapist_id = auth.uid())
    )
  );

drop policy if exists "session_notes_insert_author" on session_notes;
create policy "session_notes_insert_author"
  on session_notes for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "session_notes_update_author" on session_notes;
create policy "session_notes_update_author"
  on session_notes for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
