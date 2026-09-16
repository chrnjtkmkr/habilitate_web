-- 0032_child_scoped_notes.sql
-- Allow session_notes to be child-scoped (no session) and restore
-- sessions.therapist_notes that 0031 dropped while frontend still uses it.

----------------------------------------------------------------------
-- 1. Make session_notes.session_id nullable
----------------------------------------------------------------------
alter table session_notes alter column session_id drop not null;

----------------------------------------------------------------------
-- 2. Restore sessions.therapist_notes (dropped by 0031, still used by
--    SessionSummary.tsx and useFinalizeSession). No backfill needed;
--    null is correct for existing rows.
----------------------------------------------------------------------
alter table sessions add column if not exists therapist_notes text;

----------------------------------------------------------------------
-- 3. Add scope column to distinguish child-level vs session-level notes
----------------------------------------------------------------------
alter table session_notes add column if not exists scope text not null default 'child';

-- Label existing rows (backfilled from sessions by 0031) as session-scoped
update session_notes set scope = 'session' where session_id is not null;

-- Enforce allowed values
alter table session_notes add constraint session_notes_scope_check
  check (scope in ('child', 'session'));

----------------------------------------------------------------------
-- 4. RLS: no policy changes needed.
--    All existing policies on session_notes key on child_id, which is
--    still NOT NULL. A child-scoped note (session_id IS NULL) is
--    protected by the same care-team / primary / supervising check.
--    INSERT requires author_id = auth.uid(); UPDATE requires the same.
--    These remain correct for both scopes.
----------------------------------------------------------------------
