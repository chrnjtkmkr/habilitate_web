#!/usr/bin/env python3
"""Seed the intake_instruments table from intake_assessment.json."""

import json
import os
import sys

import psycopg2


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: seed_intake_instrument.py <path-to-intake_assessment.json>")
        sys.exit(1)

    path = sys.argv[1]
    with open(path) as f:
        data = json.load(f)

    version = data["version"]
    print(f"Loading intake instrument version {version}")

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    # Upsert the instrument by version
    cur.execute("""
        INSERT INTO intake_instruments (version, payload, is_active)
        VALUES (%s, %s, true)
        ON CONFLICT (version) DO UPDATE SET
            payload = EXCLUDED.payload,
            is_active = true,
            updated_at = now()
        RETURNING id
    """, (version, json.dumps(data)))

    instrument_id = cur.fetchone()[0]

    # Deactivate all other instruments
    cur.execute("""
        UPDATE intake_instruments
        SET is_active = false, updated_at = now()
        WHERE id != %s
    """, (instrument_id,))

    conn.commit()

    print(f"Active instrument id: {instrument_id}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
