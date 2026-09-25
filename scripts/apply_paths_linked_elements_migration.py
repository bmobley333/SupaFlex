# scripts/apply_paths_linked_elements_migration.py
# Applies migration to add linked_elements JSONB to public.paths

import os
import sys
import json
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def main():
    env_path = r'C:\Repos\Jodar\env.json'
    if not os.path.exists(env_path):
        print(f"[Error] env.json not found at {env_path}")
        sys.exit(1)

    with open(env_path, 'r', encoding='utf-8') as f:
        env = json.load(f)

    cfg = {
        'host': env.get('SUPAFLEX_DEV_DB_HOST', 'aws-0-us-west-2.pooler.supabase.com'),
        'port': int(env.get('SUPAFLEX_DEV_DB_PORT', 6543)),
        'user': f"postgres.{env.get('SUPAFLEX_DEV_PROJECT_REF', 'zipebnjazayhfjstykwl')}",
        'password': env.get('SUPAFLEX_DEV_DB_PASSWORD') or env.get('SUPABASE_DB_PASSWORD') or '',
        'database': 'postgres',
        'connect_timeout': 15
    }

    print("Connecting to Supabase PostgreSQL...")
    conn = psycopg2.connect(**cfg)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("Executing migration 20260924010000_add_paths_linked_elements.sql...")
        cur.execute("""
            ALTER TABLE public.paths 
            ADD COLUMN IF NOT EXISTS linked_elements JSONB DEFAULT '[]'::JSONB;
        """)
        print("  ✓ Column linked_elements created/verified on public.paths.")

        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_paths_linked_elements 
            ON public.paths USING gin(linked_elements);
        """)
        print("  ✓ GIN index idx_paths_linked_elements created/verified on public.paths.")

        conn.commit()
        print("  ✓ Transaction committed successfully.")

        # Verification query
        cur.execute("""
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_schema='public' AND table_name='paths' AND column_name='linked_elements';
        """)
        row = cur.fetchone()
        print(f"Verified column: {row}")

    except Exception as e:
        conn.rollback()
        print(f"[Error] Migration failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
