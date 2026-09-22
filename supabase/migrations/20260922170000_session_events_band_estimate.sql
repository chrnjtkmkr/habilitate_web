-- ============================================================
-- Unvalidated band estimates, recorded for clinical validation.
--
-- Until the child-state thresholds are clinically signed off, the
-- session header shows the engine's provisional state as a marked,
-- unvalidated estimate (therapist-facing only). Its changes are saved
-- with source = 'band_estimate' so they can be compared against what
-- the clinician observed, and are never mixed with therapist entries
-- or with signed-off band states ('band'). Reports exclude them.
--
-- Constraint swap only; no data change. Re-runnable.
-- ============================================================

alter table public.session_events drop constraint if exists session_events_source_check;
alter table public.session_events
  add constraint session_events_source_check
  check (source in ('therapist', 'band', 'band_estimate'));

comment on column public.session_events.source is
  'therapist: entered by a therapist. band: the child-state engine''s signed-off state change. '
  'band_estimate: the engine''s unvalidated (pre-sign-off) estimate, kept for clinical validation; never shown in reports.';

notify pgrst, 'reload schema';
