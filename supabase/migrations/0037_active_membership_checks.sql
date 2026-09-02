-- 0037_active_membership_checks.sql
-- Fix: three foundational helpers from 0002 did not filter on
-- memberships.is_active, so deactivated users retained all privileges.
-- Also adds set search_path = public to all four functions (audit 5A).

-- 1. auth_user_centers: add is_active filter + search_path
create or replace function auth_user_centers()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select center_id from memberships
  where user_id = auth.uid()
    and is_active = true;
$$;

-- 2. auth_user_has_role_in (single-role overload): add is_active filter + search_path
create or replace function auth_user_has_role_in(p_center_id uuid, p_role user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and center_id = p_center_id
      and role = p_role
      and is_active = true
  );
$$;

-- 3. auth_user_in_center: add is_active filter + search_path
create or replace function auth_user_in_center(p_center_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and center_id = p_center_id
      and is_active = true
  );
$$;

-- 4. auth_user_owns_child: no memberships access, only add search_path
--    Logic unchanged: checks children.primary_therapist_id,
--    children.supervising_therapist_id, and user_on_child_care_team
--    (which already filters on care_team.is_active).
create or replace function auth_user_owns_child(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from children
    where id = p_child_id
      and deleted_at is null
      and (primary_therapist_id = auth.uid() or supervising_therapist_id = auth.uid())
  )
  or user_on_child_care_team(p_child_id);
$$;
