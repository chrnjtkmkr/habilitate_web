-- Trial-level prompt-level inferences computed from audio + gaze signals.
-- Batch-computed at session end, correctable by therapist.

create table if not exists trial_prompt_inferences (
  id uuid primary key default gen_random_uuid(),
  trial_id uuid not null references trials(id) on delete cascade,
  inferred_level text not null check (inferred_level in ('independent', 'verbal_prompt', 'gestural_prompt', 'physical_prompt', 'unclear')),
  confidence text not null check (confidence in ('high', 'medium', 'low', 'very_low')),
  signal_summary jsonb not null default '{}'::jsonb,
  therapist_correction text check (therapist_correction in ('independent', 'verbal_prompt', 'gestural_prompt', 'physical_prompt')),
  corrected_by uuid references profiles(id),
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trial_id)
);

create index if not exists idx_trial_prompt_inferences_trial on trial_prompt_inferences(trial_id);

-- updated_at trigger
create or replace function update_trial_prompt_inferences_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_trial_prompt_inferences_updated_at on trial_prompt_inferences;
create trigger trg_trial_prompt_inferences_updated_at
  before update on trial_prompt_inferences
  for each row execute function update_trial_prompt_inferences_updated_at();

-- RLS
alter table trial_prompt_inferences enable row level security;

-- SELECT: center members can read inferences for trials in their center's sessions
drop policy if exists tpi_select_center on trial_prompt_inferences;
create policy tpi_select_center on trial_prompt_inferences
  for select to authenticated
  using (
    exists (
      select 1 from trials t
      join session_activities sa on sa.id = t.session_activity_id
      join sessions s on s.id = sa.session_id
      where t.id = trial_prompt_inferences.trial_id
        and auth_user_in_center(s.center_id)
    )
  );

-- INSERT: therapist, supervising_therapist, center_owner
drop policy if exists tpi_insert_therapist on trial_prompt_inferences;
create policy tpi_insert_therapist on trial_prompt_inferences
  for insert to authenticated
  with check (
    exists (
      select 1 from trials t
      join session_activities sa on sa.id = t.session_activity_id
      join sessions s on s.id = sa.session_id
      where t.id = trial_prompt_inferences.trial_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner','supervising_therapist']::user_role[])
        )
    )
  );

-- UPDATE: therapist, supervising_therapist, center_owner
drop policy if exists tpi_update_therapist on trial_prompt_inferences;
create policy tpi_update_therapist on trial_prompt_inferences
  for update to authenticated
  using (
    exists (
      select 1 from trials t
      join session_activities sa on sa.id = t.session_activity_id
      join sessions s on s.id = sa.session_id
      where t.id = trial_prompt_inferences.trial_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner','supervising_therapist']::user_role[])
        )
    )
  )
  with check (
    exists (
      select 1 from trials t
      join session_activities sa on sa.id = t.session_activity_id
      join sessions s on s.id = sa.session_id
      where t.id = trial_prompt_inferences.trial_id
        and auth_user_in_center(s.center_id)
    )
  );

-- DELETE: center_owner only
drop policy if exists tpi_delete_owner on trial_prompt_inferences;
create policy tpi_delete_owner on trial_prompt_inferences
  for delete to authenticated
  using (
    exists (
      select 1 from trials t
      join session_activities sa on sa.id = t.session_activity_id
      join sessions s on s.id = sa.session_id
      where t.id = trial_prompt_inferences.trial_id
        and auth_user_has_role_in(s.center_id, array['center_owner']::user_role[])
    )
  );
