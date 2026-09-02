-- Auto-create a profiles row when a new auth user signs up.
-- The full_name comes from raw_user_meta_data (set by signUp options.data).
-- SECURITY DEFINER so it bypasses RLS for the insert.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, preferred_language, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'New User'),
    'en',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Drop if exists to make migration idempotent
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS: allow authenticated users to insert their own profile
-- (defensive — trigger handles most cases, but covers edge cases
-- like manual profile creation or profile repair)
-- ============================================================
drop policy if exists profiles_insert_self on profiles;
create policy profiles_insert_self on profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ============================================================
-- RPC: create_center_with_owner
-- Atomically creates a center + the first center_owner membership.
-- SECURITY DEFINER to bypass RLS. Validates caller is authenticated.
-- ============================================================
create or replace function public.create_center_with_owner(
  p_name text,
  p_city text default null,
  p_state text default null
)
returns uuid as $$
declare
  v_center_id uuid;
  v_slug text;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate slug: lowercase name, replace non-alnum with hyphens, trim, append random suffix
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

  insert into public.centers (name, slug, city, state, is_active)
  values (p_name, v_slug, p_city, p_state, true)
  returning id into v_center_id;

  insert into public.memberships (user_id, center_id, role, is_active)
  values (v_user_id, v_center_id, 'center_owner', true);

  return v_center_id;
end;
$$ language plpgsql security definer set search_path = public;
