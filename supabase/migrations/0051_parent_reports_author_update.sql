-- 0051_parent_reports_author_update.sql
-- Fix: the UPDATE policy on parent_reports only allowed center_owner and
-- supervising_therapist. A therapist who generated a report could not edit
-- their own draft — the .update().select('id') returned 0 rows and the
-- frontend's zero-row guard threw "Save failed."
--
-- The fix adds generated_by = auth.uid() to the USING clause so the report
-- author can also update. This is correct: a therapist should be able to
-- edit a report they created, while still requiring supervisor/owner for
-- reports created by others.

drop policy if exists "parent_reports_update_approval" on parent_reports;
create policy "parent_reports_update_approval"
  on parent_reports for update
  to authenticated
  using (
    generated_by = auth.uid()
    or auth_user_has_role_in(center_id, 'center_owner'::user_role)
    or auth_user_has_role_in(center_id, 'supervising_therapist'::user_role)
  );
