# scripts/apply_sets_schema_migration.py
# Executes the 20260924000000_create_sets_architecture.sql migration against Supabase PostgreSQL

import json
import os
import sys
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def main():
    with open(r'C:\Repos\Jodar\env.json', 'r', encoding='utf-8') as f:
        env = json.load(f)

    cfg = {
        'host': env.get('SUPAFLEX_DEV_DB_HOST', 'aws-0-us-west-2.pooler.supabase.com'),
        'port': int(env.get('SUPAFLEX_DEV_DB_PORT', 6543)),
        'user': f"postgres.{env.get('SUPAFLEX_DEV_PROJECT_REF', 'zipebnjazayhfjstykwl')}",
        'password': env.get('SUPAFLEX_DEV_DB_PASSWORD') or env.get('SUPABASE_DB_PASSWORD') or '',
        'database': 'postgres',
        'connect_timeout': 15
    }

    migration_path = r'C:\Repos\Projects\SupaFlex\supabase\migrations\20260924000000_create_sets_architecture.sql'
    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print("Connecting to Supabase PostgreSQL database...")
    conn = psycopg2.connect(**cfg)
    conn.autocommit = True
    cur = conn.cursor()

    print("Executing Sets architecture migration...")
    cur.execute(sql)
    print("Migration SQL executed successfully!")

    print("Reloading PostgREST schema cache...")
    try:
        cur.execute("NOTIFY pgrst, 'reload schema';")
        print("Schema reload notification sent.")
    except Exception as e:
        print(f"Schema reload notice: {e}")

    # Verify columns and table
    print("\nVerifying public.sets table:")
    cur.execute("""
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sets'
        ORDER BY ordinal_position;
    """)
    for r in cur.fetchall():
        print(f"  - sets.{r[0]}: {r[1]} ({r[2]})")

    print("\nVerifying 'sets' column in target tables:")
    for tbl in ['skills', 'traits', 'powers', 'weapons', 'armor', 'shields']:
        cur.execute(f"""
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '{tbl}' AND column_name = 'sets';
        """)
        row = cur.fetchone()
        if row:
            print(f"  ✓ {tbl}.sets exists: {row[1]} ({row[2]})")
        else:
            print(f"  ✗ {tbl}.sets MISSING!")

    cur.close()
    conn.close()
    print("\nPhase 1 Schema Migration Complete!")

if __name__ == "__main__":
    main()
