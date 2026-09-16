-- 0049_activity_cards_hindi.sql
-- Add Hindi (_hi) parallel columns for the 12 card content fields.
-- Purely additive — no existing columns are altered or dropped.
--
-- Convention: a null _hi value means no Hindi translation exists yet.
-- The UI should fall back to the English field rather than showing
-- an empty section.
--
-- clinical_reference is intentionally NOT translated — it contains
-- framework names and technical terms used by supervisors and is
-- kept in English only.
--
-- mastery_frequency_num, mastery_frequency_denom, mastery_sessions
-- are integers — language-independent, no _hi version needed.

-- Layer 1
alter table activities add column if not exists goal_one_line_hi text;
alter table activities add column if not exists measuring_now_hi text;

-- Layer 2
alter table activities add column if not exists what_this_is_hi text;
alter table activities add column if not exists why_we_do_it_hi text;
alter table activities add column if not exists why_this_works_hi text;
alter table activities add column if not exists what_good_looks_like_hi text;
alter table activities add column if not exists what_we_measure_how_hi text;
alter table activities add column if not exists how_this_helps_hi text;
alter table activities add column if not exists what_we_dont_measure_hi text;

-- Structured mastery — behaviour text only (the numbers are language-independent)
alter table activities add column if not exists mastery_behaviour_hi text;

-- JSONB arrays — mirror the type and default of the English originals
alter table activities add column if not exists therapist_steps_hi jsonb not null default '[]'::jsonb;
alter table activities add column if not exists materials_required_hi jsonb not null default '[]'::jsonb;
