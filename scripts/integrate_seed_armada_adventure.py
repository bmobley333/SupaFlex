# C:\Repos\Projects\SupaFlex\scripts\integrate_seed_armada_adventure.py
# Autonomous integration of "Seed the Empire Armada" Google Doc into SupaFlex GM Screen (Design Mode)

import os
import sys
import json
import re
import uuid
import urllib.request
from datetime import datetime

# Force UTF-8 encoding on Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def clean_text(s):
    if not s:
        return ""
    return (s.replace('\ufffd', "'")
            .replace('’', "'")
            .replace('‘', "'")
            .replace('“', '"')
            .replace('”', '"')
            .replace('—', ' - ')
            .replace('–', ' - '))

# 1. Credentials and Setup
base_dir = os.path.dirname(os.path.abspath(__file__))
supaflex_root = os.path.abspath(os.path.join(base_dir, ".."))
env_path = os.path.join(supaflex_root, "env.json")

with open(env_path, "r", encoding="utf-8") as f:
    env = json.load(f)

supabase_url = env["VITE_SUPABASE_URL"]
service_key = env["SUPABASE_SERVICE_ROLE_KEY"]

sys.path.append(r"C:\Repos\Jodar\services\gdrive-helper")
import drive_helper
from googleapiclient.discovery import build

DOC_ID = "1Zr-EHlIJYboGf4agf68eANB5QV1M4elgFmA86C-9Ktc"
GM_EMAIL = "metascapegame@gmail.com"
ADVENTURE_TITLE = "Seed the Empire Armada"

# 2. Fetch Document Tabs
print(f"🌌 Connecting to Google Docs API for Document ID: {DOC_ID}...")
creds = drive_helper.get_credentials("metascapegame")
docs_service = build('docs', 'v1', credentials=creds)
doc = docs_service.documents().get(documentId=DOC_ID, includeTabsContent=True).execute()

tabs = doc.get('tabs', [])
print(f"✅ Found {len(tabs)} tabs in Google Doc.")

def extract_text_from_element(el):
    text = ""
    if 'paragraph' in el:
        for pe in el['paragraph'].get('elements', []):
            if 'textRun' in pe:
                text += pe['textRun'].get('content', '')
    elif 'table' in el:
        for row in el['table'].get('tableRows', []):
            for cell in row.get('tableCells', []):
                for cell_el in cell.get('content', []):
                    text += extract_text_from_element(cell_el)
    elif 'tableOfContents' in el:
        for toc_el in el['tableOfContents'].get('content', []):
            text += extract_text_from_element(toc_el)
    return text

tabs_text = []
for tab in tabs:
    tab_props = tab.get('tabProperties', {})
    tab_title = clean_text(tab_props.get('title'))
    tab_doc = tab.get('documentTab', {})
    body = tab_doc.get('body', {})
    
    full_text = ""
    for item in body.get('content', []):
        full_text += extract_text_from_element(item)
    tabs_text.append({"title": tab_title, "text": clean_text(full_text)})

# 3. Helper to create ParsedMonster & PreStagedMonster
def parse_monster_line(line):
    trimmed = line.strip() if line else ''
    mon_id = f"mon_{uuid.uuid4().hex[:7]}"
    if not trimmed:
        return {
            "id": mon_id,
            "nameWithEquip": "",
            "attackStat": "",
            "defenseStat": "",
            "vitalityStat": "",
            "fullText": line,
            "reducedText": "",
            "baseFullText": line
        }

    atk_match = re.search(r'(?:⚔️|⚔)\s*[\d\/\(\)\s\-+]+', trimmed)
    attack_stat = atk_match.group(0).strip() if atk_match else ''

    def_match = re.search(r'(?:🛡️|🧥)\s*[\d\/\(\)\s\-+]+', trimmed)
    defense_stat = def_match.group(0).strip() if def_match else ''

    vit_match = re.search(r'(?:❤️)\s*\d+', trimmed)
    vitality_stat = vit_match.group(0).strip() if vit_match else ''

    icon_match = re.search(r'[🚩👣⚔️⚔🛡️🧥❤️]', trimmed)
    name_with_equip = trimmed
    if icon_match:
        name_with_equip = trimmed[:icon_match.start()].strip()
        name_with_equip = re.sub(r'[\:\–\-]+$', '', name_with_equip).strip()

    parts = [p for p in [name_with_equip, attack_stat, defense_stat, vitality_stat] if p]
    reduced_text = " ".join(parts) if parts else trimmed

    return {
        "id": mon_id,
        "nameWithEquip": name_with_equip,
        "attackStat": attack_stat,
        "defenseStat": defense_stat,
        "vitalityStat": vitality_stat,
        "fullText": trimmed,
        "reducedText": reduced_text,
        "baseFullText": trimmed
    }

# 4. Canonical Monster Factory (based on Supabase Codex)
def make_monster(name, species, custom_notes="", count=1, dif=10):
    species_map = {
        "ogrind": {
            "nish": 10, "mr": 10, "atk": "15/19", "def": "9/2", "vit": 23,
            "attr": "[✨12/💪18/👁️9/🏃10/🫀24]", "abil": "Immense Str, Grapple, Slam"
        },
        "handguard": {
            "nish": 22, "mr": 14, "atk": "18/12", "def": "22/0", "vit": 20,
            "attr": "[✨9/💪20/👁️11/🏃24/🫀12]", "abil": "Somatics, Poison Blades, Leaps, Blaster Fire"
        },
        "rexar": {
            "nish": 19, "mr": 18, "atk": "20/5", "def": "23/0", "vit": 8,
            "attr": "[✨9/💪15/👁️16/🏃24/🫀5]", "abil": "Tactical Orders, Negotiation, Sidearm"
        },
        "paralith": {
            "nish": 5, "mr": 6, "atk": "5/5", "def": "5/0", "vit": 8,
            "attr": "[✨9/💪5/👁️5/🏃5/🫀5]", "abil": "Contact Poison (Paralysis)"
        },
        "warshade": {
            "nish": 17, "mr": 12, "atk": "17/17", "def": "15/3", "vit": 20,
            "attr": "[✨12/💪19/👁️13/🏃18/🫀22]", "abil": "Orders, Necromancy, Knockback, Tough"
        },
        "whisperfur": {
            "nish": 17, "mr": 16, "atk": "16/5", "def": "16/0", "vit": 8,
            "attr": "[✨9/💪7/👁️12/🏃19/🫀5]", "abil": "Camouflage, Non-combatant"
        },
        "stomper": {
            "nish": 6, "mr": 8, "atk": "16/22", "def": "8/4", "vit": 35,
            "attr": "[✨5/💪22/👁️8/🏃6/🫀30]", "abil": "Heavy Slam, Heavy Plating, Ponderous Steps"
        },
        "scuttler": {
            "nish": 16, "mr": 12, "atk": "12/6", "def": "16/1", "vit": 8,
            "attr": "[✨5/💪6/👁️18/🏃16/🫀8]", "abil": "Optical Sensors, Alarm, Wall Crawl"
        }
    }
    
    spec_key = species.lower()
    stats = species_map.get(spec_key, species_map["ogrind"])
    
    # Clean up custom notes
    clean_notes = custom_notes.strip()
    # Remove species prefix if note starts with it (e.g. "Station Commander Klyss (Rexar): If alerted...")
    if ":" in clean_notes:
        clean_notes = clean_notes.split(":", 1)[1].strip()
        
    notes_str = f" ({clean_notes[:80]}...)" if clean_notes else (f" ({stats['abil']})" if stats.get('abil') else "")
    full_str = f"{name} 🚩{stats['nish']} 👣{stats['mr']} ⚔️{stats['atk']} 🧥{stats['def']} ❤️{stats['vit']} {stats['attr']}{notes_str}"
    
    parsed = parse_monster_line(full_str)
    parsed["count"] = count
    parsed["scaled_dif"] = dif
    return parsed

# 5. Extract Tab 0 -> Act 1: Major Plot Elements
print("\n📜 Building Act 1: Major Plot Elements...")
tab0_text = tabs_text[0]["text"]
tab0_lines = tab0_text.splitlines()

sections_tab0 = [
    ("Overview: Setting & Name Key", []),
    ("Act I: Scene 1 - The Weight of Worlds (The Star Force Bar)", []),
    ("Act I: Scene 2 - A Ghost from the Machine (Meeting Zondar)", []),
    ("Act II Overview: The Devil's Rock - XR70", []),
    ("Act III Overview: The Trojan Horse - Voidrunner", []),
    ("Act IV Overview: The Green Moon - Elmo7.2 & Extraction", [])
]

curr_sec_idx = 0
for l in tab0_lines:
    if "Scene 1: The Weight of Worlds" in l:
        curr_sec_idx = 1
    elif "Scene 2: A Ghost from the Machine" in l:
        curr_sec_idx = 2
    elif "Act II: The Devil's Rock" in l:
        curr_sec_idx = 3
    elif "Act III: The Trojan Horse" in l:
        curr_sec_idx = 4
    elif "Act IV: The Green Moon" in l:
        curr_sec_idx = 5
    
    sections_tab0[curr_sec_idx][1].append(l)

act1_encounters = []
for title, lines in sections_tab0:
    notes_content = "\n".join(lines).strip()
    enc_id = f"enc_{uuid.uuid4().hex[:12]}"
    act1_encounters.append({
        "id": enc_id,
        "title": title,
        "notes": notes_content,
        "tactical_notes": notes_content,
        "master_dif": 10,
        "monsters": [],
        "links": [],
        "loot": [],
        "created_at": datetime.now().isoformat()
    })

print(f"✅ Act 1 constructed with {len(act1_encounters)} narrative encounters.")

# 6. Parser for Facility Tabs (Tabs 1, 2, 3)
def parse_facility_tab(tab_data, act_num, act_title):
    print(f"\n🏢 Building Act {act_num}: {act_title}...")
    lines = tab_data["text"].splitlines()
    
    guide_idx = -1
    for i, l in enumerate(lines):
        if "Encounter Guide" in l:
            guide_idx = i
            break
            
    top_lines = lines[:guide_idx] if guide_idx != -1 else []
    guide_lines = lines[guide_idx:] if guide_idx != -1 else lines
    
    top_descs = {}
    for l in top_lines:
        m = re.match(r'^(?:Room\s+)?#?(\d+(?:\s*&\s*#?\d+)?)\s+([^:]+):\s*(.*)$', l.strip())
        if m:
            clean_num = m.group(1).replace(' ', '')
            top_descs[clean_num] = {
                "num": m.group(1).strip(),
                "name": m.group(2).strip(),
                "desc": m.group(3).strip()
            }
            
    guide_rooms = []
    curr_room = None
    for l in guide_lines:
        m = re.match(r'^(?:Room\s+)?#?(\d+(?:\s*&\s*#?\d+)?)\s*[\–\-\:]\s*(.+)$', l.strip())
        if m:
            if curr_room:
                guide_rooms.append(curr_room)
            clean_num = m.group(1).replace(' ', '')
            curr_room = {
                "num": m.group(1).strip(),
                "clean_num": clean_num,
                "name": m.group(2).strip(),
                "lines": []
            }
        elif curr_room:
            curr_room["lines"].append(l)
    if curr_room:
        guide_rooms.append(curr_room)
        
    print(f"Extracted {len(guide_rooms)} rooms from Encounter Guide.")
    
    encounters = []
    for gr in guide_rooms:
        c_num = gr["clean_num"]
        room_num = gr["num"]
        room_name = gr["name"].strip()
        
        enc_title = f"Room #{room_num} - {room_name}"
        
        notes_parts = []
        if c_num in top_descs:
            top_info = top_descs[c_num]
            notes_parts.append(f"Room Description:\n{top_info['desc']}")
            
        guide_text = "\n".join(gr["lines"]).strip()
        if guide_text:
            notes_parts.append(f"Tactical Encounter Notes:\n{guide_text}")
            
        full_notes = "\n\n---\n\n".join(notes_parts) if notes_parts else f"Room #{room_num} - {room_name}"
        
        monsters = []
        full_guide_block = "\n".join(gr["lines"])
        
        if "Opponents:" in full_guide_block:
            opp_text = full_guide_block.split("Opponents:")[1]
            for opp_line in opp_text.splitlines():
                ol = opp_line.strip()
                if not ol:
                    continue
                if any(ol.startswith(tag) for tag in ["Trap:", "Treasure:", "Reward:", "Puzzle:", "Special:", "Objective:", "Scene:", "GM Notes:"]):
                    break
                
                # Check opponent patterns
                if "klyss" in ol.lower() or ("rexar" in ol.lower() and "commander" in ol.lower()):
                    monsters.append(make_monster("Station Commander Klyss (Rexar)", "rexar", ol, count=1, dif=10))
                elif "overseer ketone" in ol.lower() or "ketone (" in ol.lower():
                    monsters.append(make_monster("Overseer Ketone (Warshade)", "warshade", ol, count=1, dif=18))
                elif "warshade" in ol.lower():
                    m_cnt = 1
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    label = f"{m_cnt} Warshade Elite Guards" if m_cnt > 1 else "1 Warshade Elite Guard"
                    monsters.append(make_monster(label, "warshade", ol, count=m_cnt, dif=16))
                elif "ogrind guard" in ol.lower() or "ogrind" in ol.lower():
                    m_cnt = 1
                    cnt_match = re.search(r'(\d+)\s*(?:-\s*(\d+))?', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(2) or cnt_match.group(1))
                    label = f"{m_cnt} Ogrind Guards" if m_cnt > 1 else "1 Ogrind Guard"
                    if "platoon" in ol.lower():
                        label = "4-6 Ogrind Guards (Platoon Patrol)"
                    monsters.append(make_monster(label, "ogrind", ol, count=m_cnt, dif=12))
                elif "handguard pilot" in ol.lower():
                    m_cnt = 1
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    label = f"{m_cnt} Handguard Pilots" if m_cnt > 1 else "1 Handguard Pilot"
                    if "injured" in ol.lower():
                        label = "1 Handguard Pilot (Injured)"
                    monsters.append(make_monster(label, "handguard", ol, count=m_cnt, dif=14))
                elif "handguard warrior" in ol.lower() or "handguard" in ol.lower():
                    m_cnt = 1
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    label = f"{m_cnt} Handguard Elite Guards" if m_cnt > 1 else "1 Handguard Elite Guard"
                    monsters.append(make_monster(label, "handguard", ol, count=m_cnt, dif=14))
                elif "paralith captain" in ol.lower():
                    monsters.append(make_monster("Paralith Captain", "paralith", ol, count=1, dif=10))
                elif "paralith" in ol.lower():
                    m_cnt = 1
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    role = "Engineers" if "engineer" in ol.lower() else "Technicians"
                    label = f"{m_cnt} Paralith {role}" if m_cnt > 1 else f"1 Paralith {role[:-1]}"
                    monsters.append(make_monster(label, "paralith", ol, count=m_cnt, dif=8))
                elif "rexar" in ol.lower():
                    m_cnt = 1
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    role = "Bridge Officers" if "bridge" in ol.lower() else ("Security Officers" if "security" in ol.lower() else "Officers")
                    label = f"{m_cnt} Rexar {role}" if m_cnt > 1 else f"1 Rexar {role[:-1]}"
                    monsters.append(make_monster(label, "rexar", ol, count=m_cnt, dif=11))
                elif "whisperfur" in ol.lower():
                    m_cnt = 1
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    label = f"{m_cnt} Whisperfur Technicians" if m_cnt > 1 else "1 Whisperfur Technician"
                    monsters.append(make_monster(label, "whisperfur", ol, count=m_cnt, dif=6))
                elif "stomper" in ol.lower():
                    m_cnt = 2
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    monsters.append(make_monster(f"{m_cnt} Stomper Cargo Enforcers", "stomper", ol, count=m_cnt, dif=15))
                elif "scuttler" in ol.lower():
                    m_cnt = 6
                    cnt_match = re.search(r'(\d+)', ol)
                    if cnt_match:
                        m_cnt = int(cnt_match.group(1))
                    monsters.append(make_monster(f"{m_cnt} Scuttler Sentry Drones", "scuttler", ol, count=m_cnt, dif=10))
                    
        master_dif = 10
        if monsters:
            master_dif = max(m.get("scaled_dif", 10) for m in monsters)
            
        enc_id = f"enc_{uuid.uuid4().hex[:12]}"
        encounters.append({
            "id": enc_id,
            "title": enc_title,
            "notes": full_notes,
            "tactical_notes": full_notes,
            "master_dif": master_dif,
            "monsters": monsters,
            "links": [],
            "loot": [],
            "created_at": datetime.now().isoformat()
        })
        
    return encounters

# 7. Build All 4 Acts
act1 = {
    "id": f"act_{uuid.uuid4().hex[:12]}",
    "title": "Major Plot Elements",
    "description": "Campaign background, NPC Name Key, and overarching narrative structure from Station Dauntless to the Green Moon.",
    "encounters": act1_encounters,
    "created_at": datetime.now().isoformat()
}

act2_encounters = parse_facility_tab(tabs_text[1], 2, "XR70 Mining Facility")
act2 = {
    "id": f"act_{uuid.uuid4().hex[:12]}",
    "title": "XR70 Mining Facility",
    "description": "Infiltrating the heavily defended asteroid mining bastion to disable communications and prepare the Trojan Horse.",
    "encounters": act2_encounters,
    "created_at": datetime.now().isoformat()
}

act3_encounters = parse_facility_tab(tabs_text[2], 3, "Voidrunner Frigate")
act3 = {
    "id": f"act_{uuid.uuid4().hex[:12]}",
    "title": "Voidrunner Frigate",
    "description": "Seeding Astral Shards into shipping crates aboard the Imperial supply frigate and avoiding detection.",
    "encounters": act3_encounters,
    "created_at": datetime.now().isoformat()
}

act4_encounters = parse_facility_tab(tabs_text[3], 4, "Elmo7.2 Hydroponics Complex")
act4 = {
    "id": f"act_{uuid.uuid4().hex[:12]}",
    "title": "Elmo7.2 Hydroponics Complex",
    "description": "Hot insertion into the hydroponics moon base, overcoming the Night Viper pilots, and signaling for extraction.",
    "encounters": act4_encounters,
    "created_at": datetime.now().isoformat()
}

total_encounters = len(act1["encounters"]) + len(act2["encounters"]) + len(act3["encounters"]) + len(act4["encounters"])
total_monsters = sum(len(e["monsters"]) for act in [act1, act2, act3, act4] for e in act["encounters"])

print(f"\n=======================================================")
print(f"📊 SUMMARY OF GENERATED ADVENTURE STRUCTURE:")
print(f"  Act 1: {act1['title']} ({len(act1['encounters'])} encounters, {sum(len(e['monsters']) for e in act1['encounters'])} monsters)")
print(f"  Act 2: {act2['title']} ({len(act2['encounters'])} encounters, {sum(len(e['monsters']) for e in act2['encounters'])} monsters)")
print(f"  Act 3: {act3['title']} ({len(act3['encounters'])} encounters, {sum(len(e['monsters']) for e in act3['encounters'])} monsters)")
print(f"  Act 4: {act4['title']} ({len(act4['encounters'])} encounters, {sum(len(e['monsters']) for e in act4['encounters'])} monsters)")
print(f"  TOTAL ENCOUNTERS: {total_encounters}")
print(f"  TOTAL PRE-STAGED MONSTER SLOTS: {total_monsters}")
print(f"=======================================================")

# Print sample monster details from each act
print("\n🔎 Pre-staged Monster Verification:")
for act in [act2, act3, act4]:
    print(f"\n[{act['title']}]")
    for enc in act["encounters"]:
        if enc["monsters"]:
            print(f"  {enc['title']} (Master Dif: {enc['master_dif']}):")
            for m in enc["monsters"]:
                print(f"    - {m['nameWithEquip']} | Init: {m['fullText'][:60]}...")

# 8. Check for existing adventure in Supabase
print(f"\n🔍 Querying Supabase for existing '{ADVENTURE_TITLE}' for {GM_EMAIL}...")
check_url = f"{supabase_url}/rest/v1/adventures?gm_email=eq.{GM_EMAIL}&select=id,title"
req = urllib.request.Request(check_url, headers={
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json"
})
with urllib.request.urlopen(req) as resp:
    existing_advs = json.loads(resp.read().decode('utf-8'))

target_adv_id = None
for ea in existing_advs:
    if ea.get("title", "").strip().lower() == ADVENTURE_TITLE.lower():
        target_adv_id = ea.get("id")
        break

now_iso = datetime.now().isoformat()
adventure_payload = {
    "title": ADVENTURE_TITLE,
    "gm_email": GM_EMAIL,
    "genre": "SciFi",
    "is_active": True,
    "structure": {
        "acts": [act1, act2, act3, act4],
        "links": []
    },
    "updated_at": now_iso
}

if target_adv_id:
    print(f"🔄 Updating existing adventure ID: {target_adv_id}...")
    update_url = f"{supabase_url}/rest/v1/adventures?id=eq.{target_adv_id}"
    update_req = urllib.request.Request(
        update_url,
        data=json.dumps(adventure_payload).encode('utf-8'),
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        method="PATCH"
    )
    with urllib.request.urlopen(update_req) as resp:
        result = json.loads(resp.read().decode('utf-8'))
    print(f"✅ Successfully updated adventure: {result[0]['id']}")
else:
    print(f"✨ Creating new adventure '{ADVENTURE_TITLE}' in Supabase...")
    adventure_payload["created_at"] = now_iso
    insert_url = f"{supabase_url}/rest/v1/adventures"
    insert_req = urllib.request.Request(
        insert_url,
        data=json.dumps(adventure_payload).encode('utf-8'),
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        method="POST"
    )
    with urllib.request.urlopen(insert_req) as resp:
        result = json.loads(resp.read().decode('utf-8'))
    target_adv_id = result[0]['id']
    print(f"✅ Successfully inserted adventure ID: {target_adv_id}")

print(f"\n🎉 Seed the Empire Armada integration complete! Adventure ID: {target_adv_id}")
