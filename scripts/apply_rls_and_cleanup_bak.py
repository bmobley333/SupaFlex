import os
import sys
import json
import psycopg2

# Ensure UTF-8 output on Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, "..", "env.json")
    migration_path = os.path.join(base_dir, "..", "supabase", "migrations", "20260806000000_enable_rls_catalogs_and_drop_bak.sql")

    with open(env_path, "r", encoding="utf-8") as f:
        env_data = json.load(f)

    db_conn_str = env_data.get("SUPABASE_DB_CONNECTION_STRING")
    if not db_conn_str:
        print("[Error] SUPABASE_DB_CONNECTION_STRING not found in env.json", file=sys.stderr)
        sys.exit(1)

    with open(migration_path, "r", encoding="utf-8") as f:
        sql_script = f.read()

    print("[RLS Hardening] Connecting to Supabase PostgreSQL database...")
    conn = psycopg2.connect(db_conn_str)
    conn.autocommit = True
    cursor = conn.cursor()

    print("[RLS Hardening] Executing migration SQL DDL...")
    cursor.execute(sql_script)
    print("[RLS Hardening] DDL execution completed successfully.")

    # Verification Query: Check table RLS status across public schema
    print("\n[Verification] Fetching current RLS status for all public tables:")
    verify_sql = """
        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname ASC;
    """
    cursor.execute(verify_sql)
    rows = cursor.fetchall()

    print("-" * 55)
    print(f"{'Table Name':<30} | {'RLS Enabled':<15}")
    print("-" * 55)
    all_enabled = True
    for table_name, rls_enabled in rows:
        status_str = "🌐 YES (Protected)" if rls_enabled else "🔴 NO (UNRESTRICTED)"
        print(f"{table_name:<30} | {status_str:<15}")
        if not rls_enabled:
            all_enabled = False
    print("-" * 55)

    if all_enabled:
        print("\n✅ SUCCESS: 100% of public tables have Row Level Security ENABLED!")
    else:
        print("\n⚠️ WARNING: One or more tables still have RLS disabled.", file=sys.stderr)

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()
