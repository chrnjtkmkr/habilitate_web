-- 0018_fix_sibling_rls.sql
-- Replace overly-restrictive write policies on session_activities,
-- trials, engagement_samples. Mirrors the corrected sessions policy
-- model from 0017.

-- ============================================================
-- session_activities
-- ============================================================
drop policy if exists session_activities_manage_therapist on session_activities;
drop policy if exists session_activities_select on session_activities;

create policy session_activities_select_center on session_activities
  for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_activities.session_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy session_activities_insert_therapist_or_supervisor on session_activities
  for insert to authenticated
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_activities.session_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner','supervising_therapist']::user_role[])
        )
    )
  );

create policy session_activities_update_therapist_or_supervisor on session_activities
  for update to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_activities.session_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner','supervising_therapist']::user_role[])
        )
    )
  )
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_activities.session_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy session_activities_delete_owner on session_activities
  for delete to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_activities.session_id
        and auth_user_has_role_in(s.center_id, array['center_owner']::user_role[])
    )
  );

-- ============================================================
-- trials
-- ============================================================
drop policy if exists trials_manage_therapist on trials;
drop policy if exists trials_select on trials;

create policy trials_select_center on trials
  for select to authenticated
  using (
    exists (
      select 1 from session_activities sa
      join sessions s on s.id = sa.session_id
      where sa.id = trials.session_activity_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy trials_insert_therapist_or_supervisor on trials
  for insert to authenticated
  with check (
    exists (
      select 1 from session_activities sa
      join sessions s on s.id = sa.session_id
      where sa.id = trials.session_activity_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner','supervising_therapist']::user_role[])
        )
    )
  );

create policy trials_update_therapist_or_supervisor on trials
  for update to authenticated
  using (
    exists (
      select 1 from session_activities sa
      join sessions s on s.id = sa.session_id
      where sa.id = trials.session_activity_id
        and auth_user_in_center(s.center_id)
        and (
          s.therapist_id = auth.uid()
          or auth_user_has_role_in(s.center_id, array['center_owner','supervising_therapist']::user_role[])
        )
    )
  )
  with check (
    exists (
      select 1 from session_activities sa
      join sessions s on s.id = sa.session_id
      where sa.id = trials.session_activity_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy trials_delete_owner on trials
  for delete to authenticated
  using (
    exists (
      select 1 from session_activities sa
      join sessions s on s.id = sa.session_id
      where sa.id = trials.session_activity_id
        and auth_user_has_role_in(s.center_id, array['center_owner']::user_role[])
    )
  );

-- ============================================================
-- engagement_samples
-- ============================================================
drop policy if exists engagement_samples_insert_therapist on engagement_samples;
drop policy if exists engagement_samples_select on engagement_samples;

create policy engagement_samples_select_center on engagement_samples
  for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = engagement_samples.session_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy engagement_samples_insert_session_therapist on engagement_samples
  for insert to authenticated
  with check (
    exists (
      select 1 from sessions s
      where s.id = engagement_samples.session_id
        and s.therapist_id = auth.uid()
    )
  );

-- No UPDATE policy on engagement_samples — they are immutable after capture.

create policy engagement_samples_delete_owner on engagement_samples
  for delete to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = engagement_samples.session_id
        and auth_user_has_role_in(s.center_id, array['center_owner']::user_role[])
    )
  );
