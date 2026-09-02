-- Add audio diarization columns to engagement_samples.
-- These let us aggregate voice activity into session-level summaries
-- for the redesigned session summary analytics.

alter table engagement_samples
  add column if not exists child_voice_count integer default 0 not null,
  add column if not exists adult_voice_count integer default 0 not null,
  add column if not exists voice_state text default 'silence' not null
    check (voice_state in ('child_speaking', 'adult_speaking', 'silence', 'noise'));

create index if not exists idx_engagement_samples_voice_state
  on engagement_samples(voice_state);
