# Habilitate: Project Overview

A plain-language guide to how the Habilitate therapy band and dashboard fit together, which keys and passwords exist (and where they are kept), and what each folder in this repository is for.

> This document never contains real passwords, tokens or keys. It only says what they are and where they live.

---

## 1. How data flows: from the band to the screen

### The big picture

```
 ┌──────────────┐  1. Setup (Bluetooth, once)  ┌─────────────────────┐
 │  Therapy band │ ◄──────────────────────────► │ Dashboard (browser) │
 │  (ESP32-S3)   │                              └─────────▲───────────┘
 └──────┬───────┘                                         │
        │ 2. Wi-Fi                                        │ 6. Live updates
        ▼                                                 │    (Realtime)
 ┌──────────────────────┐  3. Secure WebSocket   ┌────────┴─────────┐
 │ Clinic Wi-Fi router   │ ─────────────────────► │ Supabase         │
 └──────────────────────┘                        │ 4. wearable-ws   │
                                                 │    (Edge Function)│
                                                 │ 5. Postgres       │
                                                 │    database       │
                                                 └──────────────────┘
```

The band is worn by the child. It measures pulse, skin response (GSR), skin temperature and movement. It sends these readings, many times a second, to our cloud backend (Supabase). There they are stored, and the therapist's dashboard shows them live.

### Step by step

**Step 1: Setup over Bluetooth (BLE)**
- The first time, a therapist opens the dashboard in Chrome on a tablet or laptop and connects to the band over Bluetooth Low Energy.
- The band shows up by name, for example `Habilitate-HAB-002`.
- Over Bluetooth, the dashboard can:
  - read the band's ID;
  - ask the band to scan for nearby Wi-Fi networks;
  - send it a Wi-Fi network name and password;
  - tell it whether a session is running or paused (this drives the band's light).
- Bluetooth is only used for setup and for those session messages. The actual sensor data does **not** go over Bluetooth.
- *Authentication:* none at the Bluetooth level. Any nearby device running the dashboard can connect to a band that is powered on. The protection is physical: you have to be within a few metres. The dashboard itself does require a therapist login.

**Step 2: Wi-Fi**
- The band stores the Wi-Fi name and password in its own memory, so it survives being switched off, and joins the network.
- Sending a new network always fully replaces the old one. The dashboard also has "Change Wi-Fi network" and "Forget band" options.
- *Authentication:* the normal Wi-Fi password. Office "enterprise" networks, the kind that ask for a username as well as a password, are not supported. The dashboard greys them out.

**Step 3: Secure WebSocket to the cloud**
- Once on Wi-Fi, the band opens a long-lived, encrypted (TLS) connection to our cloud function. A WebSocket is like a phone line that stays open, so the band can keep talking without redialling.
- *Authentication:* when connecting, the band presents its **band ID** and its secret **device token**.

**Step 4: The Edge Function (`wearable-ws`)**
- A small program running on Supabase's servers receives each connection.
- **It checks the band's identity:**
  - It turns the token into a fingerprint (a SHA-256 hash).
  - It looks that fingerprint up in the `device_credentials` table. The real token is never stored in the database, only its fingerprint.
  - It checks that the credential hasn't been revoked and that the band is marked active.
  - Anything wrong, and the connection is refused.
- **Once connected, it:**
  - checks that every message really comes from that band;
  - notes the band's firmware version and chip address, and warns if two bands seem to share one identity;
  - writes the readings into the database.
- *Authentication towards the database:* the function uses the **service role key**. This is an all-powerful server key that Supabase provides to its own functions automatically. It never leaves Supabase's servers.

**Step 5: The database (Postgres)**

The main tables involved:

| Table | What goes in it |
|---|---|
| `sensor_devices` | One row per band: its ID, which clinic owns it, whether it's active, plus diagnostics (firmware version, chip address, last restart reason). |
| `device_credentials` | The fingerprint of each band's token, and whether it has been revoked. |
| `device_telemetry` | The raw readings, about 25 per second: pulse, oxygen, GSR, temperature, movement. |
| `device_beats` | Each individual heartbeat interval. The database uses these to calculate heart-rate variability (HRV) itself. |
| `band_seconds` | A one-second summary of the readings. This is what the child-state engine uses. |
| `session_events` | Things recorded during a session: state changes made by the therapist, and the band's unvalidated estimates (kept for validation, never shown in reports). |

*Authentication:* **Row Level Security** (RLS) rules decide who may read what. Only logged-in users can read band data. Only the server key can write it.

**Step 6: Realtime to the dashboard**
- Supabase **Realtime** pushes every new `band_seconds` row to any dashboard that is listening, usually within about a second.
- The dashboard runs the **child-state engine** in the browser. It compares the child's signals with their own baseline and lights up Regulated, Amber or Dysregulated.
- *Authentication:* the therapist logs in with email and password (Supabase Auth). The browser then holds a short-lived login ticket (a JWT) that it presents with every request. The dashboard uses only the public **anon key** plus that login ticket, never the server key.

### Known weak points (worth knowing, not urgent)

- **Bluetooth is open:** anyone nearby with the dashboard can connect to a powered-on band, and the Wi-Fi password travels over Bluetooth unencrypted.
- **The band doesn't check the server's certificate:** the connection is encrypted, but the band doesn't verify it is really talking to Supabase.
- **The device token is sent in the web address** of the connection, which can end up in server logs.
- **Every logged-in user can read every band's data.** The read rules are not yet limited to the user's own clinic.
- **The free Supabase plan closes the connection every 60–95 seconds.** The band reconnects automatically, but about 6 seconds of data is lost each time.

---

## 2. Credentials and secrets

"In git" means the item is saved in this repository's history on GitHub. Anything secret must **not** be in git. The `.gitignore` file is the list of things git is told to skip.

| Name | What it's for | Where it lives | In git? | How to rotate / regenerate |
|---|---|---|---|---|
| **`DEVICE_TOKEN`** (one per band) | The band's password, proving to the cloud which band it is. | `firmware/HabilitateBand/secrets.h` on the computer used to flash the band, and inside the band's memory once flashed. The database stores only its fingerprint (`device_credentials.token_hash`). | **No.** `secrets.h` is gitignored and has never been committed. Only the template `secrets.example.h` (placeholder values) is in git. | Generate a new random token and add its fingerprint as a new `device_credentials` row. Put the token in `secrets.h` and re-flash the band. Then revoke the old row (`revoked_at = now()`). Steps are in `firmware/PROVISIONING.md`. |
| **`BAND_ID`** (one per band, e.g. `HAB-002`) | The band's name: its Bluetooth name and its label on every reading. Not secret, but it must be unique. | `secrets.h`, and in the database as `sensor_devices.device_uid`. | `secrets.h`: no. The ID itself appears in docs and data; that's fine. | Rarely changed. If needed, register a new band row with the new ID and re-flash. Every band must have its own. The chip-address check flags two bands sharing one ID. |
| **Wi-Fi name and password** | Lets the band join the clinic's network. | Only in the band's own memory, sent from the dashboard over Bluetooth. Not stored in the dashboard or the database. | No. | Use "Change Wi-Fi network" in the dashboard; the new network fully replaces the old. "Forget band" clears it. |
| **Supabase URL** (`VITE_SUPABASE_URL`, `SUPABASE_URL`) | The address of our Supabase project. Not secret. | `frontend/.env` for the dashboard; set automatically inside Edge Functions; `iot-gateway/.env` if the gateway is used. The project ID is also in `supabase/config.toml` and the firmware. | `.env` files: no (gitignored). The address itself appears in the repo; that's fine. | Only changes if the project moves to a new Supabase project. |
| **Supabase anon (public) key** (`VITE_SUPABASE_ANON_KEY`) | Lets the dashboard talk to Supabase at all. It is *meant* to be public: on its own it can only do what the RLS rules allow for a logged-out visitor. | `frontend/.env` (template: `frontend/.env.example`), and built into the dashboard that runs in the browser. | `.env`: no. The template with empty values is in git. | Supabase dashboard → Project Settings → API Keys. Update `frontend/.env` and rebuild the dashboard. |
| **Supabase service role key** (`SUPABASE_SERVICE_ROLE_KEY`) | The master server key. It ignores all RLS rules. Used by the Edge Functions (`wearable-ws`, `invite-therapist`) and by the optional `iot-gateway`. **Must never reach a browser.** | Provided automatically to Edge Functions by Supabase. For the gateway, in `iot-gateway/.env` (template: `iot-gateway/.env.example`). | No. | Supabase dashboard → Project Settings → API Keys. Edge Functions pick up the new key automatically; update `iot-gateway/.env` if used. Rotate straight away if it ever leaks. |
| **`SARVAM_API_KEY`** | Key for the Sarvam AI service used by the `recommend-plan-ai` function (AI session-plan suggestions). If missing, the function falls back to built-in rules. | Supabase Edge Function secrets (dashboard → Edge Functions → Secrets). | No. | Create a new key in the Sarvam account, then update it in Supabase's Edge Function secrets (dashboard, or `supabase secrets set`). Delete the old key at Sarvam. |
| **`DATABASE_URL`** (includes the database password) | Used only by the helper scripts in `scripts/` to connect straight to the database. | Set as an environment variable in your terminal when running a script. Not saved in any file in the repo. | No. | Supabase dashboard → Project Settings → Database → reset the database password, then use the new connection string. |
| **Supabase CLI login** | Lets a developer's computer push database changes and deploy Edge Functions (`npx supabase ...`). | Stored by the Supabase command-line tool in that user's own profile on their computer. `supabase/.temp/` (link details) is gitignored. | No. | Revoke it under Supabase account → Access Tokens, then run `npx supabase login` again. |
| **Therapist and staff logins** | Email and password for each dashboard user. | Supabase Auth, which stores passwords securely hashed. After login, the browser keeps a short-lived session ticket. | No. | Each user resets their password by email. An admin can remove users in Supabase → Authentication. The very first admin is created with `supabase/admin/bootstrap_first_user.sql`. |
| **GitHub access** | Lets a developer push code to `github.com/chrnjtkmkr/habilitate_web`. | The computer's Git Credential Manager. | No. | GitHub → Settings → Developer settings / Applications: revoke, then sign in again. |

**Rules of thumb**
- Secrets go in `secrets.h`, a `.env` file or the Supabase dashboard, never in code, docs or chat messages.
- If a secret is ever pasted somewhere public, rotate it. Deleting the message is not enough.
- The dashboard only ever needs the **URL** and the **anon key**. If anything asks you to put the **service role key** into the dashboard, don't.

---

## 3. Folder by folder

### `frontend/`: the dashboard website
- **What it's for:** everything therapists and centre staff see in the browser:
  - running sessions and the live band status;
  - the Regulated / Amber / Dysregulated header;
  - setting up bands over Bluetooth;
  - reports and intake forms.
- **What's in it:**
  - React + TypeScript source code in `src/`:
    - `pages/`: whole screens;
    - `components/`: reusable pieces;
    - `lib/`: logic, including the child-state engine in `lib/childState/`;
    - `services/`: Bluetooth;
    - `hooks/`: live data;
    - `i18n/`: English and Hindi text.
  - `public/`: images and icons.
  - Build and test settings: `vite.config.ts`, `vitest*.ts`, `tsconfig*.json`, `tailwind.config.js`.
  - `.env.example`: the template for the two public settings.
- **Why it's structured this way:**
  - Separating screens, building blocks and logic keeps each file small and testable.
  - All on-screen wording lives in the English and Hindi files, so nothing is hard-coded in one language.

### `supabase/`: the backend (database and cloud functions)
- **What it's for:** everything that runs on Supabase, our hosted database and server platform.
- **What's in it:**
  - `migrations/`: numbered SQL files, each one a step in building the database (tables, rules, calculations such as HRV). Run in order, they recreate the whole database from scratch.
  - `functions/`: small server programs (Edge Functions):
    - `wearable-ws`: receives band data;
    - `invite-therapist`: sends invitation emails;
    - `recommend-plan-ai`: suggests session plans;
    - `_shared`: common code.
  - `admin/`: one-off setup SQL, such as creating the first admin user.
  - `config.toml`: project settings for the Supabase command-line tool.
- **Why it's structured this way:** keeping every database change as a numbered file means the live database can always be rebuilt and checked against the code. Every change is also recorded and reviewable.

### `firmware/`: the software inside the band
- **What it's for:** the program that runs on the band's ESP32-S3 chip. It reads the sensors, handles Bluetooth setup and Wi-Fi, drives the coloured light, and streams data to the cloud.
- **What's in it:**
  - `HabilitateBand/HabilitateBand.ino`: the whole band program, opened and flashed with the Arduino IDE.
  - `HabilitateBand/secrets.example.h`: the template for each band's identity. The real `secrets.h` stays on your computer.
  - `PROVISIONING.md`: how to register and flash a new band.
  - `TEST_PLAN.md`: the bench tests (connection, light colours, heart rate, HRV, band switching, child state).
- **Why it's structured this way:** the Arduino IDE expects one folder per program, with the main file named after the folder. Per-band secrets are kept in a separate file so the shared code can be in git and the secrets can't be.

### `dataset/`: sample audio recordings
- **What it's for:** short sound clips used to test the voice features, which tell a child's voice from an adult's.
- **What's in it:** 400 `.wav` files in four groups of 100: `adult_speech`, `child_speech`, `simultaneous_speech` (both talking at once) and `therapy_noises` (background sounds).
- **Why it's structured this way:** one folder per type of sound makes it easy for automated tests (e.g. `frontend/src/cv/PitchDetector.test.ts`) to check the voice detection against known examples. These are test files only; they are never sent anywhere.

### `iot-gateway/`: an optional relay server (not currently in use)
- **What it's for:** a stand-alone program that can receive band connections instead of the Supabase Edge Function and write the data to the database. It exists as a future option, because the free Supabase plan closes band connections every 60–95 seconds. It is **not** running today.
- **What's in it:**
  - Node.js / TypeScript code in `src/`;
  - test scripts (`test-wss.mjs`, `test-edge-cases.mjs`);
  - `.env.example`: the template for its settings, including the service role key.
- **Why it's structured this way:** it is kept separate so it can be hosted on its own server if we ever move off the Edge Function, without touching the rest of the project.

### `scripts/`: helper tools for developers
- **What it's for:** one-off jobs such as loading the activity library, adding demo data, or applying database changes directly.
- **What's in it:**
  - Python scripts (`seed_*.py`, `apply_migrations.py`) and a shell script;
  - `requirements.txt`: the Python packages they need;
  - `SEED_DEMO_DATA.md`: instructions.
  - They read the database address from the `DATABASE_URL` environment variable, never from a saved file.
- **Why it's structured this way:** these tools are run by hand occasionally, so they're kept apart from the app itself.

### `seeds/`: starter content
- **What it's for:** the ready-made content the platform starts with.
- **What's in it:** `activity_library.json` (therapy activities) and `intake_assessment.json` (the intake questionnaire).
- **Why it's structured this way:** keeping content as plain data files, separate from code, makes it easy for clinical staff to review and for the scripts to load.

### `docs/`: reference material
- **What it's for:** non-code reference documents.
- **What's in it:** `brand/brand-kit-v1.pdf`, the brand guidelines (colours, logo, type).

### Files at the top level

| File | What it is |
|---|---|
| `README.md` | Short project introduction and setup steps. |
| `CLAUDE.md` | Working rules for the AI coding assistant: production boundaries, non-negotiables such as "no raw video or audio ever leaves the browser", and the stack. |
| `PROJECT_OVERVIEW.md` | This document. |
| `package.json` / `package-lock.json` | Installs the Supabase command-line tool for the whole repo. |
| `.gitignore` | The list of files git must never save: secrets, `.env` files, build output, installed packages. |

**Why everything is laid out like this:** each top-level folder is one part of the system (dashboard, backend, band, and so on). Someone working on one part only needs to look in one place. Earlier there were two partial copies of the project; they were merged into this single layout so there is exactly one source of truth.
