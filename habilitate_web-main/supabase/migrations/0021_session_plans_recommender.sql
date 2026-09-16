-- Add columns needed by the plan recommender (Week 6)

alter table session_plans
  add column if not exists generator_version text not null default 'manual',
  add column if not exists plan jsonb,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references auth.users(id),
  add column if not exists was_edited boolean not null default false;

-- Update RLS: allow therapists to update their own session plans (for accept flow)
drop policy if exists "session_plans_update" on session_plans;
create policy "session_plans_update"
  on session_plans for update
  using (
    exists (
      select 1 from sessions s
      where s.id = session_plans.session_id
        and s.therapist_id = auth.uid()
    )
  );
