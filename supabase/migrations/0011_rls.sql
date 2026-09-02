-- Enable RLS on all tenant-scoped tables
alter table centers enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table children enable row level security;
alter table parents enable row level security;
alter table intake_assessments enable row level security;
alter table intake_responses enable row level security;
alter table goals enable row level security;
alter table sessions enable row level security;
alter table session_plans enable row level security;
alter table session_activities enable row level security;
alter table trials enable row level security;
alter table engagement_samples enable row level security;
alter table parent_reports enable row level security;
alter table audit_log enable row level security;
alter table activities enable row level security;
alter table intake_instruments enable row level security;

-- Helper: does the current user own (is primary or supervising therapist of) this child?
create or replace function auth_user_owns_child(p_child_id uuid)
returns boolean as $$
  select exists (
    select 1 from children
    where id = p_child_id
      and deleted_at is null
      and (primary_therapist_id = auth.uid() or supervising_therapist_id = auth.uid())
  );
$$ language sql stable security definer;

----------------------------------------------------------------------
-- GLOBAL CONTENT: activities and intake_instruments
-- Readable by all authenticated users, writable only via service role
----------------------------------------------------------------------
create policy "activities_read_authenticated"
  on activities for select
  to authenticated
  using (true);

create policy "intake_instruments_read_authenticated"
  on intake_instruments for select
  to authenticated
  using (true);

----------------------------------------------------------------------
-- CENTERS
----------------------------------------------------------------------
create policy "centers_select_member"
  on centers for select
  to authenticated
  using (auth_user_in_center(id));

create policy "centers_update_owner"
  on centers for update
  to authenticated
  using (auth_user_has_role_in(id, 'center_owner'));

----------------------------------------------------------------------
-- PROFILES
----------------------------------------------------------------------
create policy "profiles_select_own"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_select_same_center"
  on profiles for select
  to authenticated
  using (
    exists (
      select 1 from memberships m
      where m.user_id = profiles.id
        and m.center_id in (select auth_user_centers())
    )
  );

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (id = auth.uid());

----------------------------------------------------------------------
-- MEMBERSHIPS
----------------------------------------------------------------------
create policy "memberships_select_same_center"
  on memberships for select
  to authenticated
  using (auth_user_in_center(center_id));

create policy "memberships_manage_owner"
  on memberships for all
  to authenticated
  using (auth_user_has_role_in(center_id, 'center_owner'));

----------------------------------------------------------------------
-- CHILDREN
----------------------------------------------------------------------
create policy "children_select_owner"
  on children for select
  to authenticated
  using (auth_user_has_role_in(center_id, 'center_owner'));

create policy "children_select_supervisor"
  on children for select
  to authenticated
  using (auth_user_has_role_in(center_id, 'supervising_therapist'));

create policy "children_select_therapist"
  on children for select
  to authenticated
  using (primary_therapist_id = auth.uid());

create policy "children_insert_owner_supervisor"
  on children for insert
  to authenticated
  with check (
    auth_user_has_role_in(center_id, 'center_owner')
    or auth_user_has_role_in(center_id, 'supervising_therapist')
  );

create policy "children_update_owner"
  on children for update
  to authenticated
  using (auth_user_has_role_in(center_id, 'center_owner'));

create policy "children_update_supervisor"
  on children for update
  to authenticated
  using (
    auth_user_has_role_in(center_id, 'supervising_therapist')
    and auth_user_owns_child(id)
  );

create policy "children_update_therapist"
  on children for update
  to authenticated
  using (primary_therapist_id = auth.uid());

----------------------------------------------------------------------
-- PARENTS
----------------------------------------------------------------------
create policy "parents_select_via_child"
  on parents for select
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = parents.child_id
        and c.deleted_at is null
        and (
          auth_user_has_role_in(c.center_id, 'center_owner')
          or auth_user_has_role_in(c.center_id, 'supervising_therapist')
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

create policy "parents_manage_via_child"
  on parents for all
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = parents.child_id
        and (
          auth_user_has_role_in(c.center_id, 'center_owner')
          or auth_user_has_role_in(c.center_id, 'supervising_therapist')
        )
    )
  );

----------------------------------------------------------------------
-- INTAKE ASSESSMENTS & RESPONSES
----------------------------------------------------------------------
create policy "intake_assessments_select_via_child"
  on intake_assessments for select
  to authenticated
  using (
    exists (
      select 1 from children c
      where c.id = intake_assessments.child_id
        and (
          auth_user_has_role_in(c.center_id, 'center_owner')
          or auth_user_has_role_in(c.center_id, 'supervising_therapist')
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

create policy "intake_assessments_insert_therapist"
  on intake_assessments for insert
  to authenticated
  with check (administered_by = auth.uid());

create policy "intake_assessments_update_own"
  on intake_assessments for update
  to authenticated
  using (administered_by = auth.uid());

create policy "intake_responses_select_via_assessment"
  on intake_responses for select
  to authenticated
  using (
    exists (
      select 1 from intake_assessments ia
      join children c on c.id = ia.child_id
      where ia.id = intake_responses.assessment_id
        and (
          auth_user_has_role_in(c.center_id, 'center_owner')
          or auth_user_has_role_in(c.center_id, 'supervising_therapist')
          or c.primary_therapist_id = auth.uid()
        )
    )
  );

create policy "intake_responses_manage_own_assessment"
  on intake_responses for all
  to authenticated
  using (
    exists (
      select 1 from intake_assessments ia
      where ia.id = intake_responses.assessment_id
        and ia.administered_by = auth.uid()
    )
  );

----------------------------------------------------------------------
-- GOALS
----------------------------------------------------------------------
create policy "goals_select_center"
  on goals for select
  to authenticated
  using (auth_user_in_center(center_id));

create policy "goals_insert_center"
  on goals for insert
  to authenticated
  with check (auth_user_in_center(center_id));

create policy "goals_update_center"
  on goals for update
  to authenticated
  using (auth_user_in_center(center_id));

----------------------------------------------------------------------
-- SESSIONS, SESSION_PLANS, SESSION_ACTIVITIES, TRIALS
----------------------------------------------------------------------
create policy "sessions_select_center"
  on sessions for select
  to authenticated
  using (auth_user_in_center(center_id));

create policy "sessions_insert_therapist"
  on sessions for insert
  to authenticated
  with check (therapist_id = auth.uid());

create policy "sessions_update_therapist"
  on sessions for update
  to authenticated
  using (therapist_id = auth.uid());

create policy "session_plans_select"
  on session_plans for select
  to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_plans.session_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy "session_plans_insert"
  on session_plans for insert
  to authenticated
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_plans.session_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy "session_activities_select"
  on session_activities for select
  to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_activities.session_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy "session_activities_manage_therapist"
  on session_activities for all
  to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_activities.session_id
        and s.therapist_id = auth.uid()
    )
  );

create policy "trials_select"
  on trials for select
  to authenticated
  using (
    exists (
      select 1 from session_activities sa
      join sessions s on s.id = sa.session_id
      where sa.id = trials.session_activity_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy "trials_manage_therapist"
  on trials for all
  to authenticated
  using (
    exists (
      select 1 from session_activities sa
      join sessions s on s.id = sa.session_id
      where sa.id = trials.session_activity_id
        and s.therapist_id = auth.uid()
    )
  );

----------------------------------------------------------------------
-- ENGAGEMENT SAMPLES
----------------------------------------------------------------------
create policy "engagement_samples_select"
  on engagement_samples for select
  to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = engagement_samples.session_id
        and auth_user_in_center(s.center_id)
    )
  );

create policy "engagement_samples_insert_therapist"
  on engagement_samples for insert
  to authenticated
  with check (
    exists (
      select 1 from sessions s
      where s.id = engagement_samples.session_id
        and s.therapist_id = auth.uid()
    )
  );

----------------------------------------------------------------------
-- PARENT REPORTS
----------------------------------------------------------------------
create policy "parent_reports_select_center"
  on parent_reports for select
  to authenticated
  using (auth_user_in_center(center_id));

create policy "parent_reports_insert"
  on parent_reports for insert
  to authenticated
  with check (auth_user_in_center(center_id));

create policy "parent_reports_update_approval"
  on parent_reports for update
  to authenticated
  using (
    auth_user_has_role_in(center_id, 'center_owner')
    or auth_user_has_role_in(center_id, 'supervising_therapist')
  );

----------------------------------------------------------------------
-- AUDIT LOG: read-only for owners and supervisors
----------------------------------------------------------------------
create policy "audit_log_select_owner"
  on audit_log for select
  to authenticated
  using (auth_user_has_role_in(center_id, 'center_owner'));

create policy "audit_log_select_supervisor"
  on audit_log for select
  to authenticated
  using (auth_user_has_role_in(center_id, 'supervising_therapist'));

create policy "audit_log_insert_authenticated"
  on audit_log for insert
  to authenticated
  with check (auth_user_in_center(center_id));
