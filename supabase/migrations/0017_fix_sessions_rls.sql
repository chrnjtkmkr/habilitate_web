-- 0017_fix_sessions_rls.sql
-- Replace overly-restrictive INSERT/UPDATE policies on sessions.
-- Any active member of a center can schedule a session for any active
-- therapist in that center, on any active child in that center.

-- Drop the broken policies
drop policy if exists sessions_insert_therapist on sessions;
drop policy if exists sessions_update_therapist on sessions;

-- Helper: is the user_id an active member of the given center?
create or replace function public.user_is_active_member_of(
  p_user_id uuid,
  p_center_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.user_id = p_user_id
      and m.center_id = p_center_id
      and m.is_active = true
  );
$$;

-- Helper: does the child belong to this center and is not deleted?
create or replace function public.child_belongs_to_center(
  p_child_id uuid,
  p_center_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from children c
    where c.id = p_child_id
      and c.center_id = p_center_id
      and c.deleted_at is null
  );
$$;

-- Array overload of auth_user_has_role_in (original takes single role)
create or replace function public.auth_user_has_role_in(
  p_center_id uuid,
  p_roles user_role[]
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and center_id = p_center_id
      and role = any(p_roles)
      and is_active = true
  );
$$;

-- INSERT: any active member of center; therapist must be active member
-- of same center; child must belong to center.
create policy sessions_insert_center_members on sessions
  for insert
  to authenticated
  with check (
    auth_user_in_center(center_id)
    and user_is_active_member_of(therapist_id, center_id)
    and child_belongs_to_center(child_id, center_id)
  );

-- UPDATE: therapist on session, OR center_owner / supervising_therapist
-- of that center.
create policy sessions_update_owner_supervisor_or_self on sessions
  for update
  to authenticated
  using (
    auth_user_in_center(center_id)
    and (
      therapist_id = auth.uid()
      or auth_user_has_role_in(center_id, array['center_owner','supervising_therapist']::user_role[])
    )
  )
  with check (
    auth_user_in_center(center_id)
    and user_is_active_member_of(therapist_id, center_id)
    and child_belongs_to_center(child_id, center_id)
  );

-- DELETE: center_owner only.
drop policy if exists sessions_delete_owner on sessions;
create policy sessions_delete_owner on sessions
  for delete
  to authenticated
  using (auth_user_has_role_in(center_id, array['center_owner']::user_role[]));
