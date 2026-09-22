-- ============================================================
-- Reconcile the device tables with production.
--
-- sensor_devices and device_credentials were created in production by
-- hand before 20260918120000 ran, so that migration's
-- `create table if not exists` did nothing there, and the repo has
-- described the wrong shape ever since. A few indexes, constraints and
-- a trigger were also added to production directly.
--
-- This migration makes a fresh database match production, as captured
-- from the live catalog on 2026-09-22. On production it changes nothing
-- except dropping two functions that cannot work:
--   - expire_stale_online_devices(): updates is_online / online_since /
--     last_online_at, columns that have never existed in production.
--   - compute_hrv_sdnn(): its only trigger was on wearable_samples,
--     dropped in 20260919145057. It never wrote device_telemetry.hrv.
--
-- Every step checks before it acts, so this is safe to run repeatedly.
-- ============================================================

-- ------------------------------------------------------------
-- sensor_devices
-- ------------------------------------------------------------

-- ADD COLUMN IF NOT EXISTS skips the whole clause, including the foreign
-- key, when the column is already there.
alter table public.sensor_devices
  add column if not exists center_id        uuid references public.centers (id) on delete cascade,
  add column if not exists device_type      text not null default 'esp32',
  add column if not exists bluetooth_name   text,
  add column if not exists firmware_version text,
  add column if not exists hardware_version text,
  add column if not exists battery_level    numeric,
  add column if not exists metadata         jsonb not null default '{}'::jsonb;

-- Every band belongs to a center (tenancy). Fails loudly on a database
-- that has bands without one, rather than guessing a center.
alter table public.sensor_devices alter column center_id set not null;

alter table public.sensor_devices alter column device_name drop not null;

-- Online tracking columns from 20260918120000 were never created in
-- production and nothing reads them.
alter table public.sensor_devices
  drop column if exists is_online,
  drop column if exists online_since,
  drop column if exists last_online_at;

do $$
declare
  tbl constant regclass := 'public.sensor_devices'::regclass;
begin
  -- 20260918120000 creates the unique constraint as *_key; production
  -- names it *_unique.
  if exists (select 1 from pg_constraint where conrelid = tbl and conname = 'sensor_devices_device_uid_key')
     and not exists (select 1 from pg_constraint where conrelid = tbl and conname = 'sensor_devices_device_uid_unique') then
    alter table public.sensor_devices
      rename constraint sensor_devices_device_uid_key to sensor_devices_device_uid_unique;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = tbl and conname = 'sensor_devices_device_uid_unique') then
    alter table public.sensor_devices
      add constraint sensor_devices_device_uid_unique unique (device_uid);
  end if;

  -- Production also allows 'maintenance'.
  if not exists (
    select 1 from pg_constraint
    where conrelid = tbl and conname = 'sensor_devices_status_check'
      and pg_get_constraintdef(oid) like '%maintenance%'
  ) then
    alter table public.sensor_devices drop constraint if exists sensor_devices_status_check;
    alter table public.sensor_devices
      add constraint sensor_devices_status_check
      check (status in ('active', 'inactive', 'maintenance', 'retired'));
  end if;

  if not exists (select 1 from pg_constraint where conrelid = tbl and conname = 'sensor_devices_battery_check') then
    alter table public.sensor_devices
      add constraint sensor_devices_battery_check
      check (battery_level is null or (battery_level >= 0 and battery_level <= 100));
  end if;
end $$;

create index if not exists idx_sensor_devices_center_id on public.sensor_devices (center_id);
create index if not exists idx_sensor_devices_status    on public.sensor_devices (status);

-- ------------------------------------------------------------
-- device_credentials
-- ------------------------------------------------------------

alter table public.device_credentials
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  drop column if exists label;

do $$
declare
  tbl constant regclass := 'public.device_credentials'::regclass;
begin
  if exists (select 1 from pg_constraint where conrelid = tbl and conname = 'device_credentials_token_hash_key')
     and not exists (select 1 from pg_constraint where conrelid = tbl and conname = 'device_credentials_token_hash_unique') then
    alter table public.device_credentials
      rename constraint device_credentials_token_hash_key to device_credentials_token_hash_unique;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = tbl and conname = 'device_credentials_token_hash_unique') then
    alter table public.device_credentials
      add constraint device_credentials_token_hash_unique unique (token_hash);
  end if;
end $$;

-- ------------------------------------------------------------
-- device_telemetry
-- ------------------------------------------------------------

-- Serves the dashboard's "latest row for this band" query.
create index if not exists idx_device_telemetry_band_created
  on public.device_telemetry (band_id, created_at desc);

-- ------------------------------------------------------------
-- wearable_metrics
-- ------------------------------------------------------------

-- Recorded exactly as it exists in production. It duplicates the value
-- calculate_wearable_metrics() already writes; whether wearable_metrics
-- stays at all is decided with the device_telemetry.motion column.
create or replace function public.set_acceleration_magnitude()
returns trigger
language plpgsql
as $function$
DECLARE
    x double precision;
    y double precision;
    z double precision;
BEGIN
    SELECT ax, ay, az
    INTO x, y, z
    FROM public.device_telemetry
    WHERE id = NEW.telemetry_id;

    IF x IS NOT NULL AND y IS NOT NULL AND z IS NOT NULL THEN
        NEW.acceleration_magnitude :=
            SQRT(
                POWER(x, 2) +
                POWER(y, 2) +
                POWER(z, 2)
            );
    END IF;

    RETURN NEW;
END;
$function$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.wearable_metrics'::regclass
      and tgname = 'set_acceleration_magnitude_trigger'
  ) then
    create trigger set_acceleration_magnitude_trigger
      before insert on public.wearable_metrics
      for each row execute function public.set_acceleration_magnitude();
  end if;
end $$;

-- ------------------------------------------------------------
-- Dead functions (see header). No CASCADE: if anything still depends
-- on them, this fails instead of silently removing it.
-- ------------------------------------------------------------

drop function if exists public.expire_stale_online_devices();
drop function if exists public.compute_hrv_sdnn();

notify pgrst, 'reload schema';
