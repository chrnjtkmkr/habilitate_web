# Habilitate V1 — Supabase Database

## Project setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) in the Mumbai (ap-south-1) region.

2. **Install the Supabase CLI** (if not already):
   ```bash
   brew install supabase/tap/supabase
   ```

3. **Log in and link your project:**
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

4. **Copy `.env.example` to `.env`** and fill in the values from your Supabase dashboard (Settings > API):
   ```bash
   cp .env.example .env
   ```

## Applying migrations

Push all migration files to your linked project:

```bash
supabase db push
```

This runs the 11 files in `supabase/migrations/` in order.

## Seeding content

After migrations are applied, seed the activity library and intake instrument:

```bash
# Activate the Python venv
source scripts/.venv/bin/activate

# Seed activities (100 activities from established frameworks)
python scripts/seed_activity_library.py seeds/activity_library.json

# Seed intake instrument (structured baseline assessment)
python scripts/seed_intake_instrument.py seeds/intake_assessment.json
```

## Auth configuration

In the Supabase dashboard under Authentication > Settings:

- **Enable** email/password sign-in
- **Disable** public signups (users are created by center owners via admin API)
- Leave magic link and OAuth disabled for V1

## Storage

Create a `parent-reports` bucket in Storage:

- **Access:** Private (not public)
- **File size limit:** 5 MB
- Used for generated PDF reports before WhatsApp delivery

## First center setup

After migrations and seeding, manually insert your first center, owner profile, and membership. Use the SQL Editor in the Supabase dashboard or psql:

```sql
-- 1. Create a user via Supabase Auth dashboard or admin API first, note the UUID

-- 2. Insert center
insert into centers (id, name, slug, city)
values (gen_random_uuid(), 'Demo Therapy Center', 'demo-center', 'Mumbai')
returning id;

-- 3. Insert profile (use the auth user UUID)
insert into profiles (id, full_name, preferred_language)
values ('<auth-user-uuid>', 'Center Owner Name', 'en');

-- 4. Create membership
insert into memberships (user_id, center_id, role)
values ('<auth-user-uuid>', '<center-id>', 'center_owner');
```

## Sanity-check queries

After setup, verify everything is in place:

```sql
-- Expect 20 tables (includes Supabase internal tables in count)
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Expect 23 RLS policies
select count(*) from pg_policies where schemaname = 'public';

-- Expect 100 activities
select count(*) from activities;

-- Expect 1 active instrument
select id, version, is_active from intake_instruments where is_active = true;
```

## Design decisions

### Multi-tenancy via center_id
Every domain table carries a `center_id` foreign key. Row-Level Security policies ensure users can only access data within their own center. Three helper functions (`auth_user_in_center`, `auth_user_has_role_in`, `auth_user_owns_child`) keep policies readable.

### Three roles
- **center_owner:** full read/write within their center, manages memberships
- **supervising_therapist:** reads all children in center, writes to assigned children, approves reports
- **therapist:** only sees their own assigned children's data

### Global content vs tenant data
Activities and intake instruments are global (shared across all centers). They are readable by all authenticated users but writable only via the service role key (seeding scripts). This prevents centers from accidentally modifying clinical content.

### Text primary keys for seeded content
Activities use text IDs (`ACT-0001`) and intake items use text IDs (`COM-001`, `DEM-001`, etc.) because these come from version-controlled seed files. UUIDs are used for everything else.

### Soft deletes on PII tables
`children` and `parents` have a `deleted_at` column. Queries filter on `deleted_at IS NULL` by default. This supports GDPR-style data retention while preserving referential integrity for historical sessions and reports.

### Engagement samples and future partitioning
At 5-second sampling intervals, engagement data grows fast. The table is indexed on `(session_id, recorded_at)` for efficient queries. A comment marks it for future monthly partitioning when volume warrants it.

### Session plans vs session activities
`session_plans` is an audit record of what the rule engine recommended. `session_activities` records what actually ran, with a `plan_origin` field tracking whether each activity was AI-recommended, therapist-added, or therapist-substituted. This separation ensures clinical autonomy is preserved and auditable.

### Audit log
Captures clinical state changes: goal creation/retirement/mastery, intake completion, report approval/sending, therapist reassignment. Stores before/after state as JSONB for full traceability. Read-only for owners and supervisors.

### Pulse views
Three materialized-style views (actually regular views for simplicity in V1):
- **v_pulse_operational:** center-level KPIs (active children, sessions, attendance, retention alerts)
- **v_pulse_clinical:** per-child trajectory (improving/steady/needs_attention based on trial success rate trends)
- **v_pulse_parent_engagement:** report delivery and parent responsiveness metrics
