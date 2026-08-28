# C:\Repos\Projects\SupaFlex\scripts\migrate_phase1_mso_taxonomy.py
# Standardized database migration: Phase 1 MSO Taxonomy & Quick Deck Schema Expansion

import os
import sys
import json
import psycopg2

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def run_migration():
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
        print("✅ Database connection established successfully.\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    print("════════════════════════════════════════════════════════════════")
    print("🚀 EXECUTING PHASE 1: MSO TAXONOMY & QUICK DECK SCHEMA EXPANSION")
    print("════════════════════════════════════════════════════════════════")

    migrations = [
        # 1. powers table
        ("powers", """
            ALTER TABLE public.powers 
                ADD COLUMN IF NOT EXISTS "table" text NOT NULL DEFAULT 'General',
                ADD COLUMN IF NOT EXISTS usage_type text NOT NULL DEFAULT 'Active',
                ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'General',
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Universal',
                ADD COLUMN IF NOT EXISTS is_handicap boolean NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS flaw_points integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS stat_hook jsonb DEFAULT NULL;
            CREATE INDEX IF NOT EXISTS idx_powers_table_lookup ON public.powers ("table", usage_type, is_handicap);
            CREATE INDEX IF NOT EXISTS idx_powers_discipline ON public.powers (discipline);
        """),

        # 2. power_tables
        ("power_tables", """
            ALTER TABLE public.power_tables
                ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General',
                ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS genres text[] DEFAULT ARRAY['Medieval']::text[],
                ADD COLUMN IF NOT EXISTS is_guildspace_locked boolean NOT NULL DEFAULT false;
            CREATE INDEX IF NOT EXISTS idx_power_tables_cat ON public.power_tables (category, name);
        """),

        # 3. hardware table
        ("hardware", """
            ALTER TABLE public.hardware 
                ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'Minor',
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Tech',
                ADD COLUMN IF NOT EXISTS compatible_with text NOT NULL DEFAULT 'universal',
                ADD COLUMN IF NOT EXISTS table_group text NOT NULL DEFAULT 'Tech Hardware',
                ADD COLUMN IF NOT EXISTS is_guildspace_locked boolean NOT NULL DEFAULT false;
            CREATE INDEX IF NOT EXISTS idx_hardware_table_tier ON public.hardware (table_group, tier, discipline);
        """),

        # 4. relics table
        ("relics", """
            ALTER TABLE public.relics 
                ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'Minor',
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Sorce',
                ADD COLUMN IF NOT EXISTS table_group text NOT NULL DEFAULT 'Sorce Relics',
                ADD COLUMN IF NOT EXISTS is_guildspace_locked boolean NOT NULL DEFAULT false;
            CREATE INDEX IF NOT EXISTS idx_relics_table_tier ON public.relics (table_group, tier, discipline);
        """),

        # 5. weapons table
        ("weapons", """
            ALTER TABLE public.weapons 
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Archaic',
                ADD COLUMN IF NOT EXISTS table_group text DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS compatible_with text DEFAULT NULL;
            CREATE INDEX IF NOT EXISTS idx_weapons_table_group ON public.weapons (table_group, discipline);
        """),

        # 6. armor table
        ("armor", """
            ALTER TABLE public.armor 
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Archaic',
                ADD COLUMN IF NOT EXISTS table_group text DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS compatible_with text DEFAULT NULL;
            CREATE INDEX IF NOT EXISTS idx_armor_table_group ON public.armor (table_group, discipline);
        """),

        # 7. shields table
        ("shields", """
            ALTER TABLE public.shields 
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Archaic',
                ADD COLUMN IF NOT EXISTS table_group text DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS compatible_with text DEFAULT NULL;
            CREATE INDEX IF NOT EXISTS idx_shields_discipline ON public.shields (discipline);
        """),

        # 8. gear table
        ("gear", """
            ALTER TABLE public.gear 
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'Tech',
                ADD COLUMN IF NOT EXISTS table_group text DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS compatible_with text DEFAULT NULL;
            CREATE INDEX IF NOT EXISTS idx_gear_table_group ON public.gear (table_group, discipline);
        """),

        # 9. skillsets table
        ("skillsets", """
            ALTER TABLE public.skillsets 
                ADD COLUMN IF NOT EXISTS discipline text NOT NULL DEFAULT 'General',
                ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';
            CREATE INDEX IF NOT EXISTS idx_skillsets_category ON public.skillsets (category, discipline);
        """)
    ]

    results = []

    for table_name, ddl in migrations:
        try:
            print(f"Applying migration to public.{table_name}...")
            cur.execute(ddl)
            conn.commit()

            # Verify row count
            cur.execute(f"SELECT count(*) FROM public.{table_name};")
            count = cur.fetchone()[0]
            print(f"  ✅ public.{table_name:<14} migrated successfully. (Rows: {count})")
            results.append((table_name, "SUCCESS", count))
        except Exception as e:
            conn.rollback()
            print(f"  ❌ Error migrating public.{table_name}: {e}")
            results.append((table_name, f"ERROR: {e}", 0))

    cur.close()
    conn.close()

    print("\n════════════════════════════════════════════════════════════════")
    print("📊 PHASE 1 DDL MIGRATION SUMMARY")
    print("════════════════════════════════════════════════════════════════")
    for tbl, status, count in results:
        print(f" • {tbl:<15}: {status:<20} (Total Rows: {count})")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    run_migration()
