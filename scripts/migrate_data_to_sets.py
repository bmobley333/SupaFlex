# scripts/migrate_data_to_sets.py
# Forensic ETL migration script:
# 1. Migrates skillsets into public.sets ('Skills') and populates skills.sets
# 2. Migrates Weapons pseudo-paths into public.sets ('Weapons') and populates weapons.sets
# 3. Migrates Armor & Shields pseudo-paths into public.sets ('Armor & Shields') and populates armor.sets & shields.sets
# 4. Migrates Powers & Specialist sets into public.sets ('Powers') and populates powers.sets
# 5. Populates sets.paths linkages
# 6. Prunes converted pseudo-paths from public.paths
# 7. Drops skills.skillset once 100% verified

import json
import os
import sys
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def parse_path_entries(raw_path):
    if not raw_path:
        return []
    s = str(raw_path).strip()
    if s.startswith('[') and s.endswith(']'):
        try:
            arr = json.loads(s)
            return [str(x).strip() for x in arr if x]
        except Exception:
            pass
    # Fallback comma split
    return [p.strip() for p in s.split(',') if p.strip()]

def clean_tag(p):
    return p.replace('{Free}', '').replace('{Perk}', '').replace('{Trait}', '').strip()

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

    print("Connecting to Supabase PostgreSQL...")
    conn = psycopg2.connect(**cfg)
    conn.autocommit = False  # Transactional safety!
    cur = conn.cursor()

    try:
        # =====================================================================
        # PART 1: MIGRATE SKILLSETS -> PUBLIC.SETS ('Skills') & SKILLS.SETS
        # =====================================================================
        print("\n--- Part 1: Migrating Skillsets ---")
        cur.execute("SELECT id, name, skillset, path FROM public.skills;")
        skills = cur.fetchall()
        print(f"Total skills in database: {len(skills)}")

        all_skillsets = set()
        for sid, sname, sset, spath in skills:
            if sset:
                for ss in sset:
                    if ss and ss.strip():
                        all_skillsets.add(ss.strip())

        print(f"Found {len(all_skillsets)} distinct skillsets in skills table.")

        # Racial skillsets to path mapping
        racial_skillset_paths = {
            'Dwarven Skills': ['Dwarf'],
            'Elven Skills': ['Elf'],
            'Gnomish Skills': ['Gnome'],
            'Goblin Skills': ['Goblin'],
            'Halfling Skills': ['Halfling'],
            'Orc Skills': ['Half-Orc'],
            'Iron Lotus Discipline': ['Monk', 'Martial Artist'],
            'Spec Thief': ['Thief'],
            'Thievery': ['Thief'],
            'Thievery🎓': ['Thief'],
            'Spec Spy': ['Spy (mso)'],
            'Spy': ['Spy (mso)'],
            'Spec Survivalist': ['Survivalist (mso)'],
            'Survivalist': ['Survivalist (mso)'],
            'Medic': ['Ship Officer Medic (mso)'],
            'Engineer': ['Ship Officer Engineer (mso)'],
            'Fighter Pilot': ['Ship Officer Fighter Pilot (mso)'],
            'Helm': ['Ship Officer Helm (mso)'],
            'Programmer': ['Ship Officer Programmer (mso)'],
            'Scientist': ['Ship Officer Scientist (mso)'],
            'Tactical': ['Ship Officer Tactical (mso)'],
            'Mechanic': ['Mechanic (mso)'],
            'Vehicle Driver': ['Vehicle Driver (mso)'],
            'Martial Artist': ['Martial Artist (mso)'],
        }

        # Insert skillsets into public.sets
        for ss in sorted(all_skillsets):
            paths_arr = racial_skillset_paths.get(ss, [])
            cur.execute("""
                INSERT INTO public.sets (name, category, description, paths, owner)
                VALUES (%s, 'Skills', %s, %s, 'Designer')
                ON CONFLICT (name) DO UPDATE 
                SET paths = array_cat(public.sets.paths, EXCLUDED.paths)
                WHERE NOT (public.sets.paths @> EXCLUDED.paths);
            """, (ss, f"Skill package: {ss}", paths_arr))

        print(f"  ✓ Inserted/updated {len(all_skillsets)} skill sets in public.sets")

        # Copy skillset -> sets in public.skills
        cur.execute("""
            UPDATE public.skills
            SET sets = skillset
            WHERE skillset IS NOT NULL AND array_length(skillset, 1) > 0;
        """)
        print(f"  ✓ Updated {cur.rowcount} rows in public.skills with sets = skillset")

        # =====================================================================
        # PART 2: MIGRATE WEAPONS PSEUDO-PATHS -> PUBLIC.SETS ('Weapons')
        # =====================================================================
        print("\n--- Part 2: Migrating Weapon Sets ---")
        cur.execute("""
            SELECT id, name, category, description FROM public.paths 
            WHERE category = 'Weapons' OR name IN ('Artifact Weapons (mso)');
        """)
        weapon_paths = cur.fetchall()
        print(f"Found {len(weapon_paths)} weapon pseudo-paths in paths table.")

        weapon_set_paths_map = {
            'Anthropos Racial Weapons (mso)': ['Anthropos (mso)'],
            'Calemoran Racial Weapons (mso)': ['Calemora (mso)'],
            'Dracan Racial Weapons (mso)': ['Draca (mso)'],
            'Kryll Racial Weapons (mso)': ['Kryll (mso)'],
            'Shanask Racial Weapons (mso)': ['Shanask (mso)'],
            'Zin-Shee  Racial Weapons (mso)': ['Zin-Shee Male (mso)', 'Zin-Shee Female (mso)'],
            'Zin-Shee Racial Weapons (mso)': ['Zin-Shee Male (mso)', 'Zin-Shee Female (mso)'],
            'BioTech Melee Weapons (mso)': ['Bio-Warrior (mso)'],
            'BioTech Ranged Weapons (mso)': ['Bio-Gunner (mso)'],
            'BioTech Weapons (mso)': ['Bio-Warrior (mso)', 'Bio-Gunner (mso)'],
            'Tech Melee Weapons (mso)': ['Warrior (mso)'],
            'Tech Ranged Weapons (mso)': ['Marine (mso)', 'Archer (mso)', 'Pistolier (mso)', 'Rifle Expert (mso)'],
            'Archaic Weapons (mso)': ['Warrior', 'Paladin', 'Barbarian', 'Ranger'],
        }

        weapon_set_names = set()
        for pid, pname, pcat, pdesc in weapon_paths:
            weapon_set_names.add(pname)
            p_arr = weapon_set_paths_map.get(pname, [])
            cur.execute("""
                INSERT INTO public.sets (name, category, description, paths, owner)
                VALUES (%s, 'Weapons', %s, %s, 'Designer')
                ON CONFLICT (name) DO UPDATE 
                SET category = 'Weapons',
                    paths = array_cat(public.sets.paths, EXCLUDED.paths);
            """, (pname, pdesc or f"Weapon set: {pname}", p_arr))

        print(f"  ✓ Inserted/updated {len(weapon_set_names)} weapon sets in public.sets")

        # Now update public.weapons: inspect path column and assign matching sets
        cur.execute("SELECT id, name, path, sets FROM public.weapons;")
        weapons = cur.fetchall()
        weapons_updated = 0
        for wid, wname, wpath, wsets in weapons:
            wsets_curr = list(wsets or [])
            entries = parse_path_entries(wpath)
            new_sets = set(wsets_curr)
            for entry in entries:
                clean_e = clean_tag(entry)
                for wsn in weapon_set_names:
                    if clean_e.lower() == wsn.lower() or wsn.lower() in clean_e.lower():
                        new_sets.add(wsn)
            if set(new_sets) != set(wsets_curr):
                cur.execute("UPDATE public.weapons SET sets = %s WHERE id = %s;", (list(new_sets), wid))
                weapons_updated += 1

        print(f"  ✓ Updated {weapons_updated} weapons with matching weapon sets.")

        # =====================================================================
        # PART 3: MIGRATE ARMOR & SHIELD PSEUDO-PATHS -> PUBLIC.SETS ('Armor & Shields')
        # =====================================================================
        print("\n--- Part 3: Migrating Armor & Shields Sets ---")
        cur.execute("""
            SELECT id, name, category, description FROM public.paths 
            WHERE category IN ('Armor', 'Shields') OR name IN ('Artifact Armor (mso)');
        """)
        armor_shield_paths = cur.fetchall()
        print(f"Found {len(armor_shield_paths)} armor/shield pseudo-paths in paths table.")

        armor_set_paths_map = {
            'BioTech Armor (mso)': ['Bio-Warrior (mso)', 'Bio-Gunner (mso)'],
            'Tech Armor (mso)': ['Warrior (mso)'],
            'Tech Armor Heavy (mso)': ['Warrior (mso)', 'Destron (mso)'],
            'Tech Armor Medium (mso)': ['Warrior (mso)', 'Marine (mso)'],
            'Tech Suit Armor (mso)': ['Warrior (mso)', 'Marine (mso)', 'Destron (mso)'],
            'Archaic Armor (mso)': ['Warrior', 'Paladin', 'Knight'],
            'Archaic Shields (mso)': ['Warrior', 'Paladin'],
            'Tech Shields (mso)': ['Warrior (mso)', 'Marine (mso)', 'Destron (mso)'],
        }

        armor_shield_set_names = set()
        for pid, pname, pcat, pdesc in armor_shield_paths:
            armor_shield_set_names.add(pname)
            p_arr = armor_set_paths_map.get(pname, [])
            cur.execute("""
                INSERT INTO public.sets (name, category, description, paths, owner)
                VALUES (%s, 'Armor & Shields', %s, %s, 'Designer')
                ON CONFLICT (name) DO UPDATE 
                SET category = 'Armor & Shields',
                    paths = array_cat(public.sets.paths, EXCLUDED.paths);
            """, (pname, pdesc or f"Armor/Shield set: {pname}", p_arr))

        print(f"  ✓ Inserted/updated {len(armor_shield_set_names)} armor & shield sets in public.sets")

        # Update public.armor
        cur.execute("SELECT id, name, path, sets FROM public.armor;")
        armors = cur.fetchall()
        armor_updated = 0
        for aid, aname, apath, asets in armors:
            asets_curr = list(asets or [])
            entries = parse_path_entries(apath)
            new_sets = set(asets_curr)
            for entry in entries:
                clean_e = clean_tag(entry)
                for asn in armor_shield_set_names:
                    if clean_e.lower() == asn.lower() or asn.lower() in clean_e.lower():
                        new_sets.add(asn)
            if set(new_sets) != set(asets_curr):
                cur.execute("UPDATE public.armor SET sets = %s WHERE id = %s;", (list(new_sets), aid))
                armor_updated += 1
        print(f"  ✓ Updated {armor_updated} armor items with matching armor sets.")

        # Update public.shields
        cur.execute("SELECT id, name, path, sets FROM public.shields;")
        shields = cur.fetchall()
        shields_updated = 0
        for sid, sname, spath, ssets in shields:
            ssets_curr = list(ssets or [])
            entries = parse_path_entries(spath)
            new_sets = set(ssets_curr)
            for entry in entries:
                clean_e = clean_tag(entry)
                for asn in armor_shield_set_names:
                    if clean_e.lower() == asn.lower() or asn.lower() in clean_e.lower():
                        new_sets.add(asn)
            if set(new_sets) != set(ssets_curr):
                cur.execute("UPDATE public.shields SET sets = %s WHERE id = %s;", (list(new_sets), sid))
                shields_updated += 1
        print(f"  ✓ Updated {shields_updated} shield items with matching shield sets.")

        # =====================================================================
        # PART 4: MIGRATE POWERS & SPECIALIST SETS -> PUBLIC.SETS ('Powers')
        # =====================================================================
        print("\n--- Part 4: Migrating Powers & Specialist Sets ---")
        cur.execute("""
            SELECT id, name, category, description FROM public.paths 
            WHERE category = 'Powers' 
               OR (category = 'Specialist' AND name ILIKE '%Set%')
               OR name IN ('Sorce Relics');
        """)
        power_paths = cur.fetchall()
        print(f"Found {len(power_paths)} power/specialist pseudo-paths in paths table.")

        power_set_names = set()
        for pid, pname, pcat, pdesc in power_paths:
            power_set_names.add(pname)
            cur.execute("""
                INSERT INTO public.sets (name, category, description, paths, owner)
                VALUES (%s, 'Powers', %s, %s, 'Designer')
                ON CONFLICT (name) DO UPDATE 
                SET category = 'Powers';
            """, (pname, pdesc or f"Power set: {pname}", []))

        print(f"  ✓ Inserted/updated {len(power_set_names)} power sets in public.sets")

        # Update public.powers
        cur.execute("SELECT id, name, path, sets FROM public.powers;")
        powers = cur.fetchall()
        powers_updated = 0
        for pid, pname, ppath, psets in powers:
            psets_curr = list(psets or [])
            entries = parse_path_entries(ppath)
            new_sets = set(psets_curr)
            for entry in entries:
                clean_e = clean_tag(entry)
                for psn in power_set_names:
                    if clean_e.lower() == psn.lower() or psn.lower() in clean_e.lower():
                        new_sets.add(psn)
            if set(new_sets) != set(psets_curr):
                cur.execute("UPDATE public.powers SET sets = %s WHERE id = %s;", (list(new_sets), pid))
                powers_updated += 1
        print(f"  ✓ Updated {powers_updated} powers with matching power sets.")

        # Update public.traits for synergy traits
        cur.execute("SELECT id, name, path, sets FROM public.traits;")
        traits = cur.fetchall()
        traits_updated = 0
        for tid, tname, tpath, tsets in traits:
            tsets_curr = list(tsets or [])
            entries = parse_path_entries(tpath)
            new_sets = set(tsets_curr)
            for entry in entries:
                clean_e = clean_tag(entry)
                for psn in power_set_names:
                    if clean_e.lower() == psn.lower():
                        new_sets.add(psn)
            if set(new_sets) != set(tsets_curr):
                cur.execute("UPDATE public.traits SET sets = %s WHERE id = %s;", (list(new_sets), tid))
                traits_updated += 1
        print(f"  ✓ Updated {traits_updated} traits with matching set links.")

        # =====================================================================
        # PART 5: PRUNE PSEUDO-PATHS FROM PUBLIC.PATHS TABLE
        # =====================================================================
        print("\n--- Part 5: Pruning Converted Pseudo-Paths from public.paths ---")
        cur.execute("""
            SELECT id, name, category FROM public.paths
            WHERE category IN ('Armor', 'Shields', 'Weapons', 'Powers')
               OR (category = 'Specialist' AND name ILIKE '%Set%')
               OR name IN ('Artifact Armor (mso)', 'Artifact Weapons (mso)', 'Sorce Relics');
        """)
        paths_to_prune = cur.fetchall()
        print(f"Identified {len(paths_to_prune)} pseudo-paths to remove from public.paths.")
        
        prune_names = [p[1] for p in paths_to_prune]
        cur.execute("""
            DELETE FROM public.paths 
            WHERE category IN ('Armor', 'Shields', 'Weapons', 'Powers')
               OR (category = 'Specialist' AND name ILIKE '%Set%')
               OR name IN ('Artifact Armor (mso)', 'Artifact Weapons (mso)', 'Sorce Relics');
        """)
        print(f"  ✓ Deleted {cur.rowcount} pseudo-paths from public.paths.")

        cur.execute("SELECT count(*) FROM public.paths;")
        remaining_paths = cur.fetchone()[0]
        print(f"  ✓ Remaining pure archetype paths: {remaining_paths}")

        # =====================================================================
        # PART 6: VERIFY SKILLS.SETS PARITY AND DROP SKILLS.SKILLSET
        # =====================================================================
        print("\n--- Part 6: Verifying skills.sets Parity and Pruning skillset ---")
        cur.execute("""
            SELECT count(*) FROM public.skills 
            WHERE skillset IS NOT NULL 
              AND array_length(skillset, 1) > 0 
              AND NOT (sets @> skillset AND skillset @> sets);
        """)
        mismatched = cur.fetchone()[0]
        if mismatched > 0:
            raise Exception(f"Parity check failed! {mismatched} skills have mismatched sets vs skillset!")
        print("  ✓ Parity verified 100%! All skills.sets match skills.skillset perfectly.")

        cur.execute("ALTER TABLE public.skills DROP COLUMN IF EXISTS skillset;")
        print("  ✓ Dropped legacy 'skillset' column from public.skills.")

        # Reload schema cache
        cur.execute("NOTIFY pgrst, 'reload schema';")

        conn.commit()
        print("\n🎉 ALL PHASE 2 ETL OPERATIONS COMMITTED SUCCESSFULLY!")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR during Phase 2 ETL! Rolled back transaction. Error: {e}", file=sys.stderr)
        cur.close()
        conn.close()
        sys.exit(1)

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
