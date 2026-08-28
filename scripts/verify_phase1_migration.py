# C:\Repos\Projects\SupaFlex\scripts\verify_phase1_migration.py
# Automated Schema Verification for Phase 1 MSO Taxonomy & Quick Deck Expansion

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

    required_columns = {
        "powers": ["table", "usage_type", "source", "discipline", "is_handicap", "flaw_points", "stat_hook"],
        "power_tables": ["category", "name", "genres", "is_guildspace_locked"],
        "hardware": ["tier", "discipline", "compatible_with", "table_group", "is_guildspace_locked"],
        "relics": ["tier", "discipline", "table_group", "is_guildspace_locked"],
        "weapons": ["discipline", "table_group", "compatible_with"],
        "armor": ["discipline", "table_group", "compatible_with"],
        "shields": ["discipline", "table_group", "compatible_with"],
        "gear": ["discipline", "table_group", "compatible_with"],
        "skillsets": ["discipline", "category"]
    }

    all_passed = True

    print("════════════════════════════════════════════════════════════════")
    print("🔎 VERIFYING PHASE 1 MSO TAXONOMY SCHEMA EXPANSION")
    print("════════════════════════════════════════════════════════════════")

    for table, cols in required_columns.items():
        cur.execute("""
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s;
        """, (table,))
        existing = {r[0]: {"type": r[1], "default": r[2], "nullable": r[3]} for r in cur.fetchall()}

        missing = [c for c in cols if c not in existing]
        cur.execute(f"SELECT count(*) FROM public.{table};")
        row_count = cur.fetchone()[0]

        if missing:
            all_passed = False
            print(f"❌ public.{table:<14} | MISSING COLUMNS: {missing}")
        else:
            print(f"✅ public.{table:<14} | All {len(cols)} required columns verified | Rows: {row_count}")

    # Check indexes
    indexes_to_check = [
        "idx_powers_table_lookup",
        "idx_powers_discipline",
        "idx_power_tables_cat",
        "idx_hardware_table_tier",
        "idx_relics_table_tier",
        "idx_weapons_table_group",
        "idx_armor_table_group",
        "idx_shields_discipline",
        "idx_gear_table_group",
        "idx_skillsets_category"
    ]

    print("\n🔎 Verifying Compound Performance Indexes...")
    for idx in indexes_to_check:
        cur.execute("""
            SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = %s;
        """, (idx,))
        found = cur.fetchone()[0] > 0
        if found:
            print(f"  ✅ Index '{idx}' exists.")
        else:
            all_passed = False
            print(f"  ❌ Index '{idx}' is missing!")

    cur.close()
    conn.close()

    print("\n════════════════════════════════════════════════════════════════")
    if all_passed:
        print("🎉 ALL PHASE 1 SCHEMA VERIFICATIONS PASSED 100%!")
    else:
        print("❌ SOME SCHEMA CHECKS FAILED!")
        sys.exit(1)
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
