-- 0038_prevent_orphaned_center.sql
-- Prevent a center from losing its last active center_owner via
-- deactivation, role change, or deletion.

create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only guard rows that are currently an active owner
  if OLD.role = 'center_owner' and OLD.is_active = true then

    -- On DELETE the owner status is always lost.
    -- On UPDATE only block if the change actually removes owner status.
    if TG_OP = 'DELETE'
       or (TG_OP = 'UPDATE' and (NEW.is_active = false or NEW.role <> 'center_owner'))
    then
      -- Check whether any OTHER active owner remains
      if not exists (
        select 1 from memberships
        where center_id = OLD.center_id
          and id <> OLD.id
          and role = 'center_owner'
          and is_active = true
      ) then
        raise exception
          'Cannot remove the last active owner of a center. Appoint another center_owner first.';
      end if;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_last_owner_removal on memberships;
create trigger trg_prevent_last_owner_removal
  before update or delete on memberships
  for each row execute function public.prevent_last_owner_removal();
