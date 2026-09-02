-- Session events table: spontaneous initiations + child state changes.
-- No migration needed for trials.prompt_level — already exists as text.

create table if not exists session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  session_activity_id uuid references session_activities(id) on delete set null,
  event_type text not null check (event_type in ('spontaneous_initiation', 'state_change')),
  state_value text,
  note text,
  recorded_at timestamptz not null default now(),
  recorded_by_user_id uuid references profiles(id),
  created_at timestamptz default now()
);

alter table session_events enable row level security;

-- SELECT: any center member can read events for their sessions
drop policy if exists "session_events_select_center" on session_events;
create policy "session_events_select_center" on session_events
  for select to authenticated using (
    exists (
      select 1 from sessions s
      where s.id = session_events.session_id
        and auth_user_in_center(s.center_id)
    )
  );

-- INSERT: therapist assigned to session OR supervisor/owner in that center
drop policy if exists "session_events_insert_center_members" on session_events;
create policy "session_events_insert_center_members" on session_events
  for insert to authenticated with check (
    exists (
      select 1 from sessions s
      where s.id = session_events.session_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner'::user_role, 'supervising_therapist'::user_role])
        )
    )
  );

-- UPDATE: same as insert (for correcting state_value or notes)
drop policy if exists "session_events_update_center_members" on session_events;
create policy "session_events_update_center_members" on session_events
  for update to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_events.session_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner'::user_role, 'supervising_therapist'::user_role])
        )
    )
  )
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_events.session_id
        and auth_user_in_center(s.center_id)
    )
  );

-- DELETE: center_owner only
drop policy if exists "session_events_delete_owner" on session_events;
create policy "session_events_delete_owner" on session_events
  for delete to authenticated using (
    exists (
      select 1 from sessions s
      where s.id = session_events.session_id
        and auth_user_has_role_in(s.center_id, array['center_owner'::user_role])
    )
  );
