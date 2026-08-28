# C:\Repos\Projects\SupaFlex\scripts\migrate_rename_table_group_and_drop_power_tables.py
# DDL Migration: Rename powers.table to powers.table_group and drop public.power_tables

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
    if not os.path.exists(env_path):
        print(f"❌ Error: {env_path} not found.")
        sys.exit(1)

    with open(env_path, "r", encoding="utf-8") as f:
        env = json.load(f)

    host = env.get("SUPABASE_DB_HOST", "aws-0-us-west-2.pooler.supabase.com")
    port = env.get("SUPABASE_DB_PORT", 6543)
    user = f"postgres.{env.get('SUPABASE_CLI_PROJECT_REF')}"
    password = env.get("SUPABASE_DB_PASSWORD")
    dbname = "postgres"

    print("🔌 Connecting to SupaFlex PostgreSQL database...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=15
        )
        conn.autocommit = False
        cur = conn.cursor()
        print("✅ Database connection established.\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    print("════════════════════════════════════════════════════════════════")
    print("🚀 UNIFYING TABLE_GROUP & DROPPING DEPRECATED POWER_TABLES")
    print("════════════════════════════════════════════════════════════════")

    try:
        # 1. Check if "table" column exists on public.powers
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'powers' AND column_name = 'table';
        """)
        has_table_col = cur.fetchone() is not None

        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'powers' AND column_name = 'table_group';
        """)
        has_table_group_col = cur.fetchone() is not None

        if has_table_col and not has_table_group_col:
            print("Renaming public.powers.\"table\" ➔ public.powers.table_group...")
            cur.execute('ALTER TABLE public.powers RENAME COLUMN "table" TO table_group;')
            print("  ✅ Column renamed to table_group.")
        elif has_table_group_col:
            print("  ℹ️ public.powers.table_group already exists.")
            if has_table_col:
                print("  Merging 'table' data into 'table_group' and dropping 'table'...")
                cur.execute('UPDATE public.powers SET table_group = "table" WHERE table_group IS NULL OR table_group = \'General\';')
                cur.execute('ALTER TABLE public.powers DROP COLUMN IF EXISTS "table";')
        else:
            print("Adding public.powers.table_group column...")
            cur.execute("ALTER TABLE public.powers ADD COLUMN IF NOT EXISTS table_group text NOT NULL DEFAULT 'General';")

        # 2. Update Index on powers
        print("Updating compound index on public.powers...")
        cur.execute("DROP INDEX IF EXISTS public.idx_powers_table_lookup;")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_powers_table_group_lookup ON public.powers (table_group, usage_type, is_handicap);")
        print("  ✅ Index idx_powers_table_group_lookup active.")

        # 3. Drop public.power_tables table
        print("Dropping deprecated public.power_tables table...")
        cur.execute("DROP TABLE IF EXISTS public.power_tables CASCADE;")
        print("  ✅ public.power_tables dropped.")

        conn.commit()
        print("\n🎉 Migration successfully committed!")

        # Verify powers row count and table_group sample
        cur.execute("SELECT count(*), count(table_group) FROM public.powers;")
        total_rows, non_null_groups = cur.fetchone()
        print(f"📊 Verified public.powers: {total_rows} total rows, {non_null_groups} populated table_group values.")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error during migration: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
