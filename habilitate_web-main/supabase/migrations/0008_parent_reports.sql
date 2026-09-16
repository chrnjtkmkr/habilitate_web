-- Parent reports
create table parent_reports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  center_id uuid not null references centers(id) on delete cascade,
  status report_status not null default 'draft',
  language language_code not null default 'hi',
  content jsonb not null default '{}',
  -- covers the reporting period
  period_start date not null,
  period_end date not null,
  -- approval workflow
  generated_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  -- delivery
  channel report_channel,
  sent_at timestamptz,
  -- whatsapp-specific delivery tracking
  whatsapp_message_id text,
  whatsapp_status text,
  whatsapp_status_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger parent_reports_updated_at
  before update on parent_reports
  for each row execute function set_updated_at();

create index idx_parent_reports_child on parent_reports(child_id);
create index idx_parent_reports_center_status on parent_reports(center_id, status);
