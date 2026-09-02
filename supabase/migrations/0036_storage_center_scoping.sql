-- 0036_storage_center_scoping.sql
-- Scope parent-reports storage policies to the caller's center membership.
-- Object paths follow the convention: center_id/child_id/report_id.pdf
-- If the upload path convention changes, these policies will silently deny.

-- Safe UUID extractor: returns NULL (deny) instead of throwing on
-- malformed paths where the first segment is not a valid UUID.
-- Lives in public because migrations cannot create objects in the storage schema.
create or replace function public.storage_center_id(obj_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  segment text;
begin
  segment := (storage.foldername(obj_name))[1];
  if segment is null then return null; end if;
  return segment::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Drop the three original bucket-only policies from 0023
drop policy if exists "Authenticated users can read parent report PDFs"   on storage.objects;
drop policy if exists "Authenticated users can upload parent report PDFs" on storage.objects;
drop policy if exists "Authenticated users can update parent report PDFs" on storage.objects;

-- SELECT: user must be a member of the center in the path
create policy "parent_reports_select_center_member"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'parent-reports'
    and auth_user_in_center(public.storage_center_id(name))
  );

-- INSERT: same center membership check
create policy "parent_reports_insert_center_member"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'parent-reports'
    and auth_user_in_center(public.storage_center_id(name))
  );

-- UPDATE: center membership in both USING and WITH CHECK
create policy "parent_reports_update_center_member"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'parent-reports'
    and auth_user_in_center(public.storage_center_id(name))
  )
  with check (
    bucket_id = 'parent-reports'
    and auth_user_in_center(public.storage_center_id(name))
  );
