-- ============================================================
-- HRV (RMSSD) computed in Postgres from beat-to-beat intervals.
--
-- The band detects heartbeats (that needs its 100 samples/s waveform)
-- and sends every beat-to-beat interval (IBI) with its own artifact
-- verdict. Postgres computes RMSSD from those, so the rules can be
-- tuned and past sessions recomputed without reflashing any band.
--
--   RMSSD = sqrt( sum((IBI[n+1] - IBI[n])^2) / (N - 1) )   in ms
--
-- N - 1 counts the successive differences used: only pairs of adjacent
-- clean intervals in the same unbroken chain, and (Malik criterion)
-- only differences under 20% of the median interval. Computed over the
-- latest 30 such differences, so it follows changes within a session.
--
-- device_telemetry.hrv is filled by a trigger from these beats.
-- The band's own RMSSD is kept in hrv_device for validation.
--
-- Additive only: nullable columns (no table rewrite), a new table, a
-- new function and trigger. Rows without boot_id (older firmware or
-- Edge Function) keep whatever hrv they were given.
-- ============================================================

create table if not exists public.device_beats (
  id          bigint generated always as identity primary key,
  band_id     text             not null,
  boot_id     bigint           not null,  -- random per band boot
  chain       integer          not null,  -- +1 whenever the band's beat chain breaks
  beat_seq    integer          not null,  -- per boot, +1 per interval; gaps = lost beats
  t_ms        bigint           not null,  -- beat time, ms since boot (same clock as device_telemetry.t)
  ibi_ms      double precision not null,
  clean       boolean          not null,  -- passed the band's range and deviation checks
  created_at  timestamptz      not null default now(),
  constraint device_beats_band_boot_seq_unique unique (band_id, boot_id, beat_seq),
  constraint device_beats_ibi_check check (ibi_ms > 0 and ibi_ms < 5000)
);

-- The unique constraint's index (band_id, boot_id, beat_seq) serves
-- rmssd()'s "latest beats of this boot" lookup.
create index if not exists device_beats_created_at_idx
  on public.device_beats (created_at desc);

alter table public.device_beats enable row level security;

drop policy if exists "Authenticated users can view device beats" on public.device_beats;
create policy "Authenticated users can view device beats"
  on public.device_beats for select
  to authenticated
  using (true);

alter table public.device_telemetry
  add column if not exists boot_id    bigint,
  add column if not exists hrv_device double precision;

comment on column public.device_telemetry.hrv is
  'RMSSD in ms, computed by public.rmssd() from device_beats at insert time. NULL: not enough clean recent beats.';
comment on column public.device_telemetry.hrv_device is
  'RMSSD in ms as computed on the band itself. Kept for validation against hrv.';
comment on column public.device_telemetry.boot_id is
  'Random per band boot; links a row to that boot''s device_beats (t and beat t_ms share its clock).';

-- ------------------------------------------------------------
-- RMSSD at a point in time, from that boot's beats up to p_t_ms.
-- NULL when there are fewer than p_min_pairs usable differences or the
-- newest one is older than p_stale_ms.
-- ------------------------------------------------------------
create or replace function public.rmssd(
  p_band_id        text,
  p_boot_id        bigint,
  p_t_ms           double precision,
  p_pairs          integer          default 30,
  p_min_pairs      integer          default 10,
  p_max_successive double precision default 0.20,
  p_stale_ms       double precision default 5000
)
returns double precision
language sql
stable
set search_path = public
as $$
  with recent as (
    select beat_seq, chain, t_ms, ibi_ms, clean
    from public.device_beats
    where band_id = p_band_id
      and boot_id = p_boot_id
      and t_ms <= p_t_ms
    order by beat_seq desc
    limit p_pairs * 2 + 10          -- room for rejected beats between clean pairs
  ),
  reference as (
    select percentile_cont(0.5) within group (order by ibi_ms) as median_ibi
    from recent
    where clean
  ),
  paired as (
    select r.beat_seq, r.chain, r.t_ms, r.ibi_ms, r.clean,
           lag(r.ibi_ms)   over w as prev_ibi,
           lag(r.clean)    over w as prev_clean,
           lag(r.beat_seq) over w as prev_seq,
           lag(r.chain)    over w as prev_chain
    from recent r
    window w as (order by r.beat_seq)
  ),
  diffs as (
    select p.ibi_ms - p.prev_ibi as d, p.t_ms
    from paired p
    cross join reference ref
    where p.clean and p.prev_clean
      and p.prev_seq = p.beat_seq - 1          -- adjacent: no beat lost between
      and p.prev_chain = p.chain               -- same unbroken chain
      and abs(p.ibi_ms - p.prev_ibi) <= p_max_successive * ref.median_ibi
    order by p.beat_seq desc
    limit p_pairs
  )
  select case
           when count(*) >= p_min_pairs and max(t_ms) >= p_t_ms - p_stale_ms
             then sqrt(sum(d * d) / count(*))
         end
  from diffs;
$$;

comment on function public.rmssd(text, bigint, double precision, integer, integer, double precision, double precision) is
  'RMSSD (ms) = sqrt(sum of squared successive IBI differences / their count) over the latest clean adjacent pairs of one band boot.';

create or replace function public.set_telemetry_hrv()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.boot_id is not null then
    new.hrv := public.rmssd(new.band_id, new.boot_id, new.t);
  end if;
  return new;
end;
$$;

drop trigger if exists device_telemetry_set_hrv on public.device_telemetry;
create trigger device_telemetry_set_hrv
  before insert on public.device_telemetry
  for each row execute function public.set_telemetry_hrv();

notify pgrst, 'reload schema';
