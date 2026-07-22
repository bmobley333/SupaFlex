# scripts/migrate_all_flexmoxie_characters.py
# Automated DB-to-DB Migration Script: FlexMoxie DB ➔ SupaFlex DB

import os
import sys
import json
import tomllib
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("🌌 Starting Automated DB-to-DB Character Migration (FlexMoxie ➔ SupaFlex)...")
    
    # 1. Load FlexMoxie (Source) DB Credentials
    source_secrets_path = r'C:\Repos\Projects\FlexWeb\.streamlit\secrets.toml'
    if not os.path.exists(source_secrets_path):
        print(f"❌ Error: Source secrets file not found at {source_secrets_path}")
        sys.exit(1)
        
    with open(source_secrets_path, 'rb') as f:
        source_secrets = tomllib.load(f)
        
    src_url = source_secrets['connections']['supabase']['SUPABASE_URL']
    src_key = source_secrets['connections']['supabase']['SUPABASE_KEY']
    
    # 2. Load SupaFlex (Target) DB Credentials
    target_env_path = r'C:\Repos\Projects\SupaFlex\env.json'
    if not os.path.exists(target_env_path):
        print(f"❌ Error: Target env file not found at {target_env_path}")
        sys.exit(1)
        
    with open(target_env_path, 'r', encoding='utf-8') as f:
        target_env = json.load(f)
        
    tgt_url = target_env['VITE_SUPABASE_URL']
    tgt_key = target_env['SUPABASE_SERVICE_ROLE_KEY']
    
    print(f"  Source Database URL: {src_url}")
    print(f"  Target Database URL: {tgt_url}")
    
    # 3. Fetch all characters from FlexMoxie DB
    src_req = urllib.request.Request(
        f"{src_url}/rest/v1/characters?select=*",
        headers={'apikey': src_key, 'Authorization': f'Bearer {src_key}'}
    )
    
    with urllib.request.urlopen(src_req) as resp:
        source_chars = json.loads(resp.read().decode())
        
    print(f"\n📦 Found {len(source_chars)} character records in FlexMoxie DB.")
    
    migrated_count = 0
    for c in source_chars:
        cid = c.get('id')
        name = c.get('name') or 'Unnamed'
        owner = c.get('owner_email') or 'TheBMobley@gmail.com'
        c_class = c.get('class') or 'Adventurer'
        c_race = c.get('race') or 'Human'
        
        top_hp = c.get('hp') or 10
        might = c.get('might') or 'd4'
        motion = c.get('motion') or 'd4'
        mind = c.get('mind') or 'd4'
        magic = c.get('magic') or 'd4'
        moxie = c.get('moxie') or 'd4'
        
        raw_sd = c.get('sheet_data') or {}
        
        # Extract vitals from raw_sd
        vitals = raw_sd.get('vitals') or {}
        level = vitals.get('level') or raw_sd.get('level') or 1
        ap = level * 2
        max_hp = vitals.get('max_hp') or raw_sd.get('vitality_max') or top_hp
        current_hp = vitals.get('current_hp') or raw_sd.get('current_vitality') or max_hp
        wounds = vitals.get('wounds') or raw_sd.get('wounds') or 0
        
        # Extract armor from armor_shield
        armor_shield = raw_sd.get('armor_shield') or {}
        raw_ar = armor_shield.get('armor_ar') or str(raw_sd.get('armor') or 0)
        try:
            parsed_ar = int(raw_ar)
            if parsed_ar not in [0, 4, 6, 8, 10, 12]:
                parsed_ar = 4 if parsed_ar > 0 else 0
        except ValueError:
            parsed_ar = 0
            
        # Extract powers & magic items
        raw_powers = raw_sd.get('powers') or raw_sd.get('power_slots') or []
        cleaned_powers = []
        for p in raw_powers:
            p_name = p.get('name', '').strip()
            if p_name:
                cleaned_powers.append({
                    "select": True,
                    "name": p_name,
                    "action": p.get('action', 'A').strip().upper() or 'A',
                    "usage": p.get('usage', '1-Enc').strip() or '1-Enc',
                    "effect": p.get('effect', '').strip(),
                    "checked": p.get('checked', [False, False, False])
                })
                
        # Pad power slots to at least 5
        while len(cleaned_powers) < 5:
            cleaned_powers.append({
                "select": False, "name": "", "action": "", "usage": "", "effect": "", "checked": [False, False, False]
            })
            
        raw_magic_items = raw_sd.get('magic_items') or raw_sd.get('spell_slots') or []
        cleaned_magic_items = []
        for mi in raw_magic_items:
            m_name = mi.get('name', '').strip()
            if m_name:
                cleaned_magic_items.append({
                    "select": True,
                    "name": m_name,
                    "action": mi.get('action', 'A').strip().upper() or 'A',
                    "usage": mi.get('usage', '1-Enc').strip() or '1-Enc',
                    "effect": mi.get('effect', '').strip(),
                    "checked": mi.get('checked', [False, False, False])
                })
                
        # Pad spell/magic item slots to at least 5
        while len(cleaned_magic_items) < 5:
            cleaned_magic_items.append({
                "select": False, "name": "", "action": "", "usage": "", "effect": "", "checked": [False, False, False]
            })
            
        # Extract equipment/weapons
        raw_weapons = raw_sd.get('weapons') or []
        gear_slots = []
        for w in raw_weapons:
            w_name = w.get('name', '').strip()
            if w_name:
                gear_slots.append({
                    "select": True,
                    "name": f"Weapon: {w_name}",
                    "type": "weapon",
                    "armor_bonus": 0,
                    "defense_bonus": 0,
                    "usage": f"Atk d{w.get('atk', '8')} / Dmg d{w.get('dmg', '8')}",
                    "effect": f"Max Block: {w.get('max_block', 'n/a')}",
                    "checked": [False, False, False]
                })
                
        # Extract skillsets
        known_skillsets = raw_sd.get('known_skillsets') or c.get('skills') or []
        if isinstance(known_skillsets, str):
            known_skillsets = [known_skillsets]
            
        # Clean skill emojis if any
        cleaned_skillsets = []
        for sk in known_skillsets:
            if isinstance(sk, str):
                cleaned_sk = sk.replace('👁️', '').replace('🏃', '').replace('💪', '').replace('✨', '').replace('🫀', '').strip()
                if cleaned_sk and cleaned_sk not in cleaned_skillsets:
                    cleaned_skillsets.append(cleaned_sk)
            elif isinstance(sk, dict) and sk.get('name'):
                cleaned_skillsets.append(sk['name'])
                
        # Extract traits & bio notes
        general_notes = raw_sd.get('general_notes') or ''
        traits = raw_sd.get('traits') or {}
        bio_personality = ""
        if isinstance(traits, dict):
            parts = []
            if traits.get('positive_trait'): parts.append(f"Positive: {traits['positive_trait']}")
            if traits.get('negative_trait'): parts.append(f"Negative: {traits['negative_trait']}")
            if traits.get('adventuring_goal'): parts.append(f"Goal: {traits['adventuring_goal']}")
            bio_personality = " | ".join(parts)
            
        bio_notes = ""
        if isinstance(traits, dict):
            parts = []
            if traits.get('appearance'): parts.append(f"Appearance: {traits['appearance']}")
            if traits.get('hgt_wgt_age'): parts.append(f"Details: {traits['hgt_wgt_age']}")
            if armor_shield.get('armor_name'): parts.append(f"Armor: {armor_shield['armor_name']}")
            bio_notes = " | ".join(parts)
            
        # Build clean SupaFlex sheet_data JSONB object
        supaflex_sheet_data = {
            "level": level,
            "ap": ap,
            "vitality_max": max_hp,
            "current_vitality": current_hp,
            "wounds": wounds,
            "max_wounds": 3,
            "defense": 10,
            "armor": parsed_ar,
            "max_powers": len(cleaned_powers),
            "max_spells": len(cleaned_magic_items),
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
            "known_skillsets": cleaned_skillsets,
            "power_slots": cleaned_powers,
            "spell_slots": cleaned_magic_items,
            "gear_slots": gear_slots,
            "bio": {
                "backstory": general_notes,
                "personality": bio_personality,
                "image_url": "",
                "notes": bio_notes
            }
        }
        
        # Dual-write payload to SupaFlex DB
        payload = {
            "name": name,
            "class": c_class,
            "race": c_race,
            "hp": max_hp,
            "might": might,
            "motion": motion,
            "mind": mind,
            "magic": magic,
            "moxie": moxie,
            "skills": cleaned_skillsets,
            "inventory": gear_slots,
            "owner_email": owner,
            "sheet_data": supaflex_sheet_data,
            "updated_at": "2026-07-22T13:51:35-06:00"
        }
        
        patch_url = f"{tgt_url}/rest/v1/characters?id=eq.{cid}"
        patch_req = urllib.request.Request(
            patch_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'apikey': tgt_key,
                'Authorization': f'Bearer {tgt_key}',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            method='PATCH'
        )
        
        try:
            with urllib.request.urlopen(patch_req) as p_resp:
                print(f"✅ Migrated ID {cid} ({name}) | Lvl {level} | HP {current_hp}/{max_hp} | Armor {parsed_ar} | Powers: {len([p for p in cleaned_powers if p['name']])} | Spells: {len([s for s in cleaned_magic_items if s['name']])} | Skillsets: {len(cleaned_skillsets)}")
                migrated_count += 1
        except Exception as e:
            print(f"❌ Error migrating ID {cid} ({name}):", e)
            
    print(f"\n🎉 Successfully migrated {migrated_count}/{len(source_chars)} characters from FlexMoxie DB ➔ SupaFlex DB!")

if __name__ == '__main__':
    main()
