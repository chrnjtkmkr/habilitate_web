# Seed Demo Data

Creates a realistic, demo-ready dataset for Habilitate V1.

## What gets created

| Entity | Count | Notes |
|--------|-------|-------|
| Centers | 3 new | Sunshine (Indore), Little Steps (Nagpur), Vatsalya (Bhopal) |
| Users | 12 new | 1 owner + 1 supervisor + 2 therapists per center |
| Children | 12 new | 4 per center, varied profiles and trajectories |
| Parents | 12 new | 1 per child |
| Goals | ~36 | 2-4 per child |
| Sessions | ~182 | 6-8 weeks × 2/week × 13 children (85% completed) |
| Session activities | ~760 | 4-6 per completed session |
| Trials | ~8000 | 6-15 per session activity |
| Engagement samples | ~3800 | ~25 per completed session |
| Session plans | ~152 | 1 per completed session |
| Parent reports | 8 | 4 sent, 2 approved, 2 awaiting approval |

Aarav Sharma gets 6-8 weeks of fresh session history with an "improving" trajectory.

## What gets preserved

- **Habilitate Demo Center** row — not modified
- **Sushant Jadhav** and **Dr. Anant Singh Gaur** profiles — not modified
- **Aarav Sharma** child row, intake assessment, intake responses, goals, parent (Meera) — not modified
- **Activities** table — never reseeded
- **Intake instruments** table — never reseeded

## What gets reset

- **Aarav's session history** is deleted and recreated (sessions, session_activities, trials, engagement_samples, session_plans, parent_reports)
- **New center data** is dropped and recreated on each run (idempotent)

## How to run

```bash
# From project root
scripts/.venv/bin/python scripts/seed_demo_data.py
```

The script reads `.env` automatically via python-dotenv. Required env vars:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Approximate runtime: 5-7 minutes (mostly Supabase auth API calls + individual INSERT latency to Mumbai).

## Login credentials

| Center | Email | Password |
|--------|-------|----------|
| Sunshine Pediatric Therapy (Indore) | `owner@sunshine-pediatric-indore.local` | `demo-2026-habilitate` |
| Little Steps Center (Nagpur) | `owner@little-steps-nagpur.local` | `demo-2026-habilitate` |
| Vatsalya Child Development (Bhopal) | `owner@vatsalya-bhopal.local` | `demo-2026-habilitate` |

Each center also has `supervisor@...`, `therapist1@...`, `therapist2@...` with the same password.

## Trajectory states

The 13 children are assigned trajectories visible in `v_pulse_clinical`:

- **Improving (5)**: Aarav Sharma, Vihaan Patel, Myra Gupta, Saanvi Desai, Arnav Reddy
- **Steady (4)**: Ananya Sharma, Dhruv Kulkarni, Ira Menon, Aanya Joshi
- **Needs attention (4)**: Reyansh Verma, Kabir Khan, Ishaan Singh, Pari Iyer

## Determinism

The script uses `random.seed('habilitate-v1-demo-2026')` so re-runs produce identical data (modulo UUID generation which uses `uuid4`).
