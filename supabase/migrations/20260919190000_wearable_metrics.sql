-- Wearable derived metrics: one calculated row per raw telemetry row.
create table if not exists public.wearable_metrics (
  id uuid primary key default gen_random_uuid(),
  telemetry_id uuid not null unique references public.device_telemetry(id) on delete cascade,
  band_id text not null,
  seq bigint not null,
  acceleration_magnitude double precision not null,
  rotation_magnitude double precision not null,
  movement_index double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists wearable_metrics_band_created_idx
  on public.wearable_metrics (band_id, created_at desc);

alter table public.wearable_metrics enable row level security;

drop policy if exists "Authenticated users can view wearable metrics"
  on public.wearable_metrics;

create policy "Authenticated users can view wearable metrics"
  on public.wearable_metrics
  for select
  to authenticated
  using (true);

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
  acceleration_magnitude := sqrt(
    power(coalesce(new.ax, 0), 2) +
    power(coalesce(new.ay, 0), 2) +
    power(coalesce(new.az, 0), 2)
  );

  rotation_magnitude := sqrt(
    power(coalesce(new.gx, 0), 2) +
    power(coalesce(new.gy, 0), 2) +
    power(coalesce(new.gz, 0), 2)
  );

  movement_index := abs(acceleration_magnitude - 1.0);

  insert into public.wearable_metrics (
    telemetry_id,
    band_id,
    seq,
    acceleration_magnitude,
    rotation_magnitude,
    movement_index
  )
  values (
    new.id,
    new.band_id,
    new.seq,
    acceleration_magnitude,
    rotation_magnitude,
    movement_index
  )
  on conflict (telemetry_id) do nothing;

  return new;
end;
$$;

drop trigger if exists device_telemetry_calculate_metrics
  on public.device_telemetry;

create trigger device_telemetry_calculate_metrics
after insert on public.device_telemetry
for each row
execute function public.calculate_wearable_metrics();

-- Keep the derived table in Supabase Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wearable_metrics'
  ) then
    alter publication supabase_realtime add table public.wearable_metrics;
  end if;
end $$;

notify pgrst, 'reload schema';
