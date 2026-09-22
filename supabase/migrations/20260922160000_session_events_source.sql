-- ============================================================
-- Child state in the session header: therapist override vs band.
--
-- The header now shows the band engine's state automatically (once
-- thresholds are clinically signed off), and a therapist can override
-- it. Both are recorded, and must stay distinguishable in the report:
--
--   source = 'therapist'  a therapist set the state (or cleared an
--                         override: event_type 'state_override_cleared')
--   source = 'band'       the engine's state changed (state_value NULL:
--                         the band has no state, e.g. too few signals)
--
-- Existing rows are therapist entries. Adding a column with a constant
-- default is catalog-only (no table rewrite). Re-runnable.
-- ============================================================

alter table public.session_events
  add column if not exists source text not null default 'therapist';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_events'::regclass and conname = 'session_events_source_check'
  ) then
    alter table public.session_events
      add constraint session_events_source_check check (source in ('therapist', 'band'));
  end if;
end $$;

alter table public.session_events drop constraint if exists session_events_event_type_check;
alter table public.session_events
  add constraint session_events_event_type_check
  check (event_type in ('spontaneous_initiation', 'state_change', 'state_override_cleared'));

comment on column public.session_events.source is
  'therapist: entered by a therapist. band: the child-state engine''s own state change.';

notify pgrst, 'reload schema';
