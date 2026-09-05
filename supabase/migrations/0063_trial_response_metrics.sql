-- Store activity-level response metrics alongside the terminal trial response.
-- The existing trials RLS policies protect these columns with the response row.
alter table trials add column if not exists word_count integer;
alter table trials add column if not exists adult_voice_count integer;
alter table trials add column if not exists metrics jsonb;

alter table trials drop constraint if exists chk_trials_response_metrics_nonnegative;
alter table trials add constraint chk_trials_response_metrics_nonnegative
  check (
    (word_count is null or word_count >= 0)
    and (adult_voice_count is null or adult_voice_count >= 0)
  );
