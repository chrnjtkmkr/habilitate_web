-- ============================================================
-- Migration 20260918120000: Wearable infrastructure
--
-- Creates the three tables referenced by wearable-ws edge
-- function (sensor_devices, device_credentials,
-- wearable_samples), adds device online/offline tracking for
-- Issue 1 (cross-device visibility), adds HRV columns to
-- both wearable_samples and device_telemetry for Issue 4,
-- and adds a database function that computes HRV (SDNN over
-- a sliding window) and stores it in wearable_samples.
--
-- Fully idempotent: safe to run against a DB where every
-- object may already exist.
-- ============================================================

-- ============================================================
-- sensor_devices
-- ============================================================

create table if not exists public.sensor_devices (
  id               uuid        default gen_random_uuid()  primary key,
  device_uid       text        not null unique,
  device_name      text        not null,
  status           text        not null default 'active'
                               check (status in ('active', 'inactive', 'retired')),

  -- Issue 1: online/offline tracking
  is_online        boolean     not null default false,
  last_online_at   timestamptz,
  online_since     timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sensor_devices_updated_at on public.sensor_devices;
create trigger sensor_devices_updated_at
  before update on public.sensor_devices
  for each row execute function public.touch_updated_at();

create index if not exists idx_sensor_devices_device_uid
  on public.sensor_devices (device_uid);

alter table public.sensor_devices enable row level security;

drop policy if exists "Authenticated users can view sensor devices"
  on public.sensor_devices;
create policy "Authenticated users can view sensor devices"
  on public.sensor_devices for select
  to authenticated
  using (true);

-- ============================================================
-- device_credentials
-- ============================================================

create table if not exists public.device_credentials (
  id            uuid        default gen_random_uuid()  primary key,
  device_id     uuid        not null references public.sensor_devices (id) on delete cascade,
  token_hash    text        not null unique,
  label         text,
  revoked_at    timestamptz,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_device_credentials_token_hash
  on public.device_credentials (token_hash);

create index if not exists idx_device_credentials_device_id
  on public.device_credentials (device_id);

alter table public.device_credentials enable row level security;

-- ============================================================
-- wearable_samples (hw-samples)
-- ============================================================

create table if not exists public.wearable_samples (
  id                 uuid             default gen_random_uuid()  primary key,
  device_id          uuid             not null references public.sensor_devices (id) on delete cascade,
  session_id         uuid,            -- nullable; mapped to sessions after session start
  band_id            text             not null,

  sequence_number    bigint           not null,
  device_timestamp   double precision not null,  -- ESP32 millis()

  -- Motion
  accelerometer_x    double precision,
  accelerometer_y    double precision,
  accelerometer_z    double precision,
  gyroscope_x        double precision,
  gyroscope_y        double precision,
  gyroscope_z        double precision,

  -- Vitals
  skin_temperature   double precision,
  heart_rate         double precision,           -- BPM from firmware
  spo2               double precision,           -- % from firmware
  gsr                double precision,           -- raw ADC

  -- Issue 4: HRV columns
  hrv                double precision,           -- raw HRV transmitted by firmware (ms)
  computed_hrv_sdnn  double precision,           -- SDNN computed from the last 60 RR intervals

  captured_at        timestamptz      not null default now()
);

create index if not exists idx_wearable_samples_device_id
  on public.wearable_samples (device_id);

create index if not exists idx_wearable_samples_captured_at
  on public.wearable_samples (captured_at desc);

create index if not exists idx_wearable_samples_session_id
  on public.wearable_samples (session_id)
  where session_id is not null;

alter table public.wearable_samples enable row level security;

drop policy if exists "Authenticated users can view wearable samples"
  on public.wearable_samples;
create policy "Authenticated users can view wearable samples"
  on public.wearable_samples for select
  to authenticated
  using (true);

-- ============================================================
-- Issue 4: Add HRV column to device_telemetry
-- ============================================================

alter table public.device_telemetry
  add column if not exists hrv double precision;

-- ============================================================
-- Issue 4: Computed HRV — SDNN trigger on wearable_samples
-- ============================================================

create or replace function public.compute_hrv_sdnn()
returns trigger language plpgsql as $$
declare
  rr_values   double precision[];
  rr_val      double precision;
  rr_mean     double precision;
  rr_variance double precision;
  i           int;
  n           int;
begin
  -- Only compute when heart_rate is a valid positive number
  if new.heart_rate is null or new.heart_rate <= 0 then
    return new;
  end if;

  -- Collect the last 60 heart_rate readings for this device
  -- (including the current row via the already-inserted data).
  -- We re-query because the trigger fires AFTER insert.
  select array_agg(60000.0 / hr order by captured_at desc)
  into rr_values
  from (
    select heart_rate as hr, captured_at
    from public.wearable_samples
    where device_id = new.device_id
      and heart_rate is not null
      and heart_rate > 0
    order by captured_at desc
    limit 60
  ) sub;

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

  -- Compute variance
  rr_variance := 0;
  for i in 1..n loop
    rr_variance := rr_variance + (rr_values[i] - rr_mean) ^ 2;
  end loop;
  rr_variance := rr_variance / (n - 1);  -- sample variance (Bessel's correction)

  -- SDNN = sqrt(variance)
  new.computed_hrv_sdnn := sqrt(rr_variance);

  return new;
end;
$$;

drop trigger if exists wearable_samples_compute_hrv on public.wearable_samples;
create trigger wearable_samples_compute_hrv
  before insert on public.wearable_samples
  for each row execute function public.compute_hrv_sdnn();
