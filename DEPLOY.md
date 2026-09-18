# Deploy sequence — Wearable Infrastructure migrations

## Prerequisites

- Supabase CLI installed (`npx supabase --version`)
- The manual hotfix (add `hrv` to `device_telemetry`, make `hr`/`spo2` nullable) has been applied to production

## Steps

```bash
# 1. Link to the production project (if not already linked)
npx supabase link --project-ref <YOUR_PROJECT_REF>

# 2. Dry-run — must list ONLY the two 20260918* migration files
npx supabase db push --dry-run

# 3. Apply migrations
npx supabase db push

# 4. Verify applied migrations
npx supabase migration list

# 5. Deploy the edge function
npx supabase functions deploy wearable-ws --no-verify-jwt
```

## Expected dry-run output

The dry-run (step 2) should list exactly:

- `20260918120000_wearable_infrastructure.sql`
- `20260918120100_schema_reconciliation_and_hrv.sql`

If it lists anything else, stop and investigate before pushing.
