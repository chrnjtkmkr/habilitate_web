# Habilitate V1

Web platform for pediatric developmental therapy centers in India.
Therapist runs sessions on a tablet in the browser. MediaPipe in the
browser produces engagement signals. Supervising therapist reviews
weekly reports before they go to parents on WhatsApp.

## Production boundaries

Claude Code never pushes migrations to the linked Supabase project,
never runs `git push`, never deploys to Vercel, and never uses
production credentials. Write the migration, apply it locally with
`npx supabase db reset`, verify it, then stop and report. The human
runs anything that touches production.

## Non-negotiables (do not violate)

- No raw video or raw audio ever leaves the browser. Only structured
  signals (head pose JSON, motion score, audio activity flag,
  composite engagement score) sync to Supabase.
- AI does not invent or modify clinical content during a live session.
  It sequences, measures, surfaces, records. Every clinical decision
  is the therapist's.
- All UI strings externalized via i18next. Hindi and English from day
  one. Hindi is the default for parent-facing surfaces.
- Plain language only for parent-facing copy. No clinical jargon.
  Roughly 8th-standard reading level.
- Center name and therapist name foregrounded everywhere a parent
  sees the platform. AI is never mentioned to parents.
- All activities carry a `validation_status` in the database
  (default: `draft_pending_clinical_validation`). The Chief Clinical
  Officer will mark activities as `validated` over time, but for V1
  we do NOT surface the validation status badge anywhere in the UI
  — not on activity cards, not in session plans, not in parent
  reports. The schema field stays for clinical record-keeping; the
  UI treats every activity as live content.
- Offline-first for the session execution flow. Therapist must be
  able to run a full session with no internet and sync afterwards.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind, hosted on Vercel
- Backend: Supabase (Postgres + Auth + Storage + Realtime), Mumbai region
- Browser AI: MediaPipe Tasks for Web (face + pose), Web Audio API
- Hosting: Vercel frontend, Supabase Mumbai backend
- i18n: i18next with `en` and `hi`
- PDF: server-side Puppeteer
- WhatsApp: direct WhatsApp Business API (provider details to be supplied; do NOT assume Twilio or 360dialog)

## Commands

- `npm run dev` — local dev server
- `npm test` — run tests
- `npm run lint` — eslint + typecheck
- `npm run typecheck` — tsc --noEmit
- `npx supabase db reset` — apply migrations locally (never push to production; the human does that)

## Workflow rules for Claude Code

- One feature per session. Use /clear between unrelated tasks.
- Always run `npm run lint` and `npm test` before suggesting a commit.
- For any new table or schema change: write the migration in
  supabase/migrations/, never edit existing migrations.
- For any new UI string: add it to both en.json and hi.json. Never
  hardcode user-visible text.
- Prefer prose comments over JSDoc blocks. Keep them short.

## Operational rules for schema changes (added after Week 2)

- Before adding any new column in a migration, FIRST grep all
  existing migrations: `grep -n "<column_name>" supabase/migrations/*.sql`
  AND query the live schema:
  `psql "$DATABASE_URL" -c "\d public.<table_name>"`. Adding a
  duplicate column is a hard error.
- Repo migrations are the source of truth for INTENT. Live database
  is the source of truth for STATE. They must stay in sync.
- All migrations must be idempotent: use `if not exists` for columns,
  `drop ... if exists; create ...` for triggers/policies/functions,
  and `on conflict do nothing` for seed inserts.
- After every schema change, regenerate types:
  `npx supabase gen types typescript --local --schema public > frontend/src/types/supabase.ts`
  Then run `cd frontend && npm run typecheck` to catch breakage early.
- Migration filenames use 4-digit numeric prefix (0001 to 9999).
  Tracker registration happens automatically via `db push --linked`;
  if applying SQL via the dashboard SQL editor, manually insert into
  supabase_migrations.schema_migrations.
