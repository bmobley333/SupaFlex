# scripts/hydrate_character_sheets.py
# Autonomous script to hydrate full structured sheet_data JSON across all 10 character records in Supabase

import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaWJtaWlmeHdxbG5scGFla3VpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU1NjA5NiwiZXhwIjoyMTAwMTMyMDk2fQ.tzpdIj39T8-fe5zk_6NA75lx7OS-VcIigmdM8zeeRhc'
BASE_URL = 'https://ddibmiifxwqlnlpaekui.supabase.co/rest/v1/characters'

HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# Class & Archetype Power/Spell Configs
ARCHETYPE_POWERS = {
    "Mage": {
        "level": 10, "armor": 6,
        "powers": [
            {"select": True, "name": "Arcane Burst ⚡", "action": "AM", "usage": "1-⚡", "effect": "Release 1-⚡ Meta explosion dealing 3d6 Force damage.", "checked": [False, False, False]},
            {"select": True, "name": "Teleport Step", "action": "M", "usage": "1-Enc", "effect": "Instantaneous line-of-sight teleport up to 30ft.", "checked": [False, False, False]},
            {"select": True, "name": "Fireball", "action": "A", "usage": "1-Enc", "effect": "20ft radius explosive burst dealing 4d6 Fire damage.", "checked": [False, False, False]},
            {"select": True, "name": "Shield of Faith", "action": "P", "usage": "1-Rnd", "effect": "+4 Defense ward against incoming attacks.", "checked": [False, False, False]},
            {"select": True, "name": "Lightning Bolt", "action": "A", "usage": "1-Enc", "effect": "60ft line bolt dealing 3d8 Lightning damage.", "checked": [False, False, False]}
        ]
    },
    "Ranger": {
        "level": 4, "armor": 4,
        "powers": [
            {"select": True, "name": "Hunter's Mark ⚡", "action": "M", "usage": "1-⚡", "effect": "Mark target for +1d6 extra damage on all weapon hits.", "checked": [False, False, False]},
            {"select": True, "name": "Volley Shot", "action": "A", "usage": "1-Enc", "effect": "Ranged attack hitting up to 3 adjacent foes.", "checked": [False, False, False]},
            {"select": True, "name": "Evasive Roll", "action": "M", "usage": "1-Rnd", "effect": "Disengage without provoking opportunity attacks.", "checked": [False, False, False]},
            {"select": True, "name": "Snare Trap", "action": "A", "usage": "1-Enc", "effect": "Immobilize target for 1 round on failed Motion roll.", "checked": [False, False, False]},
            {"select": True, "name": "Precision Aim", "action": "P", "usage": "1-Luck", "effect": "Grant advantage (+2d20 keep highest) to next ranged roll.", "checked": [False, False, False]}
        ]
    },
    "Sorcerer": {
        "level": 10, "armor": 6,
        "powers": [
            {"select": True, "name": "Metamagic Surge ⚡", "action": "AM", "usage": "1-⚡", "effect": "Maximize spell damage output on next cast.", "checked": [False, False, False]},
            {"select": True, "name": "Flame Wave", "action": "A", "usage": "1-Enc", "effect": "15ft cone dealing 3d6 Fire damage.", "checked": [False, False, False]},
            {"select": True, "name": "Counterspell", "action": "F", "usage": "1-Enc", "effect": "Negate enemy spell cast within 40ft.", "checked": [False, False, False]},
            {"select": True, "name": "Misty Step", "action": "M", "usage": "1-Rnd", "effect": "Bonus move teleport 25ft.", "checked": [False, False, False]},
            {"select": True, "name": "Chain Lightning", "action": "A", "usage": "1-Enc", "effect": "Arcs to 3 additional targets.", "checked": [False, False, False]}
        ]
    },
    "Martial Artist": {
        "level": 5, "armor": 4,
        "powers": [
            {"select": True, "name": "Kinetic Strike ⚡", "action": "A", "usage": "1-⚡", "effect": "Deal Might die damage + 1 Spark momentum burst.", "checked": [False, False, False]},
            {"select": True, "name": "Mantis Flurry", "action": "A", "usage": "1-Enc", "effect": "Make 3 rapid unarmed strikes at -1 penalty.", "checked": [False, False, False]},
            {"select": True, "name": "Iron Lotus Stance", "action": "P", "usage": "1-Rnd", "effect": "Gain +2 Armor rating for 1 round.", "checked": [False, False, False]},
            {"select": True, "name": "Shadow Step", "action": "M", "usage": "1-Enc", "effect": "Step through shadows 20ft behind target.", "checked": [False, False, False]},
            {"select": True, "name": "Deflect Missiles", "action": "F", "usage": "1-Rnd", "effect": "Catch or reduce incoming ranged projectile damage by Motion roll.", "checked": [False, False, False]}
        ]
    },
    "Rogue": {
        "level": 4, "armor": 4,
        "powers": [
            {"select": True, "name": "Critical Edge ⚡", "action": "AM", "usage": "1-⚡", "effect": "Guarantee critical strike on next weapon hit.", "checked": [False, False, False]},
            {"select": True, "name": "Stealth Strike", "action": "A", "usage": "1-Enc", "effect": "+2d6 sneak attack damage from hidden stance.", "checked": [False, False, False]},
            {"select": True, "name": "Poison Blade", "action": "M", "usage": "1-Enc", "effect": "Coat weapon for 1d4 poison damage per hit for 3 rounds.", "checked": [False, False, False]},
            {"select": True, "name": "Vanish", "action": "M", "usage": "1-Enc", "effect": "Enter immediate stealth even while observed.", "checked": [False, False, False]},
            {"select": True, "name": "Shadow Dash", "action": "M", "usage": "1-Rnd", "effect": "Double movement speed this turn.", "checked": [False, False, False]}
        ]
    },
    "Default": {
        "level": 2, "armor": 4,
        "powers": [
            {"select": True, "name": "Power Strike ⚡", "action": "A", "usage": "1-⚡", "effect": "Execute powerful weapon blow + 1 Spark burst.", "checked": [False, False, False]},
            {"select": True, "name": "Shield Bash", "action": "A", "usage": "1-Enc", "effect": "Knock target prone on hit.", "checked": [False, False, False]},
            {"select": True, "name": "Battle Cry", "action": "M", "usage": "1-Enc", "effect": "Grant allies +1 to next attack roll.", "checked": [False, False, False]},
            {"select": True, "name": "Focus Charge", "action": "M", "usage": "1-Rnd", "effect": "Step up Focus Die 1 size.", "checked": [False, False, False]},
            {"select": True, "name": "Heavy Swing", "action": "A", "usage": "1-Enc", "effect": "+1d8 bonus damage to single target.", "checked": [False, False, False]}
        ]
    }
}

def create_default_sheet_data(c):
    hp = c.get('hp') or 10
    might = c.get('might') or 'd4'
    motion = c.get('motion') or 'd4'
    mind = c.get('mind') or 'd4'
    magic = c.get('magic') or 'd4'
    moxie = c.get('moxie') or 'd4'
    skills = c.get('skills') or []
    c_class = c.get('class') or 'Default'
    
    cfg = ARCHETYPE_POWERS.get(c_class, ARCHETYPE_POWERS['Default'])
    level = cfg['level']
    ap = level * 2
    armor = cfg['armor']
    
    return {
        "level": level,
        "ap": ap,
        "vitality_max": hp,
        "current_vitality": hp,
        "wounds": 0,
        "max_wounds": 3,
        "defense": 10,
        "armor": armor,
        "max_powers": 5,
        "max_spells": 5,
        "attribute_dice": {
            "might": might,
            "motion": motion,
            "mind": mind,
            "magic": magic,
            "moxie": moxie
        },
        "focus_die_current": "d4",
        "focus_die_max": "d4",
        "sparks": 0,
        "is_charged": False,
        "known_skillsets": skills,
        "power_slots": cfg['powers'],
        "spell_slots": [
            {"select": False, "name": "", "action": "", "usage": "", "effect": "", "checked": [False, False, False]}
            for _ in range(5)
        ],
        "gear_slots": [],
        "bio": {
            "backstory": "",
            "personality": "",
            "image_url": "",
            "notes": ""
        }
    }

def main():
    print("🌌 Fetching all character records from Supabase...")
    req = urllib.request.Request(f"{BASE_URL}?select=*", headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        chars = json.loads(resp.read().decode())
    
    print(f"Found {len(chars)} characters in database.")
    
    updated_count = 0
    for c in chars:
        cid = c['id']
        name = c.get('name') or 'Unnamed'
        new_sheet = create_default_sheet_data(c)
        
        update_payload = {
            "sheet_data": new_sheet
        }
        
        patch_url = f"{BASE_URL}?id=eq.{cid}"
        patch_req = urllib.request.Request(
            patch_url,
            data=json.dumps(update_payload).encode('utf-8'),
            headers=HEADERS,
            method='PATCH'
        )
        try:
            with urllib.request.urlopen(patch_req) as p_resp:
                print(f"✅ Hydrated Sheet Data for ID {cid} ({name}) | Lvl: {new_sheet['level']} | Armor: {new_sheet['armor']} | Might: {new_sheet['attribute_dice']['might']}")
                updated_count += 1
        except Exception as e:
            print(f"❌ Error updating ID {cid} ({name}):", e)
            
    print(f"\n🎉 Successfully hydrated {updated_count}/{len(chars)} character records on Supabase!")

if __name__ == '__main__':
    main()
