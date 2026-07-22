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

def create_default_sheet_data(c):
    hp = c.get('hp') or 10
    might = c.get('might') or 'd4'
    motion = c.get('motion') or 'd4'
    mind = c.get('mind') or 'd4'
    magic = c.get('magic') or 'd4'
    moxie = c.get('moxie') or 'd4'
    skills = c.get('skills') or []
    
    return {
        "level": 1,
        "ap": 2,
        "vitality_max": hp,
        "current_vitality": hp,
        "wounds": 0,
        "max_wounds": 3,
        "defense": 10,
        "armor": 0,
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
        "power_slots": [
            {
                "select": True,
                "name": "Kinetic Strike ⚡",
                "action": "A",
                "usage": "1-⚡",
                "effect": "Deal Might die damage + 1 Spark momentum burst.",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            }
        ],
        "spell_slots": [
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            },
            {
                "select": False,
                "name": "",
                "action": "",
                "usage": "",
                "effect": "",
                "checked": [False, False, False]
            }
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
        raw_sheet = c.get('sheet_data') or {}
        
        # Build normalized sheet_data
        new_sheet = create_default_sheet_data(c)
        # Preserve any existing populated sub-keys
        if raw_sheet.get('known_skillsets'):
            new_sheet['known_skillsets'] = raw_sheet['known_skillsets']
        if raw_sheet.get('power_slots') and any(s.get('name') for s in raw_sheet['power_slots']):
            new_sheet['power_slots'] = raw_sheet['power_slots']
        if raw_sheet.get('spell_slots') and any(s.get('name') for s in raw_sheet['spell_slots']):
            new_sheet['spell_slots'] = raw_sheet['spell_slots']
            
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
                print(f"✅ Hydrated Sheet Data for ID {cid} ({name}) | HP: {new_sheet['vitality_max']} | Might: {new_sheet['attribute_dice']['might']}")
                updated_count += 1
        except Exception as e:
            print(f"❌ Error updating ID {cid} ({name}):", e)
            
    print(f"\n🎉 Successfully hydrated {updated_count}/{len(chars)} character records on Supabase!")

if __name__ == '__main__':
    main()
