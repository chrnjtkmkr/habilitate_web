-- 0062_custom_activities_schema.sql
-- Step 2 of 2: ownership columns, check constraint, RLS policies,
-- and immutability trigger for custom activities.
--
-- Depends on 0061 which added 'custom' to validation_status.
--
-- All 90 existing catalogue rows are unaffected: both new columns
-- default to NULL, and the check constraint permits NULL/NULL for
-- non-custom statuses.

----------------------------------------------------------------------
-- 1. OWNERSHIP COLUMNS
----------------------------------------------------------------------
alter table activities
  add column if not exists created_by uuid references profiles(id);

alter table activities
  add column if not exists center_id uuid references centers(id) on delete cascade;

create index if not exists idx_activities_center on activities(center_id)
  where center_id is not null;

----------------------------------------------------------------------
-- 2. CHECK CONSTRAINT — ownership invariant
----------------------------------------------------------------------
-- custom => both created_by and center_id must be set
-- non-custom => both must be null (catalogue content has no owner)
alter table activities
  drop constraint if exists chk_custom_ownership;

alter table activities
  add constraint chk_custom_ownership check (
    case
      when validation_status = 'custom'
        then created_by is not null and center_id is not null
      else
        created_by is null and center_id is null
    end
  );

----------------------------------------------------------------------
-- 3. RLS ON activities
----------------------------------------------------------------------

-- 3a. SELECT — replace the old blanket policy.
-- Global catalogue (center_id is null) is visible to everyone.
-- Custom activities are visible only within their centre.
drop policy if exists "activities_read_authenticated" on activities;
create policy "activities_read_authenticated"
  on activities for select
  to authenticated
  using (center_id is null or auth_user_in_center(center_id));

-- 3b. INSERT — therapists can create custom activities in their centre.
-- They must not be able to create validated or draft catalogue content.
drop policy if exists "activities_insert_custom" on activities;
create policy "activities_insert_custom"
  on activities for insert
  to authenticated
  with check (
    validation_status = 'custom'
    and created_by = auth.uid()
    and center_id is not null
    and auth_user_in_center(center_id)
  );

-- 3c. UPDATE — only the creator can edit their own custom activity.
-- Column-level immutability (validation_status, center_id, created_by)
-- is enforced by the trigger below because RLS cannot express
-- "new.col = old.col" guards.
drop policy if exists "activities_update_creator" on activities;
create policy "activities_update_creator"
  on activities for update
  to authenticated
  using (
    validation_status = 'custom'
    and created_by = auth.uid()
  )
  with check (
    validation_status = 'custom'
    and created_by = auth.uid()
    and center_id is not null
    and auth_user_in_center(center_id)
  );

-- 3d. DELETE — intentionally omitted.
-- A custom activity may already be referenced by session_activities
-- in a completed session (FK: session_activities.activity_id references
-- activities.id). Deleting it would break session history. If we ever
-- need soft-delete, add an is_active flag instead.

----------------------------------------------------------------------
-- 4. TRIGGER — prevent mutation of ownership columns on update
----------------------------------------------------------------------
-- RLS with check can ensure the NEW row still says 'custom', but
-- cannot prevent a therapist from changing validation_status from
-- 'custom' to 'validated' (the WITH CHECK would reject 'validated',
-- but cannot distinguish "changed" from "unchanged"). The real gap
-- is center_id and created_by: a creator could move their activity
-- to a different centre. This trigger blocks all three.
create or replace function guard_custom_activity_immutable_cols()
returns trigger
language plpgsql
as $$
begin
  -- Only guard custom activities; catalogue rows are service-role only
  -- and never reach client-side UPDATE policies anyway.
  if old.validation_status = 'custom' then
    if new.validation_status is distinct from old.validation_status then
      raise exception 'Cannot change validation_status on a custom activity'
        using errcode = 'check_violation';
    end if;
    if new.center_id is distinct from old.center_id then
      raise exception 'Cannot change center_id on a custom activity'
        using errcode = 'check_violation';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Cannot change created_by on a custom activity'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_custom_activity_immutable on activities;
create trigger trg_guard_custom_activity_immutable
  before update on activities
  for each row
  execute function guard_custom_activity_immutable_cols();

----------------------------------------------------------------------
-- 5. RLS ON activity_signals — add write policies for custom activities
----------------------------------------------------------------------
-- The existing SELECT policy (activity_signals_read_authenticated)
-- remains: all authenticated users can read all signal mappings.

-- 5a. INSERT — only for activities the caller created.
drop policy if exists "activity_signals_insert_creator" on activity_signals;
create policy "activity_signals_insert_creator"
  on activity_signals for insert
  to authenticated
  with check (
    exists (
      select 1 from activities a
      where a.id = activity_signals.activity_id
        and a.validation_status = 'custom'
        and a.created_by = auth.uid()
    )
  );

-- 5b. DELETE — same condition, so a therapist can correct a wrong mapping.
drop policy if exists "activity_signals_delete_creator" on activity_signals;
create policy "activity_signals_delete_creator"
  on activity_signals for delete
  to authenticated
  using (
    exists (
      select 1 from activities a
      where a.id = activity_signals.activity_id
        and a.validation_status = 'custom'
        and a.created_by = auth.uid()
    )
  );
