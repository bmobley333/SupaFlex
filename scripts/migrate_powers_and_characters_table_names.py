# migrate_powers_and_characters_table_names.py
# Idempotent migration script to update powers 'table' column entries
# and character sheet power set references to the 46 canonical table names.

import os
import sys
import json
import argparse
from supabase import create_client

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Complete 56-to-46 Canonical Table Mapping Dictionary
TABLE_RENAME_MAP = {
    "Psionics": "Psionics",
    "Bard (Musical Rogue) Power Set": "Bard",
    "Blade Saint (Martial Artist) Power Set": "Martial Artist - Blade Saint",
    "Psionic Sentinel Power Set": "Psionics - Sentinel",
    "Psychosomatics": "Psychosomatics",
    "Shadowfist Healer-Monk Power Set": "Monk",
    "Magnetic Wizard Power Set": "Mage - Magnetic",
    "Shield Warrior": "Warrior - Shield",
    "Punk Fighter": "Warrior - Punk",
    "Martial Arts Power Set": "Martial Arts",
    "Void Magic": "Mage - Void Magic",
    "Thief Assassin Power Set": "Thief - Assassin",
    "Elemental Mage Power Set": "Mage - Elemental",
    "Human Starborn Ranger": "Starborn Ranger",
    "Cursed Spartan Power Set": "Warrior - Cursed Spartan",
    "Shadowmancer Voidcaller": "Mage - Void Magic",
    "CyberDrake Inferno Vanguard": "Warrior - Inferno Vanguard",
    "Elden Verdant Sentinel": "Healer - Verdant Sentinel",
    "Golemari Geomancer": "Mage - Geomancer",
    "Were Bloodfang Berserker": "Warrior - Bloodfang Berserker",
    "Healer Power Set": "Healer",
    "Single Weapon Power Set": "Single Weapon",
    "Monk Power Set": "Monk",
    "Horax Bio Engineer": "Unique - Bio Engineer",
    "Sun-Devoted Healer-Protector": "Healer - Sun-Devoted",
    "Weapon & Shield Power Set": "Weapon & Shield",
    "Trickster Power Set": "Trickster",
    "Dual Wield Power Set": "Dual Wield",
    "Nyax Aetherblade": "Warrior - Aetherblade",
    "Vamp Lifestealer": "Warrior - Lifestealer",
    "Warrior Power Set": "Warrior",
    "Dwarf Power Set": "Dwarf",
    "Elf Power Set": "Elf",
    "Bloodmarked Human (Cursed Spartan)": "Human - Bloodmarked",
    "Goblin Power Set": "Goblin",
    "Half-Orc Power Set": "Half-Orc",
    "Ranger Power Set": "Warrior - Ranger",
    "Nelf Power Set": "Nelf",
    "Giant Form": "Form - Giant",
    "Orc Power Set": "Orc",
    "Gnome Power Set": "Gnome",
    "Nymph Form": "Form - Nymph",
    "Nymph Power Set": "Nymph",
    "Pixie Form": "Form - Pixie",
    "Dwarf (Blackaxe Clan)": "Dwarf - Blackaxe Clan",
    "Human Power Set": "Human",
    "Fairy Power Set": "Fairy",
    "Luck Power Set": "Luck",
    
    # Consolidations
    "Shadowfist Healer-Monk": "Monk",
    "Nymph (Thryndralis Trickster)": "Nymph",
    "Human (Aethelgard Bloodline)": "Human - Bloodmarked",
    ": Magnetic Wizard": "Mage - Magnetic",
    "Core Power": "Warrior",
    "Weird Powers": "Mage - Elemental",
    "Phantom Tainville": "Martial Artist - Blade Saint",
    "Fairy (Sunblessed Fey)": "Fairy"
}

def load_env():
    current_dir = r"c:\Repos\Jodar"
    env_path = os.path.join(current_dir, "env.json")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def migrate_powers_table(sb):
    print("\n--- 1. MIGRATING POWERS TABLE IN SUPABASE ---")
    updated_total = 0
    for old_table, new_table in TABLE_RENAME_MAP.items():
        if old_table == new_table:
            continue
        try:
            res = sb.table("powers").update({"table": new_table}).eq("table", old_table).execute()
            count = len(res.data)
            if count > 0:
                updated_total += count
                print(f"✅ Batch updated '{old_table}' ➡ '{new_table}' ({count} rows)")
        except Exception as e:
            print(f"⚠️ Error updating table '{old_table}': {e}")
            
    print(f"✅ Successfully migrated {updated_total} power records to canonical table names.")

def migrate_characters_table(sb):
    print("\n--- 2. MIGRATING CHARACTERS TABLE IN SUPABASE ---")
    chars = sb.table("characters").select("*").execute().data
    print(f"Loaded {len(chars)} characters from Supabase.")
    
    updated_count = 0
    for c in chars:
        c_json = json.dumps(c)
        modified = False
        for old_t, new_t in TABLE_RENAME_MAP.items():
            if old_t in c_json and old_t != new_t:
                c_json = c_json.replace(f'"{old_t}"', f'"{new_t}"')
                c_json = c_json.replace(old_t, new_t)
                modified = True
                
        if modified:
            try:
                updated_c = json.loads(c_json)
                sb.table("characters").update(updated_c).eq("id", c["id"]).execute()
                updated_count += 1
                print(f"✅ Updated character ID {c['id']} ({c.get('name')})")
            except Exception as e:
                print(f"Error updating character ID {c['id']}: {e}")
                
    print(f"✅ Character migration complete: {updated_count} character records updated.")

def migrate_json_file(file_path):
    if not os.path.exists(file_path):
        return
    print(f"\n--- MIGRATING LOCAL JSON BACKUP: {file_path} ---")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        modified = False
        for old_t, new_t in TABLE_RENAME_MAP.items():
            if old_t in content and old_t != new_t:
                content = content.replace(f'"{old_t}"', f'"{new_t}"')
                content = content.replace(old_t, new_t)
                modified = True
                
        if modified:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"✅ Updated local backup JSON file: {file_path}")
        else:
            print(f"ℹ️ No old table references found in {file_path}")
    except Exception as e:
        print(f"Error updating local JSON {file_path}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Migrate powers table and character sheets to canonical table names.")
    parser.add_argument("--json-only", action="store_true", help="Only migrate local JSON backups")
    args = parser.parse_args()

    env = load_env()
    url = env.get("SUPAFLEX_DEV_URL", "https://zipebnjazayhfjstykwl.supabase.co")
    key = env.get("SUPAFLEX_DEV_SERVICE_ROLE_KEY")

    if not args.json_only and key:
        sb = create_client(url, key)
        migrate_powers_table(sb)
        migrate_characters_table(sb)

    # Migrate local JSON backups
    backup_file = r"C:\Repos\Projects\SupaFlex\backups\json\2026-08-05\characters.json"
    migrate_json_file(backup_file)

    print("\n🌌 Power & Character Table Name Migration Finished Successfully!")

if __name__ == "__main__":
    main()
