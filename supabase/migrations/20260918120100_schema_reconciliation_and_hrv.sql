-- ============================================================
-- Migration 20260918120100: Schema Reconciliation & HRV Pipeline Guard
--
-- Fully idempotent: safe to run against a DB where every
-- object may already exist.
--
-- Fixes:
-- 1. Ensures device_telemetry.hrv column exists regardless of
--    whether migration 20260918120000 or 20260916211747 ran first.
-- 2. Relaxes NOT NULL on hr and spo2 in device_telemetry so
--    that -1 "no finger" values can be stored as NULL.
-- 3. Re-creates the compute_hrv_sdnn() trigger idempotently
--    to guarantee the HRV calculation pipeline is intact.
-- 4. Adds expire_stale_online_devices() function for Issue 1
--    staleness guard.
-- ============================================================

-- ============================================================
-- 1. device_telemetry schema fixes
-- ============================================================

-- Ensure hrv column exists (idempotent)
alter table public.device_telemetry
  add column if not exists hrv double precision;

-- Relax NOT NULL on columns where the sensor can legitimately
-- report "no reading" (-1 from firmware → NULL in DB).
-- These ALTER COLUMN statements are idempotent — dropping
-- NOT NULL on a column that is already nullable is a no-op.
alter table public.device_telemetry
  alter column hr drop not null;

alter table public.device_telemetry
  alter column spo2 drop not null;

-- ============================================================
-- 2. HRV computation trigger — idempotent re-creation
-- ============================================================

create or replace function public.compute_hrv_sdnn()
returns trigger language plpgsql as $$
declare
  rr_values   double precision[];
  rr_mean     double precision;
  rr_variance double precision;
  i           int;
  n           int;
begin
  -- Only compute when heart_rate is a valid positive number
  if new.heart_rate is null or new.heart_rate <= 0 then
    return new;
  end if;

  -- Collect the last 60 heart_rate readings for this device.
  -- We query existing rows (the current row hasn't been
  -- inserted yet because this is a BEFORE trigger).
  select array_agg(60000.0 / hr order by captured_at desc)
  into rr_values
  from (
    select heart_rate as hr, captured_at
    from public.wearable_samples
    where device_id = new.device_id
      and heart_rate is not null
      and heart_rate > 0
    order by captured_at desc
    limit 59  -- 59 existing + 1 current = 60
  ) sub;

  -- Include the current row's RR interval
  if rr_values is null then
    rr_values := array[60000.0 / new.heart_rate];
  else
    rr_values := array_prepend(60000.0 / new.heart_rate, rr_values);
  end if;

  n := array_length(rr_values, 1);

  if n < 2 then
    -- Need at least 2 samples to compute a standard deviation
    return new;
  end if;

  -- Compute mean
  rr_mean := 0;
  for i in 1..n loop
    rr_mean := rr_mean + rr_values[i];
  end loop;
  rr_mean := rr_mean / n;

  -- Compute variance (Bessel's correction)
  rr_variance := 0;
  for i in 1..n loop
    rr_variance := rr_variance + (rr_values[i] - rr_mean) ^ 2;
  end loop;
  rr_variance := rr_variance / (n - 1);

  -- SDNN = sqrt(variance)
  new.computed_hrv_sdnn := sqrt(rr_variance);

  return new;
end;
$$;

-- Drop and re-create trigger (idempotent)
drop trigger if exists wearable_samples_compute_hrv
  on public.wearable_samples;

create trigger wearable_samples_compute_hrv
  before insert on public.wearable_samples
  for each row execute function public.compute_hrv_sdnn();

-- ============================================================
-- 3. Stale device online-status guard (Issue 1)
-- ============================================================

create or replace function public.expire_stale_online_devices()
returns void language plpgsql as $$
begin
  update public.sensor_devices
  set is_online = false,
      online_since = null,
      last_online_at = now()
  where is_online = true
    and last_online_at < now() - interval '2 minutes';
end;
$$;
