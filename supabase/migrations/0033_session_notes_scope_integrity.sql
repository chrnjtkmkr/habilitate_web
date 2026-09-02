-- 0033_session_notes_scope_integrity.sql
-- Enforce: a child-scoped note never has a session_id;
--          a session-scoped note always has one.
-- This is additional to the scope check constraint from 0032.

alter table session_notes add constraint session_notes_scope_session_consistency
  check (
    (scope = 'child'   and session_id is null)
    or
    (scope = 'session' and session_id is not null)
  );
