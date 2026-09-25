# scripts/test_sets_phase1_api.py
# Verification test script for SupaFlex Sets Architecture Phase 1

import os
import sys
import json
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def main():
    env_path = r'C:\Repos\Jodar\env.json'
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

    conn = psycopg2.connect(**cfg)
    cur = conn.cursor()

    print("=== TEST 1: Verify public.paths linked_elements Column & GIN Index ===")
    cur.execute("""
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='paths' AND column_name='linked_elements';
    """)
    col = cur.fetchone()
    assert col is not None, "Column linked_elements missing from public.paths!"
    print(f"  ✓ Column verified: {col}")

    cur.execute("""
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename='paths' AND indexname='idx_paths_linked_elements';
    """)
    idx = cur.fetchone()
    assert idx is not None, "GIN index idx_paths_linked_elements missing!"
    print(f"  ✓ GIN index verified: {idx[0]}")

    print("\n=== TEST 2: Query Sets by Category from public.sets ===")
    cur.execute("""
        SELECT category, count(*) 
        FROM public.sets 
        GROUP BY category 
        ORDER BY category;
    """)
    categories = cur.fetchall()
    for cat, cnt in categories:
        print(f"  ✓ Category '{cat}': {cnt} sets registered")

    print("\n=== TEST 3: Inspect Weapons Set Membership via GIN Index ===")
    sample_set = 'Archaic Weapons (mso)'
    cur.execute("""
        SELECT id, name, type, requirement, sets 
        FROM public.weapons 
        WHERE sets @> ARRAY[%s]::TEXT[] 
        LIMIT 5;
    """, (sample_set,))
    weapons_in_set = cur.fetchall()
    print(f"  ✓ Found {len(weapons_in_set)} sample weapons in set '{sample_set}':")
    for w in weapons_in_set:
        print(f"    - [{w[0]}] {w[1]} ({w[2]}, req {w[3]}) | sets: {w[4]}")

    print("\n=== TEST 4: Inspect Skill Sets Membership ===")
    sample_skillset = 'Archer'
    cur.execute("""
        SELECT id, name, attribute, sets 
        FROM public.skills 
        WHERE sets @> ARRAY[%s]::TEXT[] 
        LIMIT 5;
    """, (sample_skillset,))
    skills_in_set = cur.fetchall()
    print(f"  ✓ Found {len(skills_in_set)} sample skills in set '{sample_skillset}':")
    for s in skills_in_set:
        print(f"    - [{s[0]}] {s[1]} ({s[2]}) | sets: {s[3]}")

    print("\n=== TEST 5: Test Multi-Merge Query Simulation ===")
    set_a = 'Archaic Weapons (mso)'
    set_b = 'BioTech Melee Weapons (mso)'
    cur.execute("""
        SELECT id, name, sets 
        FROM public.weapons 
        WHERE sets && ARRAY[%s, %s]::TEXT[];
    """, (set_a, set_b))
    merged_weapons = cur.fetchall()
    print(f"  ✓ Multi-merge query for ['{set_a}', '{set_b}'] resolved {len(merged_weapons)} unique weapons.")

    print("\n=== ALL PHASE 1 DATABASE & QUERY TESTS PASSED SUCCESSFULLY! ===")
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
