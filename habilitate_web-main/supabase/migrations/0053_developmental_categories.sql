-- 0053_developmental_categories.sql
-- Add enum values for physiotherapy (gross motor) and special education
-- (learning disability) content. These names are clinically confirmed.
--
-- NOTE: speech_delay sits in diagnostic_profile (a condition enum) despite
-- being a skill area. This is a known inconsistency. Moving it would touch
-- 15 activities and every child record tagged with it. Left as-is.
--
-- Postgres 12+ supports ALTER TYPE ... ADD VALUE inside transactions.
-- Local Postgres is 17.6, so no special handling is needed.

-- Child conditions
alter type diagnostic_profile add value if not exists 'specific_learning_disability';
alter type diagnostic_profile add value if not exists 'global_developmental_delay';

-- Activity skill areas
alter type activity_domain add value if not exists 'gross_motor';
alter type activity_domain add value if not exists 'fine_motor';
