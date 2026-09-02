-- Add is_active to memberships, profiles, and centers for soft-deactivation
alter table memberships add column is_active boolean not null default true;
alter table profiles add column is_active boolean not null default true;
alter table centers add column is_active boolean not null default true;

-- Add state to centers (Indian state/territory)
alter table centers add column state text;

-- Add primary_language alias to profiles (matches bootstrap expectation)
-- profiles already has preferred_language; add primary_language as a convenience alias? No —
-- the bootstrap SQL should use preferred_language. No schema change needed here.

-- Replace the plain index with a partial one filtering on is_active
drop index if exists idx_memberships_user;
create index idx_memberships_user on memberships(user_id) where (is_active = true);
