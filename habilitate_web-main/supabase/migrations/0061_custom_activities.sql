-- 0061_custom_activities.sql
-- Step 1 of 2: add the 'custom' value to the validation_status enum.
--
-- ALTER TYPE ADD VALUE can run inside a transaction in PG12+, but
-- the new value cannot be referenced by CHECK constraints or other
-- DDL in the SAME transaction. So this migration contains only the
-- enum change; 0062 adds columns, constraints, and policies.

alter type validation_status add value if not exists 'custom';
