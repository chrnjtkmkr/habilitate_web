-- 0043_deactivate_care_team_on_membership.sql
-- When a membership is deactivated (is_active true -> false), cascade that
-- deactivation to the therapist's child_care_team rows for children in
-- that center. Reactivation does NOT restore care-team rows.
--
-- This is an AFTER UPDATE trigger, so it only fires if the row change
-- succeeds past all BEFORE triggers (including trg_prevent_last_owner_removal
-- from 0038). If the last-owner guard raises, this trigger never executes.
--
-- Scoped to UPDATE only. Membership DELETE is a test-only path and is not
-- handled here; it would need separate consideration.

create or replace function public.cascade_deactivate_care_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act on a true deactivation: was active, now inactive
  if OLD.is_active = true and NEW.is_active = false then
    update child_care_team
       set is_active = false
     where therapist_id = NEW.user_id
       and is_active = true
       and child_id in (
         select id from children where center_id = NEW.center_id
       );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_cascade_deactivate_care_team on memberships;
create trigger trg_cascade_deactivate_care_team
  after update on memberships
  for each row execute function public.cascade_deactivate_care_team();
