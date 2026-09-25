# scripts/backfill_paths_linked_elements.py
# Deterministically backfills public.paths.linked_elements JSONB arrays
# from existing database records across sets, powers, skills, traits, weapons, armor, and shields.

import os
import sys
import json
import re
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def clean_path_name(val):
    if not val:
        return ""
    v = str(val).strip()
    for tag in ['{Free}', '{free}', '{Free1}', '{free1}', '{Trait}', '{trait}', '{Innate}', '{innate}']:
        v = v.replace(tag, '')
    return v.strip()

def normalize_for_comparison(path_str):
    if not path_str:
        return ""
    s = re.sub(r'\{[^}]+\}', '', str(path_str))
    s = re.sub(r'^[\["\'\s]+|[\]"\'\s]+$', '', s)
    s = s.lower().replace('-', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def is_path_match(entry_str, target_path_str):
    norm_a = normalize_for_comparison(entry_str)
    norm_b = normalize_for_comparison(target_path_str)
    if not norm_a or not norm_b:
        return False
    return norm_a == norm_b

def parse_path_entries(raw):
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(p) for p in raw if p]
    s = str(raw).strip()
    if s.startswith('[') and s.endswith(']'):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(p) for p in parsed if p]
        except Exception:
            pass
    return [p.strip() for p in re.split(r'[,;]', s) if p.strip()]

def get_match_tag(raw, target_path):
    entries = parse_path_entries(raw)
    for entry in entries:
        if is_path_match(entry, target_path):
            is_free = bool(re.search(r'\{(?:free|free\d+|trait|innate)\}', entry, re.IGNORECASE))
            return True, ('Free' if is_free else '1 AP')
    return False, '1 AP'

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
        # 1. Fetch all paths
        cur.execute("SELECT id, name, category, linked_elements FROM public.paths ORDER BY name;")
        all_paths = cur.fetchall()
        print(f"Found {len(all_paths)} total paths in public.paths.")

        # 2. Fetch catalog tables
        def get_all_rows(table_name):
            cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table_name}';")
            cols = [c[0] for c in cur.fetchall()]
            cur.execute(f"SELECT {', '.join(cols)} FROM public.{table_name};")
            rows = cur.fetchall()
            return [dict(zip(cols, r)) for r in rows]

        print("Loading catalog tables into memory...")
        sets = get_all_rows('sets')
        powers = get_all_rows('powers')
        skills = get_all_rows('skills')
        traits = get_all_rows('traits')
        weapons = get_all_rows('weapons')
        armor = get_all_rows('armor')
        shields = get_all_rows('shields')

        print(f"  ✓ Loaded {len(sets)} sets, {len(powers)} powers, {len(skills)} skills, {len(traits)} traits, {len(weapons)} weapons, {len(armor)} armor, {len(shields)} shields.")

        updated_count = 0
        total_elements_linked = 0

        for pid, pname, pcat, existing_linked in all_paths:
            path_name = pname.strip()
            elements = []
            seen_ids = set()

            # A. Sets
            for s in sets:
                matched, tag = get_match_tag(s.get('paths'), path_name)
                if matched:
                    el_id = f"set_{s['id']}"
                    if el_id not in seen_ids:
                        seen_ids.add(el_id)
                        elements.append({
                            'id': s['id'],
                            'name': s['name'],
                            'type': 'set',
                            'element_type': 'set',
                            'tag': tag,
                            'isFree': tag == 'Free',
                            'is_free': tag == 'Free',
                            'details': s.get('category') or 'Set'
                        })

            # B. Powers
            for p in powers:
                matched, tag = get_match_tag(p.get('path'), path_name)
                if matched:
                    el_id = f"power_{p['id']}"
                    if el_id not in seen_ids:
                        seen_ids.add(el_id)
                        elements.append({
                            'id': p['id'],
                            'name': p['name'],
                            'type': 'power',
                            'element_type': 'power',
                            'tag': tag,
                            'isFree': tag == 'Free',
                            'is_free': tag == 'Free',
                            'action': p.get('action') or 'AM',
                            'usage': p.get('usage') or '1-Enc',
                            'effect': p.get('effect') or '',
                            'details': p.get('effect') or p.get('notes') or ''
                        })

            # C. Skills
            for sk in skills:
                matched, tag = get_match_tag(sk.get('path'), path_name)
                if matched:
                    el_id = f"skill_{sk['id']}"
                    if el_id not in seen_ids:
                        seen_ids.add(el_id)
                        elements.append({
                            'id': sk['id'],
                            'name': sk['name'],
                            'type': 'skill',
                            'element_type': 'skill',
                            'tag': tag,
                            'isFree': tag == 'Free',
                            'is_free': tag == 'Free',
                            'attribute': sk.get('attribute') or 'Moxie',
                            'discipline': sk.get('discipline') or 'General',
                            'effect': sk.get('notes') or '',
                            'details': sk.get('notes') or ''
                        })

            # D. Traits
            for t in traits:
                matched, tag = get_match_tag(t.get('path'), path_name)
                if matched:
                    el_id = f"trait_{t['id']}"
                    if el_id not in seen_ids:
                        seen_ids.add(el_id)
                        elements.append({
                            'id': t['id'],
                            'name': t['name'],
                            'type': 'trait',
                            'element_type': 'trait',
                            'tag': tag,
                            'isFree': tag == 'Free',
                            'is_free': tag == 'Free',
                            'effect': t.get('effect') or '',
                            'details': t.get('effect') or t.get('notes') or ''
                        })

            # E. Weapons
            for w in weapons:
                matched, tag = get_match_tag(w.get('path'), path_name)
                if matched:
                    el_id = f"weapon_{w['id']}"
                    if el_id not in seen_ids:
                        seen_ids.add(el_id)
                        elements.append({
                            'id': w['id'],
                            'name': w['name'],
                            'type': 'weapon',
                            'element_type': 'weapon',
                            'tag': tag,
                            'isFree': tag == 'Free',
                            'is_free': tag == 'Free',
                            'details': f"{w.get('dmg') or ''} {w.get('type') or ''}".strip()
                        })

            # F. Armor
            for a in armor:
                matched, tag = get_match_tag(a.get('path'), path_name)
                if matched:
                    el_id = f"armor_{a['id']}"
                    if el_id not in seen_ids:
                        seen_ids.add(el_id)
                        elements.append({
                            'id': a['id'],
                            'name': a['name'],
                            'type': 'armor',
                            'element_type': 'armor',
                            'tag': tag,
                            'isFree': tag == 'Free',
                            'is_free': tag == 'Free',
                            'details': f"AR {a.get('ar') or 0}"
                        })

            # G. Shields
            for sh in shields:
                matched, tag = get_match_tag(sh.get('path'), path_name)
                if matched:
                    el_id = f"shield_{sh['id']}"
                    if el_id not in seen_ids:
                        seen_ids.add(el_id)
                        elements.append({
                            'id': sh['id'],
                            'name': sh['name'],
                            'type': 'shield',
                            'element_type': 'shield',
                            'tag': tag,
                            'isFree': tag == 'Free',
                            'is_free': tag == 'Free',
                            'details': f"AR {sh.get('ar') or 0}"
                        })

            # Update public.paths
            elements_json = json.dumps(elements, ensure_ascii=False)
            cur.execute("""
                UPDATE public.paths
                SET linked_elements = %s::JSONB
                WHERE id = %s;
            """, (elements_json, pid))

            updated_count += 1
            total_elements_linked += len(elements)

            if len(elements) > 0:
                print(f"  ✓ Path '{path_name}': linked {len(elements)} elements.")

        conn.commit()
        print(f"\n✓ Migration transaction committed successfully!")
        print(f"  Total paths updated: {updated_count}")
        print(f"  Total element linkages created: {total_elements_linked}")

        # Post-migration verification
        cur.execute("SELECT count(*) FROM public.paths WHERE jsonb_array_length(linked_elements) > 0;")
        populated_paths_count = cur.fetchone()[0]
        print(f"  Paths with populated linked_elements: {populated_paths_count} / {len(all_paths)}")

        cur.execute("SELECT name, jsonb_array_length(linked_elements) FROM public.paths WHERE name ILIKE '%Mutak%';")
        for r in cur.fetchall():
            print(f"  Verified Mutak: '{r[0]}' -> {r[1]} linked elements.")

    except Exception as e:
        conn.rollback()
        print(f"[Error] Backfill failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
