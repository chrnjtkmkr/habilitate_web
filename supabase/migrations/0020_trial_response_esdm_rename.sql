-- Rename trial_response enum values to ESDM-style.
-- Old DTT/ABA values (correct, prompted, incorrect) remain in the enum
-- but are no longer used by the application. Postgres does not support
-- DROP VALUE on enums; they become dead code at the app layer.
-- no_response is preserved as-is.

alter type trial_response add value if not exists 'responded';
alter type trial_response add value if not exists 'partial';
alter type trial_response add value if not exists 'refused';
