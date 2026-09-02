-- Add pdf_url column to parent_reports for storing signed PDF URLs
alter table public.parent_reports
  add column if not exists pdf_url text;
