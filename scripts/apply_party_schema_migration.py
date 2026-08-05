# scripts/apply_party_schema_migration.py
# Connects to Supabase PostgreSQL DB and executes DDL migration for Party Blueprint v2.5

import json
import os
import sys
import psycopg2

def main():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "env.json")
    if not os.path.exists(env_path):
        print(f"Error: {env_path} not found.")
        sys.exit(1)

    with open(env_path, "r", encoding="utf-8") as f:
        env_data = json.load(f)

    conn_str = env_data.get("SUPABASE_DB_CONNECTION_STRING")
    if not conn_str:
        print("Error: SUPABASE_DB_CONNECTION_STRING not found in env.json.")
        sys.exit(1)

    print(f"Connecting to Supabase PostgreSQL database...")
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cursor = conn.cursor()

    migration_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations", "20260805000000_party_blueprint_v2_5.sql")
    with open(migration_file, "r", encoding="utf-8") as f:
        sql = f.read()

    # Add extra ALTER TABLE statements for seamless backwards compatibility
    ddl_statements = [
        "ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS party_code text;",
        "ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS gm_email text;",
        "ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';",
        "UPDATE public.parties SET party_code = room_code WHERE party_code IS NULL AND room_code IS NOT NULL;",
        "UPDATE public.parties SET status = 'active' WHERE status IS NULL;",
        "ALTER TABLE public.party_session_members ADD COLUMN IF NOT EXISTS party_uuid uuid;",
        "ALTER TABLE public.party_session_members ADD COLUMN IF NOT EXISTS party_code text;",
        "ALTER TABLE public.party_session_members ADD COLUMN IF NOT EXISTS party_id uuid;",
        "UPDATE public.party_session_members SET party_uuid = party_id WHERE party_uuid IS NULL AND party_id IS NOT NULL;",
        "UPDATE public.party_session_members SET party_id = party_uuid WHERE party_id IS NULL AND party_uuid IS NOT NULL;",
    ]

    print("Executing compatibility DDL statements...")
    for stmt in ddl_statements:
        try:
            cursor.execute(stmt)
            print(f"  [OK] {stmt[:60]}...")
        except Exception as e:
            print(f"  [Notice] {stmt[:40]}... -> {e}")

    print("Executing full migration SQL...")
    try:
        cursor.execute(sql)
        print("[SUCCESS] Migration SQL executed successfully!")
    except Exception as e:
        print(f"[Error] Failed to execute migration SQL: {e}")
        sys.exit(1)

    print("Notifying PostgREST to reload schema cache...")
    try:
        cursor.execute("NOTIFY pgrst, 'reload schema';")
        print("[SUCCESS] PostgREST schema cache reloaded!")
    except Exception as e:
        print(f"[Warning] PostgREST reload notify notice: {e}")

    cursor.close()
    conn.close()
    print("All Supabase database migration steps completed successfully!")

if __name__ == "__main__":
    main()
