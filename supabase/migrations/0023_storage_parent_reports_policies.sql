-- Storage bucket + RLS policies for parent-reports
-- Bucket created idempotently (may already exist from Edge Function)
insert into storage.buckets (id, name, public)
values ('parent-reports', 'parent-reports', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload PDFs to parent-reports bucket
create policy "Authenticated users can upload parent report PDFs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'parent-reports');

-- Allow authenticated users to read (download) parent report PDFs
create policy "Authenticated users can read parent report PDFs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'parent-reports');

-- Allow authenticated users to overwrite (upsert) their uploads
create policy "Authenticated users can update parent report PDFs"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'parent-reports');
