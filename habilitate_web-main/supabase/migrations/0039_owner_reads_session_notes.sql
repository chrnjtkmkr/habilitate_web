-- 0039_owner_reads_session_notes.sql
-- Grant center_owner read access to session notes for children in their center.
-- Write policies are unchanged: authors can only insert/update their own notes.

drop policy if exists "session_notes_select_care_team" on session_notes;
create policy "session_notes_select_care_team"
  on session_notes for select
  to authenticated
  using (
    user_on_child_care_team(child_id)
    or exists (
      select 1 from children c
      where c.id = session_notes.child_id
        and (
          c.primary_therapist_id = auth.uid()
          or c.supervising_therapist_id = auth.uid()
          or auth_user_has_role_in(c.center_id, 'center_owner'::user_role)
        )
    )
  );
