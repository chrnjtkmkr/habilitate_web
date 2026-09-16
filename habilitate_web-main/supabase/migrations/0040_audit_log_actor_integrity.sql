-- 0040_audit_log_actor_integrity.sql
-- Fix: audit_log INSERT policy accepted any actor_id from any center member,
-- allowing a user to forge audit entries attributed to someone else.
-- Now enforces actor_id = auth.uid() so every audit row is self-attributed.

-- Drop the original INSERT policy (from 0011_rls.sql)
drop policy if exists "audit_log_insert_authenticated" on audit_log;

-- Recreate with actor identity check
create policy "audit_log_insert_authenticated"
  on audit_log for insert
  to authenticated
  with check (
    auth_user_in_center(center_id)
    and actor_id = auth.uid()
  );

-- No UPDATE or DELETE policy is created. With RLS enabled and no policy
-- granting UPDATE or DELETE, the table is effectively append-only for
-- the authenticated role. This is intentional: audit logs must be immutable.

-- The invite-therapist Edge Function inserts into audit_log using the
-- service_role client (adminClient), which bypasses RLS entirely.
-- This policy does NOT affect that path. The invite audit entry
-- (action = 'membership.invited') continues to work unchanged.
