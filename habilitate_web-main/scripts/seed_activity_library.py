#!/usr/bin/env python3
"""Seed the activities table from activity_library.json."""

import json
import os
import sys

import psycopg2
from psycopg2.extras import execute_batch

def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: seed_activity_library.py <path-to-activity_library.json>")
        sys.exit(1)

    path = sys.argv[1]
    with open(path) as f:
        data = json.load(f)

    source_version = data["version"]
    activities = data["activities"]
    print(f"Loaded {len(activities)} activities (version {source_version})")

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    sql = """
        INSERT INTO activities (
            id, name, framework_source, framework_citation,
            developmental_domain, diagnostic_profile_applicability,
            skill_level, target_age_min_months, target_age_max_months,
            duration_minutes, materials_required, prompting_hierarchy,
            mastery_criteria, therapist_steps, parent_explanation,
            validation_status, source_version
        ) VALUES (
            %(id)s, %(name)s, %(framework_source)s, %(framework_citation)s,
            %(developmental_domain)s, %(diagnostic_profile_applicability)s::diagnostic_profile[],
            %(skill_level)s, %(target_age_min_months)s, %(target_age_max_months)s,
            %(duration_minutes)s, %(materials_required)s, %(prompting_hierarchy)s,
            %(mastery_criteria)s, %(therapist_steps)s, %(parent_explanation)s,
            %(validation_status)s, %(source_version)s
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            framework_source = EXCLUDED.framework_source,
            framework_citation = EXCLUDED.framework_citation,
            developmental_domain = EXCLUDED.developmental_domain,
            diagnostic_profile_applicability = EXCLUDED.diagnostic_profile_applicability,
            skill_level = EXCLUDED.skill_level,
            target_age_min_months = EXCLUDED.target_age_min_months,
            target_age_max_months = EXCLUDED.target_age_max_months,
            duration_minutes = EXCLUDED.duration_minutes,
            materials_required = EXCLUDED.materials_required,
            prompting_hierarchy = EXCLUDED.prompting_hierarchy,
            mastery_criteria = EXCLUDED.mastery_criteria,
            therapist_steps = EXCLUDED.therapist_steps,
            parent_explanation = EXCLUDED.parent_explanation,
            -- preserve validated status: only overwrite if not already validated
            validation_status = CASE
                WHEN activities.validation_status = 'validated'
                THEN activities.validation_status
                ELSE EXCLUDED.validation_status
            END,
            source_version = EXCLUDED.source_version,
            updated_at = now()
    """

    rows = []
    for act in activities:
        rows.append({
            "id": act["id"],
            "name": act["name"],
            "framework_source": act["framework_source"],
            "framework_citation": act["framework_citation"],
            "developmental_domain": act["developmental_domain"],
            "diagnostic_profile_applicability": act["diagnostic_profile_applicability"],
            "skill_level": act["skill_level"],
            "target_age_min_months": act["target_age_range_months"]["min"],
            "target_age_max_months": act["target_age_range_months"]["max"],
            "duration_minutes": act["duration_minutes"],
            "materials_required": json.dumps(act["materials_required"]),
            "prompting_hierarchy": json.dumps(act["prompting_hierarchy"]),
            "mastery_criteria": act["mastery_criteria"],
            "therapist_steps": json.dumps(act["therapist_steps"]),
            "parent_explanation": json.dumps(act["parent_explanation"]),
            "validation_status": act["validation_status"],
            "source_version": source_version,
        })

    execute_batch(cur, sql, rows, page_size=50)
    conn.commit()

    cur.execute("SELECT count(*) FROM activities")
    count = cur.fetchone()[0]
    print(f"Upserted {len(rows)} activities. Total in table: {count}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
