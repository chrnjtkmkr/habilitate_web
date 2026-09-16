# Habilitate V1

Habilitate is a web platform for pediatric developmental therapy centers in India. Therapists run structured sessions on a tablet in the browser, with MediaPipe providing real-time engagement signals. Supervising therapists review weekly progress reports before they are delivered to parents via WhatsApp.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind (Vercel)
- **Backend:** Supabase — Postgres, Auth, Storage, Realtime (Mumbai region)
- **Browser AI:** MediaPipe Tasks for Web, Web Audio API
- **i18n:** i18next (English + Hindi)
- **PDF reports:** server-side Puppeteer
- **Parent delivery:** WhatsApp Business API

## Database setup

See [supabase/README.md](supabase/README.md) for project creation, migrations, seeding, and design decisions.

## Commands

```bash
npm run dev          # local dev server
npm test             # run tests
npm run lint         # eslint + typecheck
npm run typecheck    # tsc --noEmit
supabase db push     # apply migrations to linked Supabase project
```
