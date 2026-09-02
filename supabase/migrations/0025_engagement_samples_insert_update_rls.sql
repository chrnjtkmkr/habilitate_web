-- Fix engagement_samples INSERT policy: allow therapist, supervising_therapist,
-- and center_owner (matching the trials pattern). Add missing UPDATE policy.

-- 1. Replace the overly restrictive INSERT policy
drop policy if exists "engagement_samples_insert_session_therapist" on engagement_samples;

create policy "engagement_samples_insert_for_center_members"
on engagement_samples
for insert
to authenticated
with check (
  exists (
    select 1
    from sessions s
    where s.id = engagement_samples.session_id
      and auth_user_in_center(s.center_id)
      and (
        s.therapist_id = auth.uid()
        or auth_user_has_role_in(s.center_id, array['center_owner'::user_role, 'supervising_therapist'::user_role])
      )
  )
);

-- 2. Add UPDATE policy (none existed) for upsert support
drop policy if exists "engagement_samples_update_for_center_members" on engagement_samples;

create policy "engagement_samples_update_for_center_members"
on engagement_samples
for update
to authenticated
using (
  exists (
    select 1
    from sessions s
    where s.id = engagement_samples.session_id
      and auth_user_in_center(s.center_id)
      and (
        s.therapist_id = auth.uid()
        or auth_user_has_role_in(s.center_id, array['center_owner'::user_role, 'supervising_therapist'::user_role])
      )
  )
)
with check (
  exists (
    select 1
    from sessions s
    where s.id = engagement_samples.session_id
      and auth_user_in_center(s.center_id)
  )
);
