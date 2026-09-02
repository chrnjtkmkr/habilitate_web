#!/usr/bin/env python3
"""Apply SQL migration files in order via psycopg2."""

import glob
import os
import sys

import psycopg2


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required")
        sys.exit(1)

    migrations_dir = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")
    files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))

    if not files:
        print("No migration files found")
        sys.exit(1)

    print(f"Found {len(files)} migration files")

    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()

    for f in files:
        name = os.path.basename(f)
        print(f"Applying {name} ... ", end="", flush=True)
        with open(f) as sql_file:
            sql = sql_file.read()
        try:
            cur.execute(sql)
            print("OK")
        except Exception as e:
            print(f"FAILED\n  Error: {e}")
            cur.close()
            conn.close()
            sys.exit(1)

    cur.close()
    conn.close()
    print(f"\nAll {len(files)} migrations applied successfully.")


if __name__ == "__main__":
    main()
