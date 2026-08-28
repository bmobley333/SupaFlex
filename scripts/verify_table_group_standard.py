# C:\Repos\Projects\SupaFlex\scripts\verify_table_group_standard.py
# Verification test: Table_Group Standardization & Power_Tables Removal

import os
import sys
import json
import psycopg2

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def main():
    env_path = r"C:\Repos\Projects\SupaFlex\env.json"
    with open(env_path, "r", encoding="utf-8") as f:
        env = json.load(f)

    host = env.get("SUPABASE_DB_HOST", "aws-0-us-west-2.pooler.supabase.com")
    port = env.get("SUPABASE_DB_PORT", 6543)
    user = f"postgres.{env.get('SUPABASE_CLI_PROJECT_REF')}"
    password = env.get("SUPABASE_DB_PASSWORD")
    dbname = "postgres"

    print("🔌 Connecting to SupaFlex PostgreSQL database for verification...")
    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
        connect_timeout=15
    )
    cur = conn.cursor()

    catalog_tables = ["powers", "hardware", "relics", "weapons", "armor", "shields", "gear", "skillsets"]
    all_passed = True

    print("════════════════════════════════════════════════════════════════")
    print("🔎 VERIFYING TABLE_GROUP UNIFICATION & ZERO 'TABLE' COLUMNS")
    print("════════════════════════════════════════════════════════════════")

    # 1. Check all 8 catalog tables have table_group
    for table in catalog_tables:
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = %s AND column_name = 'table_group';
        """, (table,))
        has_table_group = cur.fetchone() is not None

        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = %s AND column_name = 'table';
        """, (table,))
        has_old_table = cur.fetchone() is not None

        if not has_table_group:
            all_passed = False
            print(f"❌ public.{table:<14} | MISSING 'table_group' column!")
        elif has_old_table:
            all_passed = False
            print(f"❌ public.{table:<14} | Still contains obsolete 'table' column!")
        else:
            cur.execute(f"SELECT count(*) FROM public.{table};")
            cnt = cur.fetchone()[0]
            print(f"✅ public.{table:<14} | 'table_group' verified (0 'table' collisions) | Rows: {cnt}")

    # 2. Check power_tables is dropped
    cur.execute("""
        SELECT count(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'power_tables';
    """)
    power_tables_count = cur.fetchone()[0]
    if power_tables_count == 0:
        print("✅ public.power_tables | Successfully dropped (zero redundant tables).")
    else:
        all_passed = False
        print("❌ public.power_tables | Still exists in database!")

    # 3. Check compound index on powers
    cur.execute("""
        SELECT count(*) FROM pg_indexes 
        WHERE schemaname = 'public' AND indexname = 'idx_powers_table_group_lookup';
    """)
    if cur.fetchone()[0] > 0:
        print("✅ Index 'idx_powers_table_group_lookup' verified active.")
    else:
        all_passed = False
        print("❌ Index 'idx_powers_table_group_lookup' missing!")

    cur.close()
    conn.close()

    print("\n════════════════════════════════════════════════════════════════")
    if all_passed:
        print("🎉 ALL TABLE_GROUP UNIFICATION CHECKS PASSED 100%!")
    else:
        print("❌ SOME CHECKS FAILED!")
        sys.exit(1)
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
