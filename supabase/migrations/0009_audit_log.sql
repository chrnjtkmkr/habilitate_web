-- Audit log for clinical state changes
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references centers(id) on delete cascade,
  actor_id uuid not null references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

-- Covers: goal create/retire/mastered, intake completed,
-- report approved/sent, therapist reassigned
create index idx_audit_log_center on audit_log(center_id, created_at);
create index idx_audit_log_entity on audit_log(entity_type, entity_id);
