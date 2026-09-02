-- 0042_milestone_baseline_corrections.sql
-- Add UPDATE policies to milestones and child_attribute_baselines so that
-- mistaken clinical markers can be corrected. No DELETE — these are clinical
-- records; corrections are edits, not deletions.
--
-- UPDATE is allowed when auth_user_owns_child (care team + primary/supervising
-- therapist) OR the caller is a center_owner of the child's center. Neither
-- table has center_id directly, so we derive it via children.center_id.

-- milestones UPDATE
drop policy if exists "milestones_update_via_child" on milestones;
create policy "milestones_update_via_child"
  on milestones for update
  to authenticated
  using (
    auth_user_owns_child(child_id)
    or exists (
      select 1 from children c
      where c.id = milestones.child_id
        and c.deleted_at is null
        and auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
    )
  )
  with check (
    auth_user_owns_child(child_id)
    or exists (
      select 1 from children c
      where c.id = milestones.child_id
        and c.deleted_at is null
        and auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
    )
  );

-- child_attribute_baselines UPDATE
drop policy if exists "baselines_update_via_child" on child_attribute_baselines;
create policy "baselines_update_via_child"
  on child_attribute_baselines for update
  to authenticated
  using (
    auth_user_owns_child(child_id)
    or exists (
      select 1 from children c
      where c.id = child_attribute_baselines.child_id
        and c.deleted_at is null
        and auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
    )
  )
  with check (
    auth_user_owns_child(child_id)
    or exists (
      select 1 from children c
      where c.id = child_attribute_baselines.child_id
        and c.deleted_at is null
        and auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
    )
  );
