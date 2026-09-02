#!/usr/bin/env bash
# seed_care_team_test.sh — Repeatable fixture for 0031 care-team RLS testing
# LOCAL ONLY. Never run against the remote project.
set -euo pipefail

API="http://127.0.0.1:54321"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-your_service_role_key_here}"

EMAILS="owner@seedtest.local speech@seedtest.local ot@seedtest.local unrelated@seedtest.local"
PASSWORD="Test1234!"

# Helper: call Auth Admin API
auth_admin() {
  curl -s -H "Authorization: Bearer $SERVICE_KEY" \
       -H "apikey: $SERVICE_KEY" \
       -H "Content-Type: application/json" \
       "$@"
}

# Helper: run SQL via docker psql
run_sql() {
  docker exec supabase_db_habilitate psql -U postgres -v ON_ERROR_STOP=1 -t -A -c "$1"
}

# Helper: run SQL and return only the first line (for RETURNING id)
run_sql_id() {
  run_sql "$1" | head -1
}

echo "=== TEARDOWN ==="

# Order matters: children/goals/sessions reference profiles, memberships has a
# last-owner trigger, and auth.users cascades to profiles. Clean inside-out.
run_sql "
DO \$\$
DECLARE cid uuid;
BEGIN
  SELECT id INTO cid FROM centers WHERE name = 'Seed Test Center';
  IF cid IS NULL THEN RETURN; END IF;
  -- Remove referencing rows before touching profiles/center
  DELETE FROM goals WHERE center_id = cid;
  DELETE FROM parent_reports WHERE center_id = cid;
  DELETE FROM session_notes WHERE child_id IN (SELECT id FROM children WHERE center_id = cid);
  DELETE FROM children WHERE center_id = cid;
  -- Disable the last-owner trigger so we can delete all memberships
  ALTER TABLE memberships DISABLE TRIGGER trg_prevent_last_owner_removal;
  DELETE FROM memberships WHERE center_id = cid;
  ALTER TABLE memberships ENABLE TRIGGER trg_prevent_last_owner_removal;
  DELETE FROM centers WHERE id = cid;
END \$\$;
" || true
echo "  Deleted center 'Seed Test Center' (if existed)"

# Delete auth users via Admin API (ensures GoTrue cleans up properly)
for email in $EMAILS; do
  uid=$(run_sql "SELECT id FROM auth.users WHERE email = '$email';" 2>/dev/null | head -1 | tr -d ' ')
  if [ -n "$uid" ]; then
    auth_admin -X DELETE "$API/auth/v1/admin/users/$uid" > /dev/null 2>&1 || true
  fi
done
echo "  Deleted auth users (if existed)"

echo ""
echo "=== CREATE AUTH USERS ==="

create_user() {
  local payload
  payload=$(python3 -c "import json; print(json.dumps({'email':'$1','password':'$PASSWORD','email_confirm':True}))")
  auth_admin -X POST "$API/auth/v1/admin/users" \
    -d "$payload" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"
}

OWNER_ID=$(create_user "owner@seedtest.local")
echo "  owner@seedtest.local    => $OWNER_ID"
SPEECH_ID=$(create_user "speech@seedtest.local")
echo "  speech@seedtest.local   => $SPEECH_ID"
OT_ID=$(create_user "ot@seedtest.local")
echo "  ot@seedtest.local       => $OT_ID"
UNRELATED_ID=$(create_user "unrelated@seedtest.local")
echo "  unrelated@seedtest.local => $UNRELATED_ID"

echo ""
echo "=== SEED DATA VIA POSTGRES ==="

# Upsert profiles
run_sql "
INSERT INTO profiles (id, full_name, preferred_language, discipline_id)
VALUES
  ('$OWNER_ID',     'Center Owner',   'en', NULL),
  ('$SPEECH_ID',    'Priya Speech',   'en', 'speech_therapy'),
  ('$OT_ID',        'Rahul OT',       'en', 'occupational_therapy'),
  ('$UNRELATED_ID', 'Neha Behaviour', 'en', 'behavioural_therapy')
ON CONFLICT (id) DO UPDATE SET
  full_name       = EXCLUDED.full_name,
  discipline_id   = EXCLUDED.discipline_id;
"
echo "  Upserted 4 profiles"

# Insert center
CENTER_ID=$(run_sql_id "
INSERT INTO centers (name, slug, city, timezone)
VALUES ('Seed Test Center', 'seed-test-center', 'Mumbai', 'Asia/Kolkata')
RETURNING id;
")
echo "  Center: $CENTER_ID"

# Insert memberships (role enum: center_owner, supervising_therapist, therapist)
run_sql "
INSERT INTO memberships (user_id, center_id, role, is_active) VALUES
  ('$OWNER_ID',     '$CENTER_ID', 'center_owner', true),
  ('$SPEECH_ID',    '$CENTER_ID', 'therapist',    true),
  ('$OT_ID',        '$CENTER_ID', 'therapist',    true),
  ('$UNRELATED_ID', '$CENTER_ID', 'therapist',    true);
"
echo "  4 memberships created"

# Insert child
CHILD_ID=$(run_sql_id "
INSERT INTO children (
  center_id, full_name, date_of_birth, gender,
  primary_language, primary_therapist_id, supervising_therapist_id,
  diagnostic_profile, intake_status
) VALUES (
  '$CENTER_ID', 'Aarav Test', '2020-05-01', 'male',
  'hi', '$SPEECH_ID', '$OWNER_ID',
  '{autism}', 'completed'
)
RETURNING id;
")
echo "  Child: $CHILD_ID"

# Insert child_care_team (speech + OT; trigger may have already created the speech row)
run_sql "
INSERT INTO child_care_team (child_id, therapist_id, discipline_id, role, is_active) VALUES
  ('$CHILD_ID', '$SPEECH_ID', 'speech_therapy',       'lead', true),
  ('$CHILD_ID', '$OT_ID',     'occupational_therapy',  'lead', true)
ON CONFLICT (child_id, therapist_id, discipline_id) DO UPDATE SET is_active = true;
"
echo "  2 care-team rows ensured"

# Insert 2 sessions (completed, last week)
SPEECH_SESSION_ID=$(run_sql_id "
INSERT INTO sessions (
  child_id, center_id, therapist_id, status, scheduled_date,
  started_at, ended_at, discipline_id
) VALUES (
  '$CHILD_ID', '$CENTER_ID', '$SPEECH_ID', 'completed',
  (CURRENT_DATE - 3),
  (now() - interval '3 days'),
  (now() - interval '3 days' + interval '45 minutes'),
  'speech_therapy'
)
RETURNING id;
")
echo "  Speech session: $SPEECH_SESSION_ID"

OT_SESSION_ID=$(run_sql_id "
INSERT INTO sessions (
  child_id, center_id, therapist_id, status, scheduled_date,
  started_at, ended_at, discipline_id
) VALUES (
  '$CHILD_ID', '$CENTER_ID', '$OT_ID', 'completed',
  (CURRENT_DATE - 1),
  (now() - interval '1 day'),
  (now() - interval '1 day' + interval '30 minutes'),
  'occupational_therapy'
)
RETURNING id;
")
echo "  OT session: $OT_SESSION_ID"

# Insert 2 goals (activity_id is nullable per 0019)
run_sql "
INSERT INTO goals (
  child_id, center_id, activity_id, status, mastery_criteria, created_by,
  name, target_domain, target_skill_level
) VALUES
  ('$CHILD_ID', '$CENTER_ID', NULL, 'active',
   '3 consecutive correct responses',
   '$SPEECH_ID',
   'Respond to name within 3 seconds',
   'receptive_language', 'emerging'),
  ('$CHILD_ID', '$CENTER_ID', NULL, 'active',
   'Holds pencil with tripod grip for 30 seconds',
   '$OT_ID',
   'Tripod grip for pencil',
   'motor_imitation', 'emerging');
"
echo "  2 goals created"

# Insert parent + parent_report
run_sql "
INSERT INTO parents (child_id, full_name, phone, relationship, preferred_language, is_primary_contact)
VALUES ('$CHILD_ID', 'Meera Test', '+919876543210', 'mother', 'hi', true);

INSERT INTO parent_reports (
  child_id, center_id, status, language, content,
  period_start, period_end, generated_by
) VALUES (
  '$CHILD_ID', '$CENTER_ID', 'draft', 'hi', '{\"summary\":\"Seed test report\"}'::jsonb,
  (CURRENT_DATE - 7), CURRENT_DATE, '$OWNER_ID'
);
"
echo "  1 parent + 1 parent_report created"

# Progress spine: ensure attributes exist, insert probes with IDs, milestone + personal_bests with probe_id
# The probe_id chain (personal_bests/milestones → probes → sessions → therapist_id) must resolve
# so the My Work page can attribute moments to the therapist who ran the session.

# Probes belong to the SPEECH therapist's session so speech@seedtest.local sees moments.
PROBE_RTN_ID=$(run_sql_id "
INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES (
  '$SPEECH_SESSION_ID', '$CHILD_ID', 'response_to_name',
  now() - interval '3 days', 'mediapipe', '{\"latency_ms\":2500,\"orientation\":\"looked\"}'::jsonb, 2500, true
)
RETURNING id;
")
echo "  Probe (RTN): $PROBE_RTN_ID"

PROBE_RTN2_ID=$(run_sql_id "
INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES (
  '$SPEECH_SESSION_ID', '$CHILD_ID', 'response_to_name',
  now() - interval '3 days' + interval '5 minutes', 'mediapipe', '{\"latency_ms\":2100}'::jsonb, 2100, true
)
RETURNING id;
")
echo "  Probe (RTN2): $PROBE_RTN2_ID"

# A looks_at_you probe in the speech session for the second personal best
PROBE_GAZE_ID=$(run_sql_id "
INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES (
  '$SPEECH_SESSION_ID', '$CHILD_ID', 'looks_at_you',
  now() - interval '3 days' + interval '10 minutes', 'mediapipe', '{\"duration_ms\":8200}'::jsonb, 8200, true
)
RETURNING id;
")
echo "  Probe (gaze): $PROBE_GAZE_ID"

# OT session probe (for coverage, not linked to moments)
run_sql "
INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES (
  '$OT_SESSION_ID', '$CHILD_ID', 'response_to_name',
  now() - interval '1 day', 'mediapipe', '{\"latency_ms\":1800}'::jsonb, 1800, true
);
"

# Milestone — probe_id points to the speech therapist's probe
run_sql "
INSERT INTO milestones (child_id, attribute_id, milestone_key, achieved_at, probe_id)
VALUES ('$CHILD_ID', 'response_to_name', 'sub_3s_first', now() - interval '3 days', '$PROBE_RTN_ID');
"

# Personal best 1: response_to_name latency — probe in speech session
run_sql "
INSERT INTO personal_bests (child_id, attribute_id, metric, value, achieved_at, probe_id)
VALUES ('$CHILD_ID', 'response_to_name', 'fastest_latency_ms', 2100, now() - interval '3 days', '$PROBE_RTN2_ID');
"

# Personal best 2: looks_at_you duration — probe in speech session
run_sql "
INSERT INTO personal_bests (child_id, attribute_id, metric, value, achieved_at, probe_id)
VALUES ('$CHILD_ID', 'looks_at_you', 'longest_duration_ms', 8200, now() - interval '3 days', '$PROBE_GAZE_ID');
"
echo "  4 probes, 1 milestone, 2 personal_bests created (all with probe_id)"

# Session note from speech therapist
run_sql "
INSERT INTO session_notes (session_id, child_id, author_id, discipline_id, body, scope)
VALUES ('$SPEECH_SESSION_ID', '$CHILD_ID', '$SPEECH_ID', 'speech_therapy',
        'Speech baseline recorded during intake.', 'session');
"
echo "  1 session_note created for Aarav"

echo ""
echo "=== EXTENDED FIXTURE (richer data for My Work page) ==="

# 5 more children
CHILD2_ID=$(run_sql_id "
INSERT INTO children (center_id, full_name, date_of_birth, gender, primary_language, primary_therapist_id, supervising_therapist_id, diagnostic_profile, intake_status)
VALUES ('$CENTER_ID', 'Meera Sharma', '2019-08-15', 'female', 'hi', '$SPEECH_ID', '$OWNER_ID', '{autism,speech_delay}', 'completed')
RETURNING id;")
CHILD3_ID=$(run_sql_id "
INSERT INTO children (center_id, full_name, date_of_birth, gender, primary_language, primary_therapist_id, supervising_therapist_id, diagnostic_profile, intake_status)
VALUES ('$CENTER_ID', 'Rohan Patel', '2018-03-22', NULL, 'hi', '$SPEECH_ID', '$OWNER_ID', '{speech_delay}', 'completed')
RETURNING id;")
CHILD4_ID=$(run_sql_id "
INSERT INTO children (center_id, full_name, date_of_birth, gender, primary_language, primary_therapist_id, supervising_therapist_id, diagnostic_profile, intake_status)
VALUES ('$CENTER_ID', 'Ananya Gupta', '2021-01-10', 'female', 'hi', '$SPEECH_ID', '$OWNER_ID', '{autism}', 'completed')
RETURNING id;")
CHILD5_ID=$(run_sql_id "
INSERT INTO children (center_id, full_name, date_of_birth, gender, primary_language, primary_therapist_id, supervising_therapist_id, diagnostic_profile, intake_status)
VALUES ('$CENTER_ID', 'Kabir Singh', '2020-11-05', 'male', 'hi', '$OT_ID', '$OWNER_ID', '{adhd}', 'completed')
RETURNING id;")
CHILD6_ID=$(run_sql_id "
INSERT INTO children (center_id, full_name, date_of_birth, gender, primary_language, primary_therapist_id, supervising_therapist_id, diagnostic_profile, intake_status)
VALUES ('$CENTER_ID', 'Diya Verma', '2017-06-20', 'female', 'en', '$OT_ID', '$OWNER_ID', '{autism,speech_delay}', 'completed')
RETURNING id;")
echo "  5 additional children created"

# Care team for new children
run_sql "
INSERT INTO child_care_team (child_id, therapist_id, discipline_id, role, is_active) VALUES
  ('$CHILD2_ID', '$SPEECH_ID', 'speech_therapy', 'lead', true),
  ('$CHILD3_ID', '$SPEECH_ID', 'speech_therapy', 'lead', true),
  ('$CHILD4_ID', '$SPEECH_ID', 'speech_therapy', 'lead', true),
  ('$CHILD5_ID', '$OT_ID',    'occupational_therapy', 'lead', true),
  ('$CHILD5_ID', '$SPEECH_ID', 'speech_therapy', 'support', true),
  ('$CHILD6_ID', '$OT_ID',    'occupational_therapy', 'lead', true)
ON CONFLICT (child_id, therapist_id, discipline_id) DO UPDATE SET is_active = true;
"
echo "  6 additional care-team rows"

# 27 speech sessions spread over 3 months across children 1-5
# (Aarav already has 1 speech session, total will be 28)
# Using a SQL generate_series to create sessions efficiently
run_sql "
INSERT INTO sessions (child_id, center_id, therapist_id, status, scheduled_date, started_at, ended_at, discipline_id, duration_minutes)
SELECT
  child_id, '$CENTER_ID', '$SPEECH_ID', 'completed',
  session_date, session_date::timestamp + interval '10 hours',
  session_date::timestamp + interval '10 hours' + (dur || ' minutes')::interval,
  'speech_therapy', dur
FROM (VALUES
  ('$CHILD2_ID'::uuid, CURRENT_DATE - 85, 45),
  ('$CHILD3_ID'::uuid, CURRENT_DATE - 82, 30),
  ('$CHILD2_ID'::uuid, CURRENT_DATE - 78, 45),
  ('$CHILD4_ID'::uuid, CURRENT_DATE - 75, 60),
  ('$CHILD_ID'::uuid,  CURRENT_DATE - 72, 45),
  ('$CHILD3_ID'::uuid, CURRENT_DATE - 68, 30),
  ('$CHILD2_ID'::uuid, CURRENT_DATE - 64, 45),
  ('$CHILD5_ID'::uuid, CURRENT_DATE - 61, 30),
  ('$CHILD4_ID'::uuid, CURRENT_DATE - 57, 60),
  ('$CHILD_ID'::uuid,  CURRENT_DATE - 54, 45),
  ('$CHILD2_ID'::uuid, CURRENT_DATE - 50, 45),
  ('$CHILD3_ID'::uuid, CURRENT_DATE - 47, 30),
  ('$CHILD4_ID'::uuid, CURRENT_DATE - 43, 60),
  ('$CHILD_ID'::uuid,  CURRENT_DATE - 40, 45),
  ('$CHILD5_ID'::uuid, CURRENT_DATE - 36, 30),
  ('$CHILD2_ID'::uuid, CURRENT_DATE - 33, 45),
  ('$CHILD3_ID'::uuid, CURRENT_DATE - 29, 30),
  ('$CHILD4_ID'::uuid, CURRENT_DATE - 26, 60),
  ('$CHILD_ID'::uuid,  CURRENT_DATE - 22, 45),
  ('$CHILD2_ID'::uuid, CURRENT_DATE - 19, 45),
  ('$CHILD3_ID'::uuid, CURRENT_DATE - 15, 30),
  ('$CHILD5_ID'::uuid, CURRENT_DATE - 12, 30),
  ('$CHILD4_ID'::uuid, CURRENT_DATE - 10, 60),
  ('$CHILD_ID'::uuid,  CURRENT_DATE - 8,  45),
  ('$CHILD2_ID'::uuid, CURRENT_DATE - 5,  45),
  ('$CHILD3_ID'::uuid, CURRENT_DATE - 4,  30),
  ('$CHILD4_ID'::uuid, CURRENT_DATE - 2,  60)
) AS v(child_id, session_date, dur);
"
echo "  27 additional speech sessions created"

# 8 OT sessions for Kabir and Diya
run_sql "
INSERT INTO sessions (child_id, center_id, therapist_id, status, scheduled_date, started_at, ended_at, discipline_id, duration_minutes)
SELECT
  child_id, '$CENTER_ID', '$OT_ID', 'completed',
  session_date, session_date::timestamp + interval '14 hours',
  session_date::timestamp + interval '14 hours' + (dur || ' minutes')::interval,
  'occupational_therapy', dur
FROM (VALUES
  ('$CHILD5_ID'::uuid, CURRENT_DATE - 80, 30),
  ('$CHILD6_ID'::uuid, CURRENT_DATE - 75, 45),
  ('$CHILD5_ID'::uuid, CURRENT_DATE - 60, 30),
  ('$CHILD6_ID'::uuid, CURRENT_DATE - 50, 45),
  ('$CHILD5_ID'::uuid, CURRENT_DATE - 35, 30),
  ('$CHILD6_ID'::uuid, CURRENT_DATE - 25, 45),
  ('$CHILD5_ID'::uuid, CURRENT_DATE - 14, 30),
  ('$CHILD6_ID'::uuid, CURRENT_DATE - 7,  45)
) AS v(child_id, session_date, dur);
"
echo "  8 OT sessions created"

# Moments for speech therapist — probes in speech sessions, then milestones/bests
# We need session IDs for the probes. Grab some from the recently inserted sessions.
S_MEERA=$(run_sql_id "SELECT id FROM sessions WHERE child_id='$CHILD2_ID' AND therapist_id='$SPEECH_ID' ORDER BY scheduled_date DESC LIMIT 1;")
S_ROHAN=$(run_sql_id "SELECT id FROM sessions WHERE child_id='$CHILD3_ID' AND therapist_id='$SPEECH_ID' ORDER BY scheduled_date DESC LIMIT 1;")
S_ANANYA=$(run_sql_id "SELECT id FROM sessions WHERE child_id='$CHILD4_ID' AND therapist_id='$SPEECH_ID' ORDER BY scheduled_date DESC LIMIT 1;")
S_KABIR_SP=$(run_sql_id "SELECT id FROM sessions WHERE child_id='$CHILD5_ID' AND therapist_id='$SPEECH_ID' ORDER BY scheduled_date DESC LIMIT 1;")

# Probes for moments (all in speech therapist's sessions)
P_MEERA_GAZE=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_MEERA', '$CHILD2_ID', 'looks_at_you', now()-interval '5 days', 'mediapipe', '{\"duration_ms\":12000}'::jsonb, 12000, true) RETURNING id;")
P_MEERA_RTN=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_MEERA', '$CHILD2_ID', 'response_to_name', now()-interval '19 days', 'mediapipe', '{\"latency_ms\":1900,\"orientation\":\"looked\"}'::jsonb, 1900, true) RETURNING id;")
P_ROHAN_STAY=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_ROHAN', '$CHILD3_ID', 'stays_activity', now()-interval '4 days', 'mediapipe', '{\"duration_ms\":45000}'::jsonb, 45000, true) RETURNING id;")
P_ROHAN_GAZE=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_ROHAN', '$CHILD3_ID', 'looks_at_you', now()-interval '15 days', 'mediapipe', '{\"duration_ms\":6000}'::jsonb, 6000, true) RETURNING id;")
P_ANANYA_RTN=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_ANANYA', '$CHILD4_ID', 'response_to_name', now()-interval '2 days', 'mediapipe', '{\"latency_ms\":2800,\"orientation\":\"looked\"}'::jsonb, 2800, true) RETURNING id;")
P_ANANYA_GAZE=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_ANANYA', '$CHILD4_ID', 'looks_at_you', now()-interval '10 days', 'mediapipe', '{\"duration_ms\":5000}'::jsonb, 5000, true) RETURNING id;")
P_KABIR_STAY=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_KABIR_SP', '$CHILD5_ID', 'stays_activity', now()-interval '12 days', 'mediapipe', '{\"duration_ms\":30000}'::jsonb, 30000, true) RETURNING id;")
echo "  7 additional probes for moments"

# Personal bests (6 more, total 8 with Aarav's 2)
run_sql "
INSERT INTO personal_bests (child_id, attribute_id, metric, value, achieved_at, probe_id) VALUES
  ('$CHILD2_ID', 'looks_at_you',    'longest_duration_ms', 12000, now()-interval '5 days',  '$P_MEERA_GAZE'),
  ('$CHILD2_ID', 'response_to_name','fastest_latency_ms',  1900,  now()-interval '19 days', '$P_MEERA_RTN'),
  ('$CHILD3_ID', 'stays_activity',  'longest_duration_ms', 45000, now()-interval '4 days',  '$P_ROHAN_STAY'),
  ('$CHILD3_ID', 'looks_at_you',    'longest_duration_ms', 6000,  now()-interval '15 days', '$P_ROHAN_GAZE'),
  ('$CHILD4_ID', 'looks_at_you',    'longest_duration_ms', 5000,  now()-interval '10 days', '$P_ANANYA_GAZE'),
  ('$CHILD5_ID', 'stays_activity',  'longest_duration_ms', 30000, now()-interval '12 days', '$P_KABIR_STAY');
"
echo "  6 additional personal_bests"

# Milestones (3 more, total 4 with Aarav's 1)
run_sql "
INSERT INTO milestones (child_id, attribute_id, milestone_key, achieved_at, probe_id) VALUES
  ('$CHILD4_ID', 'response_to_name', 'sub_3s_first', now()-interval '2 days',  '$P_ANANYA_RTN'),
  ('$CHILD2_ID', 'looks_at_you',     'first_orient',  now()-interval '19 days', '$P_MEERA_RTN'),
  ('$CHILD3_ID', 'looks_at_you',     'first_orient',  now()-interval '15 days', '$P_ROHAN_GAZE');
"
echo "  3 additional milestones"

# More session notes from speech therapist
run_sql "
INSERT INTO session_notes (session_id, child_id, author_id, discipline_id, body, scope) VALUES
  ('$S_MEERA',  '$CHILD2_ID', '$SPEECH_ID', 'speech_therapy', 'Meera making good progress with eye contact during bubble play.', 'session'),
  ('$S_ROHAN',  '$CHILD3_ID', '$SPEECH_ID', 'speech_therapy', 'Rohan stayed focused for the full 30 minutes today.', 'session'),
  ('$S_ANANYA', '$CHILD4_ID', '$SPEECH_ID', 'speech_therapy', 'Ananya responded to name call for the first time.', 'session'),
  ('$S_KABIR_SP','$CHILD5_ID','$SPEECH_ID', 'speech_therapy', 'Kabir needed more regulation support today.', 'session');
"
echo "  4 additional session notes"

# OT moments — 2 for Rahul OT
S_KABIR_OT=$(run_sql_id "SELECT id FROM sessions WHERE child_id='$CHILD5_ID' AND therapist_id='$OT_ID' ORDER BY scheduled_date DESC LIMIT 1;")
S_DIYA_OT=$(run_sql_id "SELECT id FROM sessions WHERE child_id='$CHILD6_ID' AND therapist_id='$OT_ID' ORDER BY scheduled_date DESC LIMIT 1;")
P_KABIR_OT=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_KABIR_OT', '$CHILD5_ID', 'stays_activity', now()-interval '14 days', 'mediapipe', '{\"duration_ms\":22000}'::jsonb, 22000, true) RETURNING id;")
P_DIYA_OT=$(run_sql_id "INSERT INTO probes (session_id, child_id, attribute_id, captured_at, method, raw, score, valid)
VALUES ('$S_DIYA_OT', '$CHILD6_ID', 'looks_at_you', now()-interval '7 days', 'mediapipe', '{\"duration_ms\":9000}'::jsonb, 9000, true) RETURNING id;")
run_sql "
INSERT INTO personal_bests (child_id, attribute_id, metric, value, achieved_at, probe_id) VALUES
  ('$CHILD6_ID', 'looks_at_you', 'longest_duration_ms', 9000, now()-interval '7 days', '$P_DIYA_OT')
ON CONFLICT (child_id, attribute_id, metric) DO NOTHING;
INSERT INTO milestones (child_id, attribute_id, milestone_key, achieved_at, probe_id) VALUES
  ('$CHILD5_ID', 'stays_activity', 'first_30s', now()-interval '14 days', '$P_KABIR_OT')
ON CONFLICT (child_id, attribute_id, milestone_key) DO NOTHING;
"
echo "  2 OT moments created"

echo ""
echo "=== LOGIN TABLE ==="
printf '%-26s %-12s %-18s %-24s %-24s\n' "Email" "Password" "Full Name" "Discipline" "Role"
printf '%-26s %-12s %-18s %-24s %-24s\n' "--------------------------" "------------" "------------------" "------------------------" "------------------------"
printf '%-26s %-12s %-18s %-24s %-24s\n' "owner@seedtest.local"    "$PASSWORD" "Center Owner"   "(none)"                 "center_owner"
printf '%-26s %-12s %-18s %-24s %-24s\n' "speech@seedtest.local"   "$PASSWORD" "Priya Speech"   "speech_therapy"         "therapist"
printf '%-26s %-12s %-18s %-24s %-24s\n' "ot@seedtest.local"       "$PASSWORD" "Rahul OT"       "occupational_therapy"   "therapist"
printf '%-26s %-12s %-18s %-24s %-24s\n' "unrelated@seedtest.local" "$PASSWORD" "Neha Behaviour" "behavioural_therapy"   "therapist"

echo ""
echo "=== ROW COUNTS ==="
run_sql "
SELECT
  (SELECT count(*) FROM centers        WHERE name = 'Seed Test Center')      AS centers,
  (SELECT count(*) FROM children       WHERE center_id = '$CENTER_ID')       AS children,
  (SELECT count(*) FROM sessions       WHERE center_id = '$CENTER_ID')       AS sessions,
  (SELECT count(*) FROM sessions       WHERE center_id = '$CENTER_ID' AND therapist_id = '$SPEECH_ID') AS speech_sessions,
  (SELECT count(*) FROM sessions       WHERE center_id = '$CENTER_ID' AND therapist_id = '$OT_ID')     AS ot_sessions,
  (SELECT count(*) FROM probes         WHERE child_id IN (SELECT id FROM children WHERE center_id = '$CENTER_ID')) AS probes,
  (SELECT count(*) FROM milestones     WHERE child_id IN (SELECT id FROM children WHERE center_id = '$CENTER_ID')) AS milestones,
  (SELECT count(*) FROM personal_bests WHERE child_id IN (SELECT id FROM children WHERE center_id = '$CENTER_ID')) AS personal_bests,
  (SELECT count(*) FROM session_notes  WHERE child_id IN (SELECT id FROM children WHERE center_id = '$CENTER_ID')) AS notes;
"

echo ""
echo "Done. Run this script again to verify idempotency."
