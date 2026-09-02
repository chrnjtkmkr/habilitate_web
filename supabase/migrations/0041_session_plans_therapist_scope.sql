-- 0041_session_plans_therapist_scope.sql
-- Fix: session_plans INSERT was gated only on center membership, so any
-- center member could create a plan for any session. Tighten to the
-- session's own therapist. SELECT is unchanged. UPDATE was already
-- therapist-scoped in 0021. No DELETE policy exists and none is added.

-- Drop the overly-broad INSERT policy (from 0011_rls.sql)
drop policy if exists "session_plans_insert" on session_plans;

-- Recreate: only the session's therapist can insert a plan
create policy "session_plans_insert"
  on session_plans for insert
  to authenticated
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_plans.session_id
        and s.therapist_id = auth.uid()
    )
  );
