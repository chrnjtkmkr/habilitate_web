-- ============================================================
-- device_telemetry.motion: acceleration magnitude, in g.
--
--   motion = sqrt(ax^2 + ay^2 + az^2)
--
-- Same formula as wearable_metrics.acceleration_magnitude. It includes
-- gravity, so a band at rest reads about 1.0 (production data at rest:
-- 1.005-1.008 g). The raw ax/ay/az columns stay as they are.
--
-- A stored generated column, so Postgres computes it for every row,
-- including the rows already in the table, and no insert path (Edge
-- Function, scripts, backfills) can write a different value.
--
-- APPLYING: adding a stored generated column rewrites the table under
-- an ACCESS EXCLUSIVE lock. At ~323k rows / ~100 MB with indexes that
-- is a few seconds, during which telemetry inserts wait. PostgREST
-- requests (the Edge Function's inserts) give up after an 8 s lock
-- timeout, so apply while no band is streaming.
--
-- wearable_metrics is kept: it also carries rotation_magnitude and
-- movement_index, which this column does not replace.
-- ============================================================

-- Give up rather than queue behind a long-running query; everything
-- else would queue behind this statement while it waited.
set local lock_timeout = '5s';

alter table public.device_telemetry
  add column if not exists motion double precision
  generated always as (sqrt(ax * ax + ay * ay + az * az)) stored;

comment on column public.device_telemetry.motion is
  'Acceleration magnitude in g, sqrt(ax^2 + ay^2 + az^2). Includes gravity (~1.0 at rest). Generated; do not insert.';

notify pgrst, 'reload schema';
