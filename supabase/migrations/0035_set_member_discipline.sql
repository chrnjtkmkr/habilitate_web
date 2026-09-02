-- 0035_set_member_discipline.sql
-- Security-definer RPC so a center_owner can set a therapist's discipline
-- without opening a broad UPDATE policy on profiles.

create or replace function public.set_member_discipline(
  p_user_id uuid,
  p_discipline_id text
)
returns void as $$
begin
  -- 1. Validate discipline exists and is active (NULL means "unset", which is fine)
  if p_discipline_id is not null then
    if not exists (
      select 1 from disciplines where id = p_discipline_id and is_active = true
    ) then
      raise exception 'discipline not found';
    end if;
  end if;

  -- 2. Caller must be center_owner of at least one center where p_user_id
  --    holds an active membership.
  if not exists (
    select 1 from memberships m
    where m.user_id = p_user_id
      and m.is_active = true
      and auth_user_has_role_in(m.center_id, 'center_owner'::user_role)
  ) then
    raise exception 'not authorized';
  end if;

  -- 3. Set the single column.
  update profiles
  set discipline_id = p_discipline_id,
      updated_at    = now()
  where id = p_user_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.set_member_discipline(uuid, text) to authenticated;
revoke execute on function public.set_member_discipline(uuid, text) from anon, public;
