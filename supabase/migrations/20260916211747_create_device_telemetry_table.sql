create table public.device_telemetry (
  id         uuid             default gen_random_uuid() primary key,
  band_id    text             not null,
  seq        bigint           not null,
  t          double precision not null,
  ax         double precision not null,
  ay         double precision not null,
  az         double precision not null,
  gx         double precision not null,
  gy         double precision not null,
  gz         double precision not null,
  temp       double precision not null,
  hr         double precision not null,
  hrv        double precision,           -- HRV (ms) — nullable; populated by firmware when available
  spo2       double precision not null,
  gsr        double precision not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes for common queries
create index idx_device_telemetry_band_id    on public.device_telemetry(band_id);
create index idx_device_telemetry_created_at on public.device_telemetry(created_at desc);

-- Enable RLS
alter table public.device_telemetry enable row level security;

-- Create policy for authenticated users to read telemetry
create policy "Authenticated users can view telemetry"
  on public.device_telemetry for select
  to authenticated
  using (true);

-- The Edge Function will insert using the service_role key, so it bypasses RLS.
