-- 0054_framework_sources.sql
-- Add framework_source values for physiotherapy, special education,
-- and general clinical practice. Clinically confirmed by Dr. Anant.
--
-- ICF_CY — WHO International Classification of Functioning, Disability
--   and Health: Children and Youth version. The functional classification
--   paediatric physiotherapy organises around.
--
-- IEP_FRAMEWORK — Individualised Education Plan under the Rights of
--   Persons with Disabilities Act 2016 and the National Education
--   Policy 2020. The Indian statutory framework for special education.
--
-- GENERAL_PRACTICE — for activities that reflect standard clinical
--   practice rather than any named framework. Honest labelling rather
--   than attaching a framework that is not genuinely the source.

alter type framework_source add value if not exists 'ICF_CY';
alter type framework_source add value if not exists 'IEP_FRAMEWORK';
alter type framework_source add value if not exists 'GENERAL_PRACTICE';
