-- Wearable telemetry must be part of Supabase Realtime's Postgres Changes
-- publication because the browser dashboard subscribes to INSERT events
-- on public.device_telemetry.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'device_telemetry'
  ) then
    alter publication supabase_realtime add table public.device_telemetry;
  end if;
end $$;

notify pgrst, 'reload schema';
