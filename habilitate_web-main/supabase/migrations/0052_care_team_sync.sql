-- 0052_care_team_sync.sql
-- Keep child_care_team in sync with children.primary_therapist_id and
-- children.supervising_therapist_id. Previously these were independent:
-- creating or editing a child did NOT create a care-team row.

----------------------------------------------------------------------
-- 1. TRIGGER FUNCTION
----------------------------------------------------------------------
create or replace function public.sync_care_team_from_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disc text;
begin
  -- Handle primary_therapist_id
  if (TG_OP = 'INSERT' and NEW.primary_therapist_id is not null)
     or (TG_OP = 'UPDATE' and NEW.primary_therapist_id is distinct from OLD.primary_therapist_id
         and NEW.primary_therapist_id is not null)
  then
    select discipline_id into v_disc from profiles where id = NEW.primary_therapist_id;
    insert into child_care_team (child_id, therapist_id, discipline_id, role, is_active)
    values (NEW.id, NEW.primary_therapist_id, v_disc, 'lead', true)
    on conflict (child_id, therapist_id, discipline_id)
    do update set is_active = true;
  end if;

  -- Handle supervising_therapist_id (only if different from primary)
  if (TG_OP = 'INSERT' and NEW.supervising_therapist_id is not null
      and NEW.supervising_therapist_id is distinct from NEW.primary_therapist_id)
     or (TG_OP = 'UPDATE' and NEW.supervising_therapist_id is distinct from OLD.supervising_therapist_id
         and NEW.supervising_therapist_id is not null
         and NEW.supervising_therapist_id is distinct from NEW.primary_therapist_id)
  then
    select discipline_id into v_disc from profiles where id = NEW.supervising_therapist_id;
    insert into child_care_team (child_id, therapist_id, discipline_id, role, is_active)
    values (NEW.id, NEW.supervising_therapist_id, v_disc, 'lead', true)
    on conflict (child_id, therapist_id, discipline_id)
    do update set is_active = true;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_care_team_from_child on children;
create trigger trg_sync_care_team_from_child
  after insert or update on children
  for each row execute function public.sync_care_team_from_child();

----------------------------------------------------------------------
-- 2. ONE-TIME BACKFILL for children missing care-team rows
----------------------------------------------------------------------
do $$
declare
  v_count bigint := 0;
  v_disc text;
  rec record;
begin
  for rec in
    select c.id as child_id, c.primary_therapist_id, c.supervising_therapist_id
    from children c
    where c.deleted_at is null
      and (
        (c.primary_therapist_id is not null and not exists (
          select 1 from child_care_team ct
          where ct.child_id = c.id and ct.therapist_id = c.primary_therapist_id and ct.is_active = true
        ))
        or
        (c.supervising_therapist_id is not null and c.supervising_therapist_id is distinct from c.primary_therapist_id
         and not exists (
          select 1 from child_care_team ct
          where ct.child_id = c.id and ct.therapist_id = c.supervising_therapist_id and ct.is_active = true
        ))
      )
  loop
    if rec.primary_therapist_id is not null then
      select discipline_id into v_disc from profiles where id = rec.primary_therapist_id;
      insert into child_care_team (child_id, therapist_id, discipline_id, role, is_active)
      values (rec.child_id, rec.primary_therapist_id, v_disc, 'lead', true)
      on conflict (child_id, therapist_id, discipline_id) do update set is_active = true;
      v_count := v_count + 1;
    end if;

    if rec.supervising_therapist_id is not null
       and rec.supervising_therapist_id is distinct from rec.primary_therapist_id then
      select discipline_id into v_disc from profiles where id = rec.supervising_therapist_id;
      insert into child_care_team (child_id, therapist_id, discipline_id, role, is_active)
      values (rec.child_id, rec.supervising_therapist_id, v_disc, 'lead', true)
      on conflict (child_id, therapist_id, discipline_id) do update set is_active = true;
      v_count := v_count + 1;
    end if;
  end loop;

  raise notice '% care-team rows backfilled from children with missing entries', v_count;
end;
$$;
