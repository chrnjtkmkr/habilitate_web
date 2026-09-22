-- ============================================================
-- Child-state pipeline: honest nulls, real time, one-second bins.
--
-- 1. A missing or failed sensor is stored as NULL, never as a stand-in
--    value. Until now the Edge Function wrote 0 for missing motion,
--    temperature and GSR, and 0,0,0 acceleration reads as 1 g of
--    movement. The columns become nullable (no table rewrite: dropping
--    NOT NULL only changes the catalog). motion stays generated and is
--    NULL whenever an axis is.
--
-- 2. sample_at: when the reading was taken, in real time. The band only
--    knows ms since boot (t); the Edge Function maps that to wall-clock
--    time per connection, so rows keep their true time even when they
--    arrive late or out of order.
--
-- 3. band_seconds: one row per band per second of device time, built by
--    the Edge Function from that second's packets (medians, flapping).
--    The child-state engine scores these; the dashboard subscribes to
--    them over Realtime, one message per second instead of 25.
--
-- 4. calculate_wearable_metrics() no longer turns missing acceleration
--    into 0 g; it simply skips rows without it.
--
-- Additive and re-runnable.
-- ============================================================

alter table public.device_telemetry
  alter column ax   drop not null,
  alter column ay   drop not null,
  alter column az   drop not null,
  alter column gx   drop not null,
  alter column gy   drop not null,
  alter column gz   drop not null,
  alter column temp drop not null,
  alter column gsr  drop not null;

alter table public.device_telemetry
  add column if not exists sample_at timestamptz;

comment on column public.device_telemetry.sample_at is
  'When the reading was taken (band clock mapped to wall-clock time by the Edge Function). NULL for rows from before 2026-09-22.';

-- ------------------------------------------------------------
-- wearable_metrics: skip rows without acceleration instead of
-- recording 0 g (a movement index of 1, i.e. "maximal movement").
-- ------------------------------------------------------------
create or replace function public.calculate_wearable_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acceleration_magnitude double precision;
  rotation_magnitude double precision;
  movement_index double precision;
begin
  if new.ax is null or new.ay is null or new.az is null then
    return new;
  end if;

  acceleration_magnitude := sqrt(power(new.ax, 2) + power(new.ay, 2) + power(new.az, 2));
  rotation_magnitude := sqrt(
    power(coalesce(new.gx, 0), 2) +
    power(coalesce(new.gy, 0), 2) +
    power(coalesce(new.gz, 0), 2)
  );
  movement_index := abs(acceleration_magnitude - 1.0);

  insert into public.wearable_metrics (
    telemetry_id, band_id, seq, acceleration_magnitude, rotation_magnitude, movement_index
  )
  values (
    new.id, new.band_id, new.seq, acceleration_magnitude, rotation_magnitude, movement_index
  )
  on conflict (telemetry_id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- band_seconds
-- ------------------------------------------------------------
create table if not exists public.band_seconds (
  id               bigint generated always as identity primary key,
  band_id          text             not null,
  boot_id          bigint           not null,
  device_second    bigint           not null,  -- floor(t / 1000) on the band's clock
  second_at        timestamptz      not null,  -- start of that second, real time
  packets          smallint         not null,
  gsr              double precision,           -- median raw ADC; NULL: no valid reading
  temp             double precision,           -- median skin temperature, degC
  motion_energy    double precision,           -- median | |a| - 1 g |, in g
  hr               double precision,           -- median bpm
  hrv              double precision,           -- latest database RMSSD, ms
  gyro_sd          double precision,           -- dps, most active axis over the last 2 s
  flap_hz          double precision,           -- dominant frequency of that axis
  flapping         boolean          not null default false,
  created_at       timestamptz      not null default now(),
  constraint band_seconds_band_boot_second_unique unique (band_id, boot_id, device_second)
);

create index if not exists band_seconds_band_second_at_idx
  on public.band_seconds (band_id, second_at desc);

alter table public.band_seconds enable row level security;

drop policy if exists "Authenticated users can view band seconds" on public.band_seconds;
create policy "Authenticated users can view band seconds"
  on public.band_seconds for select
  to authenticated
  using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'band_seconds'
  ) then
    alter publication supabase_realtime add table public.band_seconds;
  end if;
end $$;

notify pgrst, 'reload schema';
