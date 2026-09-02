#!/usr/bin/env python3
"""
Seed demo data for Habilitate V1 — 3 centers, 13 children, ~180 sessions.
Idempotent: re-running drops new centers (cascade) and resets Aarav's history.
Deterministic: random.seed ensures identical data across runs.

Usage:
  source .env
  scripts/.venv/bin/python scripts/seed_demo_data.py
"""

import json
import math
import os
import random
import sys
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import psycopg2
from psycopg2.extras import execute_batch, Json
from supabase import create_client

# ─── Deterministic RNG ───
random.seed("habilitate-v1-demo-2026")

IST = timezone(timedelta(hours=5, minutes=30))
TODAY = date.today()

# ─── ENV ───
DATABASE_URL = os.environ.get("DATABASE_URL", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# If direct DB host doesn't resolve, try the pooler URL (Supabase Mumbai region)
_pooler_path = Path(__file__).resolve().parent.parent / "supabase" / ".temp" / "pooler-url"
if _pooler_path.exists():
    pooler_url = _pooler_path.read_text().strip()
    # Extract password from DATABASE_URL and inject into pooler URL
    # DATABASE_URL format: postgresql://postgres:PASSWORD@host:port/db
    # pooler URL format:   postgresql://postgres.ref@host:port/db  (no password)
    parts = DATABASE_URL.split("@")[0]  # postgresql://postgres:PASSWORD
    pw = parts.split(":", 2)[-1]  # PASSWORD (after second colon)
    user_part = pooler_url.split("@")[0]  # postgresql://postgres.ref
    host_part = pooler_url.split("@")[1]  # host:port/db
    DATABASE_URL = f"{user_part}:{pw}@{host_part}"

if not DATABASE_URL or not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY required")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ─── Known IDs ───
DEMO_CENTER_ID = "17f24446-a5c2-4c50-9b99-73ea83009f19"
AARAV_ID = "ebb50105-5a1e-49fe-ba0a-4b8d6ef120a5"
SUSHANT_ID = "8c1782f9-0987-4f45-97de-8f705273e0ea"
ANANT_ID = "8753644f-fc60-4510-a335-1fcf40cf5ac6"
INSTRUMENT_ID = "371fa9de-9c23-462b-ad15-f709a28a3644"

PASSWORD = "demo-2026-habilitate"

# ─── Name pools ───
FIRST_NAMES = [
    "Priya", "Rahul", "Anjali", "Vikram", "Meera", "Arjun", "Sunita", "Rajesh",
    "Kavya", "Nikhil", "Pooja", "Suresh", "Lakshmi", "Aditya", "Neha",
    "Sandeep", "Divya", "Pranav", "Shilpa", "Manish",
]
LAST_NAMES = [
    "Sharma", "Patel", "Reddy", "Iyer", "Khan", "Singh", "Verma", "Gupta",
    "Joshi", "Pillai", "Kulkarni", "Banerjee", "Desai", "Menon", "Agarwal",
]

CHILD_FIRST_NAMES_M = ["Vihaan", "Reyansh", "Dhruv", "Kabir", "Ishaan", "Arnav", "Dev"]
CHILD_FIRST_NAMES_F = ["Ananya", "Myra", "Saanvi", "Ira", "Aanya", "Pari"]

CLINICAL_NOTES_TEMPLATES = [
    "Good engagement first {d} min, then needed break. Responded well to {act}.",
    "Maintained attention throughout. {n} successful trials in {dom} activities.",
    "Required additional prompting today. Showed interest in {act} but needed guidance.",
    "Excellent session — initiated interaction independently during {act}.",
    "Some difficulty with transitions between activities. Calmed with sensory break.",
    "Steady progress in {dom}. Increasing independence in responses.",
    "Engaged well with structured activities. Free play was challenging today.",
    "Strong vocalizations during {act}. Eye contact improving.",
    "Needed more sensory breaks than usual. Good recovery after each break.",
    "Responded to new {act} activity with curiosity. Will repeat next session.",
]

PARENT_TIPS_LIBRARY = {
    "joint_attention": [
        "Play face-to-face games like peek-a-boo for 5 minutes daily",
        "Follow your child's gaze and name what they're looking at",
        "Use bubbles to practice looking together at something fun",
    ],
    "expressive_language": [
        "Narrate daily routines in simple words — 'time for bath', 'let's eat'",
        "Wait 5 seconds after asking a question before helping",
        "Celebrate any sound or word attempt with enthusiasm",
    ],
    "receptive_language": [
        "Give simple one-step instructions during play",
        "Point to pictures in books and name them together",
        "Use gestures along with words to help understanding",
    ],
    "motor_imitation": [
        "Play 'copy me' games with simple actions like clapping",
        "Do actions with songs — 'Wheels on the Bus' is great practice",
        "Let your child see your face when you model actions",
    ],
    "social_reciprocity": [
        "Take turns during play — 'my turn, your turn'",
        "Practice greeting family members with a wave",
        "Play simple back-and-forth games like rolling a ball",
    ],
    "play_skills": [
        "Introduce pretend play — feed a doll, drive a toy car",
        "Join your child's play rather than directing it",
        "Offer 2-3 toy choices and let your child pick",
    ],
    "self_regulation": [
        "Create a calm corner with soft toys and cushions",
        "Use a picture schedule for daily routines",
        "Practice deep breathing together — 'smell the flower, blow the candle'",
    ],
    "attention_executive": [
        "Start with short focused activities (2-3 minutes) and build up",
        "Reduce distractions during learning time — TV off, quiet room",
        "Use timers to help your child understand 'how long'",
    ],
}


# ─── Centers to create ───
NEW_CENTERS = [
    {
        "name": "Sunshine Pediatric Therapy",
        "slug": "sunshine-pediatric-indore",
        "city": "Indore",
        "state": "Madhya Pradesh",
    },
    {
        "name": "Little Steps Center",
        "slug": "little-steps-nagpur",
        "city": "Nagpur",
        "state": "Maharashtra",
    },
    {
        "name": "Vatsalya Child Development",
        "slug": "vatsalya-bhopal",
        "city": "Bhopal",
        "state": "Madhya Pradesh",
    },
]

# ─── Children definitions ───
# 12 new children (4 per center) + Aarav existing
# profile: diagnostic_profile array, trajectory, age_months, gender, lang
NEW_CHILDREN_TEMPLATE = [
    # Center 0 (Sunshine Indore) — 4 children
    {"name": "Vihaan Patel", "profile": ["autism"], "trajectory": "improving", "age_months": 38, "gender": "male", "lang": "hi"},
    {"name": "Ananya Sharma", "profile": ["speech_delay"], "trajectory": "steady", "age_months": 30, "gender": "female", "lang": "hi"},
    {"name": "Reyansh Verma", "profile": ["adhd"], "trajectory": "needs_attention", "age_months": 56, "gender": "male", "lang": "en"},
    {"name": "Myra Gupta", "profile": ["autism", "speech_delay"], "trajectory": "improving", "age_months": 42, "gender": "female", "lang": "hi"},
    # Center 1 (Little Steps Nagpur) — 4 children
    {"name": "Dhruv Kulkarni", "profile": ["autism"], "trajectory": "steady", "age_months": 32, "gender": "male", "lang": "en"},
    {"name": "Saanvi Desai", "profile": ["speech_delay"], "trajectory": "improving", "age_months": 28, "gender": "female", "lang": "en"},
    {"name": "Kabir Khan", "profile": ["autism", "speech_delay"], "trajectory": "needs_attention", "age_months": 48, "gender": "male", "lang": "hi"},
    {"name": "Ira Menon", "profile": ["adhd"], "trajectory": "steady", "age_months": 62, "gender": "female", "lang": "en"},
    # Center 2 (Vatsalya Bhopal) — 4 children
    {"name": "Ishaan Singh", "profile": ["autism"], "trajectory": "needs_attention", "age_months": 44, "gender": "male", "lang": "hi"},
    {"name": "Aanya Joshi", "profile": ["speech_delay"], "trajectory": "steady", "age_months": 25, "gender": "female", "lang": "hi"},
    {"name": "Arnav Reddy", "profile": ["autism", "speech_delay"], "trajectory": "improving", "age_months": 36, "gender": "male", "lang": "en"},
    {"name": "Pari Iyer", "profile": ["autism"], "trajectory": "needs_attention", "age_months": 52, "gender": "female", "lang": "en"},
]

# Domain weighting by profile
PROFILE_DOMAIN_WEIGHTS = {
    "autism": ["joint_attention", "social_reciprocity", "expressive_language", "motor_imitation"],
    "speech_delay": ["expressive_language", "receptive_language", "joint_attention"],
    "adhd": ["attention_executive", "self_regulation", "play_skills"],
}

GOAL_TEMPLATES = {
    "joint_attention": [
        ("Looks at face during shared play", "emerging", "3/5 trials across 2 sessions"),
        ("Follows point to distant object", "emerging", "4/5 trials across 2 sessions"),
        ("Initiates joint attention by pointing", "established", "3/5 trials across 3 sessions"),
    ],
    "expressive_language": [
        ("Uses single words to request", "emerging", "Spontaneous use in 3/5 opportunities"),
        ("Combines two words", "established", "3/5 opportunities across 2 sessions"),
        ("Initiates request with point or sound", "emerging", "4/5 trials across 2 sessions"),
    ],
    "receptive_language": [
        ("Follows one-step instructions", "emerging", "4/5 trials across 2 sessions"),
        ("Identifies common objects by name", "established", "3/5 trials across 3 sessions"),
    ],
    "motor_imitation": [
        ("Imitates simple gestures", "emerging", "3/5 trials across 2 sessions"),
        ("Imitates actions with objects", "established", "4/5 trials across 3 sessions"),
    ],
    "social_reciprocity": [
        ("Takes turns in simple game", "emerging", "3 consecutive turns in 2 sessions"),
        ("Responds to social greeting", "established", "4/5 opportunities across 2 sessions"),
    ],
    "play_skills": [
        ("Engages in pretend play with objects", "emerging", "2 minutes sustained in 3/5 sessions"),
        ("Plays alongside peer", "established", "5 minutes parallel play in 3 sessions"),
    ],
    "self_regulation": [
        ("Transitions between activities with support", "emerging", "3/5 transitions without distress"),
        ("Uses calming strategy when prompted", "established", "3/5 opportunities"),
    ],
    "attention_executive": [
        ("Sustains attention to structured task for 3 min", "emerging", "3/5 sessions"),
        ("Follows two-step instructions", "established", "4/5 trials across 2 sessions"),
    ],
}

SESSION_TIMES = ["09:00", "10:30", "14:00", "15:30", "16:30"]


def make_uuid():
    return str(uuid.uuid4())


def date_from_age_months(age_months):
    """Compute date_of_birth given target age in months from today."""
    y = age_months // 12
    m = age_months % 12
    birth_year = TODAY.year - y
    birth_month = TODAY.month - m
    if birth_month <= 0:
        birth_month += 12
        birth_year -= 1
    day = min(TODAY.day, 28)
    return date(birth_year, birth_month, day)


def weekdays_between(start, end):
    """Generate weekday dates between start and end inclusive."""
    d = start
    while d <= end:
        if d.weekday() < 5:  # Mon-Fri
            yield d
        d += timedelta(days=1)


def lerp(a, b, t):
    return a + (b - a) * t


def gen_response_distribution(trajectory, week_index, total_weeks):
    """Return (responded, partial, no_response, refused) probability tuple.
    Distributions are deliberately extreme so the v_pulse_clinical trajectory
    view (which compares avg success rate of last 5 vs prior 5 sessions with
    a ±5% threshold) reliably detects the trend even with random noise."""
    t = week_index / max(total_weeks - 1, 1)
    if trajectory == "improving":
        return (
            lerp(0.15, 0.75, t),
            lerp(0.20, 0.18, t),
            lerp(0.45, 0.05, t),
            lerp(0.20, 0.02, t),
        )
    elif trajectory == "steady":
        return (0.50, 0.25, 0.20, 0.05)
    else:  # needs_attention
        return (
            lerp(0.40, 0.10, t),
            lerp(0.25, 0.15, t),
            lerp(0.25, 0.50, t),
            lerp(0.10, 0.25, t),
        )


def gen_engagement_score(trajectory, week_index, total_weeks):
    """Return average engagement score for this week."""
    t = week_index / max(total_weeks - 1, 1)
    if trajectory == "improving":
        return lerp(0.55, 0.78, t)
    elif trajectory == "steady":
        return 0.65
    else:
        return lerp(0.55, 0.45, t)


def weighted_choice(options, weights):
    """Pick from options using cumulative weights."""
    r = random.random()
    cum = 0
    for opt, w in zip(options, weights):
        cum += w
        if r <= cum:
            return opt
    return options[-1]


def create_auth_user(email):
    """Create auth user via Supabase admin API. Returns user id."""
    try:
        resp = sb.auth.admin.create_user({
            "email": email,
            "password": PASSWORD,
            "email_confirm": True,
        })
        return resp.user.id
    except Exception as e:
        if "already been registered" in str(e):
            # user exists, find their id
            users = sb.auth.admin.list_users()
            for u in users:
                if u.email == email:
                    return u.id
            raise
        raise


def delete_auth_user(uid):
    """Delete auth user via Supabase admin API."""
    try:
        sb.auth.admin.delete_user(uid)
    except Exception:
        pass


def main():
    t0 = time.time()
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Load activities for later use
    cur.execute("""
        SELECT id, name, developmental_domain, skill_level,
               diagnostic_profile_applicability::text, duration_minutes,
               target_age_min_months, target_age_max_months,
               prompting_hierarchy::text
        FROM activities ORDER BY id
    """)
    all_activities = []
    for row in cur.fetchall():
        profiles_str = row[4]  # e.g., "{autism,speech_delay}"
        profiles = [p.strip() for p in profiles_str.strip("{}").split(",") if p.strip()]
        ph_str = row[8]
        try:
            ph = json.loads(ph_str) if ph_str else []
        except (json.JSONDecodeError, TypeError):
            ph = []
        all_activities.append({
            "id": row[0], "name": row[1], "domain": row[2], "skill_level": row[3],
            "profiles": profiles, "duration": row[5],
            "age_min": row[6], "age_max": row[7], "prompting_hierarchy": ph,
        })

    print(f"Loaded {len(all_activities)} activities")

    # ─── STEP 0: Reset Aarav's session history ───
    print("\n=== STEP 0: Reset Aarav's session history ===")

    cur.execute("SELECT count(*) FROM parent_reports WHERE child_id = %s", (AARAV_ID,))
    rpt_count = cur.fetchone()[0]
    cur.execute("DELETE FROM parent_reports WHERE child_id = %s", (AARAV_ID,))

    cur.execute("""
        SELECT count(*) FROM engagement_samples es
        JOIN sessions s ON s.id = es.session_id WHERE s.child_id = %s
    """, (AARAV_ID,))
    eng_count = cur.fetchone()[0]

    cur.execute("""
        SELECT count(*) FROM trials t
        JOIN session_activities sa ON sa.id = t.session_activity_id
        JOIN sessions s ON s.id = sa.session_id WHERE s.child_id = %s
    """, (AARAV_ID,))
    trial_count = cur.fetchone()[0]

    cur.execute("""
        SELECT count(*) FROM session_activities sa
        JOIN sessions s ON s.id = sa.session_id WHERE s.child_id = %s
    """, (AARAV_ID,))
    sa_count = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM session_plans sp JOIN sessions s ON s.id = sp.session_id WHERE s.child_id = %s", (AARAV_ID,))
    sp_count = cur.fetchone()[0]

    cur.execute("SELECT count(*) FROM sessions WHERE child_id = %s", (AARAV_ID,))
    sess_count = cur.fetchone()[0]

    # CASCADE handles session_activities, trials, engagement_samples, session_plans
    cur.execute("DELETE FROM sessions WHERE child_id = %s", (AARAV_ID,))

    conn.commit()
    print(f"Reset Aarav: deleted {sess_count} sessions, {sa_count} session_activities, "
          f"{trial_count} trials, {eng_count} engagement_samples, {sp_count} session_plans, "
          f"{rpt_count} parent_reports")

    # ─── STEP 1: Center + User Setup ───
    print("\n=== STEP 1: Center + User Setup ===")

    center_data = []  # [{id, slug, name, owner_id, supervisor_id, therapist_ids}]

    for cdef in NEW_CENTERS:
        slug = cdef["slug"]

        # Cleanup: find auth users for this center's email domain
        all_users = sb.auth.admin.list_users()
        domain_suffix = f"@{slug}.local"
        for u in all_users:
            if u.email and u.email.endswith(domain_suffix):
                delete_auth_user(u.id)
                print(f"  Deleted auth user {u.email}")

        # Delete center if exists (cascades memberships, children, etc.)
        cur.execute("DELETE FROM centers WHERE slug = %s", (slug,))
        conn.commit()

        # Create center
        center_id = make_uuid()
        cur.execute("""
            INSERT INTO centers (id, name, slug, city, state)
            VALUES (%s, %s, %s, %s, %s)
        """, (center_id, cdef["name"], slug, cdef["city"], cdef["state"]))
        conn.commit()
        print(f"  Created center: {cdef['name']} ({center_id[:8]})")

        # Create users
        roles = [
            ("center_owner", f"owner@{slug}.local"),
            ("supervising_therapist", f"supervisor@{slug}.local"),
            ("therapist", f"therapist1@{slug}.local"),
            ("therapist", f"therapist2@{slug}.local"),
        ]
        user_ids = {}
        cred_classes = ["SLP", "OT", "BCBA", "SLP"]

        for i, (role, email) in enumerate(roles):
            uid = create_auth_user(email)
            full_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            lang = random.choice(["en", "hi"])
            rci = f"RCI-{random.randint(1000, 9999)}" if role != "center_owner" else None

            cur.execute("""
                INSERT INTO profiles (id, full_name, preferred_language, rci_registration_number, credential_class)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    preferred_language = EXCLUDED.preferred_language,
                    rci_registration_number = EXCLUDED.rci_registration_number,
                    credential_class = EXCLUDED.credential_class
            """, (uid, full_name, lang, rci, cred_classes[i] if role != "center_owner" else None))

            cur.execute("""
                INSERT INTO memberships (user_id, center_id, role, is_active)
                VALUES (%s, %s, %s, true)
                ON CONFLICT (user_id, center_id) DO UPDATE SET role = EXCLUDED.role
            """, (uid, center_id, role))

            user_ids[role + str(i)] = uid
            print(f"    {role}: {email} → {full_name}")

        conn.commit()

        center_data.append({
            "id": center_id,
            "slug": slug,
            "name": cdef["name"],
            "owner_id": user_ids["center_owner0"],
            "supervisor_id": user_ids["supervising_therapist1"],
            "therapist_ids": [user_ids["therapist2"], user_ids["therapist3"]],
        })

    # ─── STEP 2: Children + Parents + Intake + Goals ───
    print("\n=== STEP 2: Children + Parents + Intake + Goals ===")

    # Build child records: Aarav + 12 new
    child_records = []

    # Aarav (existing) — just record his data for session generation
    cur.execute("SELECT date_of_birth, diagnostic_profile::text FROM children WHERE id = %s", (AARAV_ID,))
    aarav_row = cur.fetchone()
    aarav_goals = []
    cur.execute("SELECT id, name, target_domain, target_skill_level FROM goals WHERE child_id = %s AND status = 'active'", (AARAV_ID,))
    for g in cur.fetchall():
        aarav_goals.append({"id": g[0], "name": g[1], "domain": g[2], "skill_level": g[3]})

    child_records.append({
        "id": AARAV_ID,
        "name": "Aarav Sharma",
        "center_id": DEMO_CENTER_ID,
        "profile": ["autism"],
        "trajectory": "improving",
        "age_months": 36,  # approximate
        "dob": aarav_row[0],
        "goals": aarav_goals,
        "therapist_id": ANANT_ID,
        "supervisor_id": SUSHANT_ID,
        "is_existing": True,
    })

    for ci, center in enumerate(center_data):
        children_for_center = NEW_CHILDREN_TEMPLATE[ci * 4 : ci * 4 + 4]
        for cdef in children_for_center:
            child_id = make_uuid()
            dob = date_from_age_months(cdef["age_months"])
            therapist_id = random.choice(center["therapist_ids"])
            supervisor_id = center["supervisor_id"]

            # Insert child
            cur.execute("""
                INSERT INTO children (id, center_id, full_name, date_of_birth, gender,
                    primary_language, primary_therapist_id, supervising_therapist_id,
                    diagnostic_profile, intake_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::diagnostic_profile[], 'completed')
            """, (child_id, center["id"], cdef["name"], dob, cdef["gender"],
                  cdef["lang"], therapist_id, supervisor_id,
                  "{" + ",".join(cdef["profile"]) + "}"))

            # Insert parent
            parent_name = f"{random.choice(FIRST_NAMES)} {cdef['name'].split()[-1]}"
            relationship = random.choice(["mother"] * 10 + ["father"] * 3)
            phone = f"+91{random.randint(7000000000, 9999999999)}"
            cur.execute("""
                INSERT INTO parents (child_id, full_name, phone, relationship,
                    preferred_language, is_primary_contact)
                VALUES (%s, %s, %s, %s, %s, true)
            """, (child_id, parent_name, phone, relationship, cdef["lang"]))

            # Insert intake assessment
            intake_date = TODAY - timedelta(days=random.randint(42, 56))
            intake_id = make_uuid()

            # Build computed_outputs based on profile
            baseline_bands = {}
            for p in cdef["profile"]:
                for domain in PROFILE_DOMAIN_WEIGHTS.get(p, []):
                    baseline_bands[domain] = random.choice(["emerging", "established"])

            computed_outputs = {
                "child_profile": {
                    "diagnostic_profile": cdef["profile"],
                    "chronological_age_months": cdef["age_months"],
                },
                "baseline_skill_bands": baseline_bands,
                "family_context": {
                    "parent_literacy_level": random.choice(["reads_hindi", "reads_english", "reads_both", "limited"]),
                    "home_practice_capacity": random.choice(["less_15", "15_30", "30_60", "more_60"]),
                    "home_practice_partners": random.choice([["mother"], ["mother", "father"], ["mother", "grandmother"]]),
                    "family_priorities": random.choice(["speech", "social skills", "independence", "school readiness"]),
                },
                "activity_eligibility_filter": {
                    "age_months": cdef["age_months"],
                    "diagnostic_profiles": cdef["profile"],
                },
            }

            cur.execute("""
                INSERT INTO intake_assessments (id, child_id, instrument_id, administered_by,
                    status, started_at, completed_at, computed_outputs)
                VALUES (%s, %s, %s, %s, 'completed', %s, %s, %s)
            """, (intake_id, child_id, INSTRUMENT_ID, therapist_id,
                  datetime.combine(intake_date, datetime.min.time()).replace(tzinfo=IST).isoformat(),
                  datetime.combine(intake_date, datetime.min.time()).replace(tzinfo=IST, hour=11).isoformat(),
                  Json(computed_outputs)))

            # Insert intake responses (simplified — key items)
            intake_items = [
                ("DEM-001", cdef["name"]),
                ("DEM-002", str(dob)),
                ("DEM-003", cdef["gender"]),
                ("DEM-004", cdef["lang"]),
                ("FAM-001", computed_outputs["family_context"]["parent_literacy_level"]),
                ("FAM-002", computed_outputs["family_context"]["home_practice_partners"]),
                ("FAM-003", computed_outputs["family_context"]["home_practice_capacity"]),
            ]
            for item_id, val in intake_items:
                cur.execute("""
                    INSERT INTO intake_responses (assessment_id, item_id, response_value)
                    VALUES (%s, %s, %s)
                """, (intake_id, item_id, Json(val)))

            # Insert goals
            goals = []
            domains_for_goals = []
            for p in cdef["profile"]:
                domains_for_goals.extend(PROFILE_DOMAIN_WEIGHTS.get(p, []))
            domains_for_goals = list(dict.fromkeys(domains_for_goals))  # dedupe preserving order
            num_goals = random.randint(2, 4)

            for gi in range(min(num_goals, len(domains_for_goals))):
                domain = domains_for_goals[gi]
                templates = GOAL_TEMPLATES.get(domain, [])
                if not templates:
                    continue
                tmpl = templates[gi % len(templates)]
                goal_id = make_uuid()
                cur.execute("""
                    INSERT INTO goals (id, child_id, center_id, name, target_domain,
                        target_skill_level, status, mastery_criteria, created_by)
                    VALUES (%s, %s, %s, %s, %s, %s, 'active', %s, %s)
                """, (goal_id, child_id, center["id"], tmpl[0], domain,
                      tmpl[1], tmpl[2], therapist_id))
                goals.append({"id": goal_id, "name": tmpl[0], "domain": domain, "skill_level": tmpl[1]})

            child_records.append({
                "id": child_id,
                "name": cdef["name"],
                "center_id": center["id"],
                "profile": cdef["profile"],
                "trajectory": cdef["trajectory"],
                "age_months": cdef["age_months"],
                "dob": dob,
                "goals": goals,
                "therapist_id": therapist_id,
                "supervisor_id": supervisor_id,
                "is_existing": False,
            })
            print(f"  {cdef['name']} ({', '.join(cdef['profile'])}, {cdef['trajectory']}) → {len(goals)} goals")

    conn.commit()

    # ─── STEP 3: Session History ───
    print("\n=== STEP 3: Session History ===")

    total_sessions = 0
    total_sa = 0
    total_trials = 0
    total_eng = 0
    total_plans = 0

    for child in child_records:
        # Generate 6-8 weeks of sessions ending this week
        num_weeks = random.randint(6, 8)
        start_date = TODAY - timedelta(weeks=num_weeks)

        # Pick 2 sessions per week on weekdays
        all_weekdays = list(weekdays_between(start_date, TODAY - timedelta(days=1)))
        if not all_weekdays:
            continue

        # Group by week
        weeks = {}
        for d in all_weekdays:
            week_num = (d - start_date).days // 7
            if week_num not in weeks:
                weeks[week_num] = []
            weeks[week_num].append(d)

        session_dates = []
        for wk in sorted(weeks.keys()):
            days = weeks[wk]
            if len(days) >= 2:
                picked = random.sample(days, 2)
            else:
                picked = days
            session_dates.extend(sorted(picked))

        # Filter eligible activities for this child
        eligible_activities = []
        for act in all_activities:
            # Check profile match
            profile_match = any(p in act["profiles"] for p in child["profile"])
            if not profile_match:
                continue
            # Check age (relaxed — within 12 months either side)
            if child["age_months"] < act["age_min"] - 12 or child["age_months"] > act["age_max"] + 12:
                continue
            eligible_activities.append(act)

        if not eligible_activities:
            eligible_activities = all_activities[:20]

        # Group eligible by domain for goal-aligned selection
        activities_by_domain = {}
        for act in eligible_activities:
            activities_by_domain.setdefault(act["domain"], []).append(act)

        goals = child["goals"]

        for si, sess_date in enumerate(session_dates):
            week_index = (sess_date - start_date).days // 7

            # Status distribution
            r = random.random()
            if r < 0.85:
                status = "completed"
            elif r < 0.95:
                status = "cancelled"
            else:
                status = "no_show"

            sess_time = random.choice(SESSION_TIMES)
            duration = random.choice([30, 35, 40, 45])
            session_id = make_uuid()

            base_dt = datetime.combine(sess_date, datetime.strptime(sess_time, "%H:%M").time())
            base_dt = base_dt.replace(tzinfo=IST)

            started_at = None
            ended_at = None
            notes = None
            attendance_at = None

            if status == "completed":
                started_at = base_dt + timedelta(minutes=random.randint(0, 3))
                ended_at = started_at + timedelta(minutes=duration)
                attendance_at = started_at - timedelta(minutes=1)
                act_name = random.choice(eligible_activities)["name"]
                dom_name = random.choice(eligible_activities)["domain"].replace("_", " ")
                notes = random.choice(CLINICAL_NOTES_TEMPLATES).format(
                    d=random.randint(10, 25), act=act_name,
                    dom=dom_name, n=random.randint(3, 8),
                )
            elif status == "no_show":
                attendance_at = base_dt

            cur.execute("""
                INSERT INTO sessions (id, child_id, center_id, therapist_id, status,
                    scheduled_date, scheduled_time, duration_minutes,
                    started_at, ended_at, therapist_notes,
                    attendance_marked_at, attendance_marked_by_user_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (session_id, child["id"], child["center_id"],
                  child["therapist_id"], status,
                  sess_date, sess_time, duration,
                  started_at.isoformat() if started_at else None,
                  ended_at.isoformat() if ended_at else None,
                  notes,
                  attendance_at.isoformat() if attendance_at else None,
                  child["therapist_id"] if attendance_at else None))

            total_sessions += 1

            if status != "completed":
                continue

            # ── Session activities ──
            num_activities = random.randint(4, 6)
            picked_activities = []

            # Try to align with goals
            goal_cycle = list(range(len(goals))) if goals else []
            for ai in range(num_activities):
                if goal_cycle and ai < len(goal_cycle):
                    goal = goals[goal_cycle[ai % len(goal_cycle)]]
                    domain_acts = activities_by_domain.get(goal["domain"], [])
                    if domain_acts:
                        act = random.choice(domain_acts)
                        picked_activities.append((act, goal["id"]))
                        continue
                # Random pick
                act = random.choice(eligible_activities)
                # Try to find a matching goal
                matching_goal_id = None
                for g in goals:
                    if g["domain"] == act["domain"]:
                        matching_goal_id = g["id"]
                        break
                picked_activities.append((act, matching_goal_id))

            # Plan origin distribution
            origins = []
            for _ in picked_activities:
                r = random.random()
                if r < 0.75:
                    origins.append("ai_recommended")
                elif r < 0.90:
                    origins.append("therapist_added")
                else:
                    origins.append("therapist_substituted")

            activity_window = (ended_at - started_at).total_seconds()
            per_activity_secs = activity_window / max(len(picked_activities), 1)

            sa_ids = []
            sa_time_ranges = []
            for ai, ((act, goal_id), origin) in enumerate(zip(picked_activities, origins)):
                sa_id = make_uuid()
                sa_start = started_at + timedelta(seconds=ai * per_activity_secs)
                sa_end = started_at + timedelta(seconds=(ai + 1) * per_activity_secs)

                cur.execute("""
                    INSERT INTO session_activities (id, session_id, activity_id, goal_id,
                        plan_origin, ordering, started_at, ended_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (sa_id, session_id, act["id"], goal_id, origin, ai,
                      sa_start.isoformat(), sa_end.isoformat()))

                sa_ids.append(sa_id)
                sa_time_ranges.append((sa_start, sa_end, act))
                total_sa += 1

            # ── Trials ──
            resp_dist = gen_response_distribution(child["trajectory"], week_index, num_weeks)
            responses = ["responded", "partial", "no_response", "refused"]

            for sa_idx, (sa_id, (sa_start, sa_end, act)) in enumerate(zip(sa_ids, sa_time_ranges)):
                num_trials = random.randint(6, 15)
                trial_window = (sa_end - sa_start).total_seconds()

                for ti in range(num_trials):
                    response = weighted_choice(responses, resp_dist)
                    prompt_level = None
                    if act["prompting_hierarchy"]:
                        prompt_level = random.choice(act["prompting_hierarchy"]) if isinstance(act["prompting_hierarchy"], list) and act["prompting_hierarchy"] else None
                        if isinstance(prompt_level, dict):
                            prompt_level = str(prompt_level)

                    trial_time = sa_start + timedelta(seconds=(ti + 1) * trial_window / (num_trials + 1))

                    cur.execute("""
                        INSERT INTO trials (session_activity_id, trial_number, response,
                            prompt_level, recorded_at)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (sa_id, ti + 1, response,
                          prompt_level,
                          trial_time.isoformat()))
                    total_trials += 1

            # ── Engagement samples ──
            eng_base = gen_engagement_score(child["trajectory"], week_index, num_weeks)
            sample_interval = 5  # seconds
            num_samples = int(activity_window / sample_interval)
            num_samples = min(num_samples, 25)  # cap

            for ei in range(num_samples):
                sample_time = started_at + timedelta(seconds=ei * sample_interval)
                # Find which session_activity this falls in
                sa_id_for_sample = sa_ids[0]
                for sa_idx, (sa_s, sa_e, _) in enumerate(sa_time_ranges):
                    if sa_s <= sample_time < sa_e:
                        sa_id_for_sample = sa_ids[sa_idx]
                        break

                composite = max(0, min(1, eng_base + random.gauss(0, 0.08)))
                motion = max(0, min(1, random.gauss(0.3, 0.12)))
                audio_flag = random.random() < 0.4
                yaw = random.gauss(0, 10)
                pitch = random.gauss(5, 8)
                roll = random.gauss(0, 3)

                cur.execute("""
                    INSERT INTO engagement_samples (session_activity_id, session_id,
                        head_pose, motion_score, audio_activity_flag,
                        composite_score, sampling_version, recorded_at)
                    VALUES (%s, %s, %s, %s, %s, %s, 'composite-v1', %s)
                """, (sa_id_for_sample, session_id,
                      Json({"yaw": round(yaw, 2), "pitch": round(pitch, 2), "roll": round(roll, 2)}),
                      round(motion, 3), audio_flag,
                      round(composite, 3),
                      sample_time.isoformat()))
                total_eng += 1

            # ── Session plan ──
            was_edited = random.random() < 0.3
            plan_activities = []
            recommended_ids = []
            for ai, (act, goal_id) in enumerate(picked_activities):
                plan_activities.append({
                    "activityId": act["id"],
                    "goalId": goal_id,
                    "sequenceIndex": ai,
                    "durationMinutes": act["duration"],
                    "rationale": [{"key": "rationale_goal_aligned", "values": {"goalName": goals[ai % len(goals)]["name"] if goals else "General"}}],
                })
                recommended_ids.append(act["id"])

            # If was_edited, swap 1-2 activities in recommended list
            edited_recommended_ids = list(recommended_ids)
            if was_edited and len(edited_recommended_ids) > 1:
                swap_count = random.randint(1, min(2, len(edited_recommended_ids)))
                for _ in range(swap_count):
                    idx = random.randint(0, len(edited_recommended_ids) - 1)
                    edited_recommended_ids[idx] = random.choice(eligible_activities)["id"]

            plan_json = {
                "activities": plan_activities,
                "generatorVersion": "recommender-v1",
                "totalDurationMinutes": sum(a["duration"] for a, _ in picked_activities),
                "fallbackUsed": False,
                "activityNames": {act["id"]: act["name"] for act, _ in picked_activities},
            }

            gen_at = started_at - timedelta(minutes=2)
            acc_at = started_at - timedelta(seconds=30)

            cur.execute("""
                INSERT INTO session_plans (session_id, recommended_activity_ids,
                    reasoning, generator_version, plan, accepted_at, accepted_by,
                    was_edited, generated_at)
                VALUES (%s, %s, %s, 'recommender-v1', %s, %s, %s, %s, %s)
            """, (session_id,
                  "{" + ",".join(edited_recommended_ids if was_edited else recommended_ids) + "}",
                  Json(plan_json),
                  Json(plan_json),
                  acc_at.isoformat(), child["therapist_id"],
                  was_edited, gen_at.isoformat()))
            total_plans += 1

        # Commit per child to avoid giant transaction
        conn.commit()
        completed = sum(1 for d in session_dates
                        for _ in [1]  # placeholder
                        ) * 0.85  # approximate
        print(f"  {child['name']}: {len(session_dates)} sessions ({child['trajectory']})")

    print(f"\nTotals: {total_sessions} sessions, {total_sa} session_activities, "
          f"{total_trials} trials, {total_eng} engagement_samples, {total_plans} session_plans")

    # ─── STEP 4: Parent Reports ───
    print("\n=== STEP 4: Parent Reports ===")

    # Pick 8 children from the 12 new ones (not Aarav)
    new_children = [c for c in child_records if not c.get("is_existing")]
    report_children = random.sample(new_children, min(8, len(new_children)))

    report_configs = [
        ("sent", 7),
        ("sent", 8),
        ("sent", 9),
        ("sent", 10),
        ("approved", 2),
        ("approved", 3),
        ("awaiting_approval", 1),
        ("awaiting_approval", 1),
    ]

    for ri, (child, (report_status, days_ago)) in enumerate(zip(report_children, report_configs)):
        created_at_dt = datetime.combine(TODAY - timedelta(days=days_ago), datetime.min.time()).replace(tzinfo=IST, hour=10)

        # Get therapist and supervisor names
        cur.execute("SELECT full_name FROM profiles WHERE id = %s", (child["therapist_id"],))
        therapist_name = cur.fetchone()[0]
        cur.execute("SELECT full_name FROM profiles WHERE id = %s", (child["supervisor_id"],))
        supervisor_name = cur.fetchone()[0]
        cur.execute("SELECT name FROM centers WHERE id = %s", (child["center_id"],))
        center_name = cur.fetchone()[0]

        # Count sessions for this child
        cur.execute("SELECT count(*) FROM sessions WHERE child_id = %s AND status = 'completed'", (child["id"],))
        sessions_completed = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM sessions WHERE child_id = %s", (child["id"],))
        sessions_scheduled = cur.fetchone()[0]

        # Period: a recent week
        period_end = TODAY - timedelta(days=days_ago + 1)
        period_start = period_end - timedelta(days=6)

        age_months = child["age_months"]
        age_str = f"{age_months // 12}y {age_months % 12}m"

        lang = "hi" if ri % 2 == 0 else "en"

        goals_worked = []
        for g in child["goals"][:3]:
            goals_worked.append({
                "goalName": g["name"],
                "domain": g["domain"].replace("_", " ").title(),
                "observationText": f"Working on {g['name'].lower()}. Showing {'good' if child['trajectory'] == 'improving' else 'steady'} progress with {'increasing' if child['trajectory'] == 'improving' else 'consistent'} response rates.",
            })

        primary_domains = [g["domain"] for g in child["goals"]]
        parent_tips = []
        for domain in primary_domains[:2]:
            tips = PARENT_TIPS_LIBRARY.get(domain, [])
            if tips:
                parent_tips.append({"tipText": random.choice(tips)})

        content = {
            "childFirstName": child["name"].split()[0],
            "childAgeYearsMonths": age_str,
            "centerName": center_name,
            "therapistName": therapist_name,
            "supervisorName": supervisor_name,
            "sessionsAttended": sessions_completed,
            "sessionsScheduled": sessions_scheduled,
            "goalsWorked": goals_worked,
            "parentTips": parent_tips,
            "closingNote": f"Thank you for your continued partnership. {child['name'].split()[0]} is making progress and we look forward to the coming weeks.",
            "periodLabel": f"{period_start.strftime('%d %b')} — {period_end.strftime('%d %b %Y')}",
            "language": lang,
            "nextSessionDate": None,
        }

        approved_at = None
        approved_by = None
        sent_at = None

        if report_status in ("approved", "sent"):
            approved_at = created_at_dt + timedelta(days=random.randint(1, 2))
            approved_by = child["supervisor_id"]
        if report_status == "sent":
            sent_at = approved_at + timedelta(hours=random.randint(1, 12))

        cur.execute("""
            INSERT INTO parent_reports (child_id, center_id, status, language, content,
                period_start, period_end, generated_by, approved_by, approved_at,
                sent_at, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (child["id"], child["center_id"], report_status, lang,
              Json(content), period_start, period_end,
              child["therapist_id"],
              approved_by,
              approved_at.isoformat() if approved_at else None,
              sent_at.isoformat() if sent_at else None,
              created_at_dt.isoformat()))

        print(f"  Report for {child['name']}: {report_status} ({lang})")

    conn.commit()

    # ─── STEP 5: Verification ───
    print("\n=== STEP 5: Verification ===")

    # a) Row counts
    tables = [
        "profiles", "memberships", "children", "parents", "goals",
        "sessions", "session_activities", "trials", "engagement_samples",
        "session_plans", "parent_reports",
    ]
    print("\n  Row counts:")
    for t in tables:
        cur.execute(f"SELECT count(*) FROM {t}")
        count = cur.fetchone()[0]
        print(f"    {t:25s} {count:>6}")

    # b) Trajectory distribution
    print("\n  Trajectory distribution:")
    cur.execute("SELECT trajectory, count(*) FROM v_pulse_clinical GROUP BY trajectory ORDER BY trajectory")
    for row in cur.fetchall():
        print(f"    {row[0]:20s} {row[1]:>4}")

    # c) was_edited distribution
    print("\n  was_edited distribution:")
    cur.execute("SELECT was_edited, count(*) FROM session_plans GROUP BY was_edited ORDER BY was_edited")
    for row in cur.fetchall():
        print(f"    {'edited' if row[0] else 'original':20s} {row[1]:>4}")

    # d) 3 sample children
    print("\n  Sample children:")
    cur.execute("""
        SELECT v.full_name, v.active_goal_count, v.sessions_completed,
               v.last_session_date, v.trajectory
        FROM v_pulse_clinical v
        ORDER BY random()
        LIMIT 3
    """)
    for row in cur.fetchall():
        print(f"    {row[0]:20s} goals={row[1]} sessions={row[2]} last={row[3]} trajectory={row[4]}")

    # e) Center isolation
    print("\n  Center isolation:")
    cur.execute("""
        SELECT c.name, count(distinct ch.id) as kids
        FROM centers c
        LEFT JOIN children ch ON ch.center_id = c.id AND ch.deleted_at IS NULL
        GROUP BY c.name
        ORDER BY c.name
    """)
    for row in cur.fetchall():
        print(f"    {row[0]:35s} {row[1]:>3} children")

    conn.close()

    elapsed = time.time() - t0
    print(f"\n=== Done in {elapsed:.1f}s ===")
    print(f"\nAarav reset clean, Demo Center untouched, Sushant + Anant profiles preserved")
    print(f"\n  Login credentials for new centers:")
    for c in center_data:
        print(f"    {c['name']:35s} owner@{c['slug']}.local / {PASSWORD}")


if __name__ == "__main__":
    main()
