-- bootstrap_first_user.sql
-- One-time setup of the first center, owner profile, and membership.
-- Run AFTER creating the auth user in the Supabase dashboard.
--
-- HOW TO USE:
-- 1. In Supabase dashboard > Authentication > Users > Add user > Create new user.
--    Enter your email, set a password, click "Auto Confirm User" so no email
--    verification is needed.
-- 2. Copy the new user's UUID from the Users table.
-- 3. Replace every <UUID_FROM_AUTH_USERS> below with that UUID.
-- 4. Replace <YOUR_FULL_NAME>, <CENTER_NAME>, <CITY>, <STATE>, and the role.
-- 5. Run this file against your Supabase database via psql or the SQL editor.
--
-- The role for the first user should be 'center_owner' (full access).

begin;

-- 1. Create the center.
insert into centers (name, city, state, is_active)
values ('<CENTER_NAME>', '<CITY>', '<STATE>', true)
returning id as new_center_id;

-- 2. Create the profile (id MUST match the auth.users.id).
insert into profiles (id, full_name, preferred_language, is_active)
values ('<UUID_FROM_AUTH_USERS>', '<YOUR_FULL_NAME>', 'en', true);

-- 3. Create the membership linking user + center + role.
-- Replace <CENTER_ID_FROM_STEP_1> with the UUID returned by step 1.
insert into memberships (user_id, center_id, role, is_active)
values ('<UUID_FROM_AUTH_USERS>', '<CENTER_ID_FROM_STEP_1>', 'center_owner', true);

commit;

-- Verify:
select c.name as center, p.full_name as user_name, m.role
from memberships m
join centers c on c.id = m.center_id
join profiles p on p.id = m.user_id
where m.user_id = '<UUID_FROM_AUTH_USERS>';
