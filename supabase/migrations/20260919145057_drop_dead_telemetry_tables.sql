-- Applied directly to production on 2026-09-19 without being committed.
-- Backfilled from supabase_migrations.schema_migrations on 2026-09-22 so a
-- fresh database replays the same history as production.

-- wearable_samples: written to by wearable-ws as a best-effort fire-and-forget call,
-- but never read by any frontend code. Holds 1 stale row from early testing.
drop table if exists public.wearable_samples cascade;

-- hardware_samples / hardware_streams: exist live in the DB but have zero references
-- anywhere in the committed codebase (no migration created them, no code reads/writes them).
-- Schema drift per CLAUDE.md's "repo migrations = intent, live DB = state, must stay in sync" rule.
drop table if exists public.hardware_samples cascade;
drop table if exists public.hardware_streams cascade;
