-- Centers (tenants)
create table centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger centers_updated_at
  before update on centers
  for each row execute function set_updated_at();

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text,
  preferred_language language_code not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Memberships (user + center + role)
create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  center_id uuid not null references centers(id) on delete cascade,
  role user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, center_id)
);

create trigger memberships_updated_at
  before update on memberships
  for each row execute function set_updated_at();

create index idx_memberships_center on memberships(center_id);
create index idx_memberships_user on memberships(user_id);

-- Helper: returns all center ids the current auth user belongs to
create or replace function auth_user_centers()
returns setof uuid as $$
  select center_id from memberships where user_id = auth.uid();
$$ language sql stable security definer;

-- Helper: does the current user have the given role in the given center?
create or replace function auth_user_has_role_in(p_center_id uuid, p_role user_role)
returns boolean as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and center_id = p_center_id
      and role = p_role
  );
$$ language sql stable security definer;

-- Helper: is the current user a member of the given center (any role)?
create or replace function auth_user_in_center(p_center_id uuid)
returns boolean as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid()
      and center_id = p_center_id
  );
$$ language sql stable security definer;
