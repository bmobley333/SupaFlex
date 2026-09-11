# C:\Repos\Projects\SupaFlex\scripts\format_seed_armada_notes.py
# Formats all 61 encounter notes of "Seed the Empire Armada" in Supabase with clean visual hierarchy

import os
import sys
import json
import re
import urllib.request
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

base_dir = os.path.dirname(os.path.abspath(__file__))
supaflex_root = os.path.abspath(os.path.join(base_dir, ".."))
env_path = os.path.join(supaflex_root, "env.json")

with open(env_path, "r", encoding="utf-8") as f:
    env = json.load(f)

supabase_url = env["VITE_SUPABASE_URL"]
service_key = env["SUPABASE_SERVICE_ROLE_KEY"]

GM_EMAIL = "metascapegame@gmail.com"
ADVENTURE_TITLE = "Seed the Empire Armada"

print(f"🌌 Fetching '{ADVENTURE_TITLE}' for {GM_EMAIL} from Supabase...")
url = f"{supabase_url}/rest/v1/adventures?gm_email=eq.{GM_EMAIL}&title=eq.Seed%20the%20Empire%20Armada&select=*"
req = urllib.request.Request(url, headers={
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json"
})

with urllib.request.urlopen(req) as resp:
    advs = json.loads(resp.read().decode('utf-8'))

if not advs:
    print(f"❌ Adventure '{ADVENTURE_TITLE}' not found!")
    sys.exit(1)

adv = advs[0]
adv_id = adv["id"]
acts = adv.get("structure", {}).get("acts", [])

def format_encounter_notes(raw_notes):
    if not raw_notes or not raw_notes.strip():
        return raw_notes
        
    lines = raw_notes.splitlines()
    formatted_lines = []
    
    in_opponents = False
    
    for line in lines:
        s = line.strip()
        if not s:
            formatted_lines.append("")
            continue
            
        if s == "---":
            formatted_lines.append("---")
            in_opponents = False
            continue
            
        # Section titles
        if s in ["Room Description:", "Tactical Encounter Notes:"]:
            formatted_lines.append(s)
            in_opponents = False
            continue
            
        # Main keywords
        kw_match = re.match(r'^(?:[•\-\*]\s*)?(Scene|GM Notes|Objective|Opponents|Reward|Treasure|Trap|Puzzle|Special|Puzzle / Trap / Reward):\s*(.*)$', s, re.IGNORECASE)
        if kw_match:
            kw = kw_match.group(1).strip()
            rest = kw_match.group(2).strip()
            if kw.lower() == "opponents":
                formatted_lines.append(f"• {kw}:")
                in_opponents = True
            else:
                formatted_lines.append(f"• {kw}: {rest}" if rest else f"• {kw}:")
                in_opponents = False
            continue
            
        # If inside Opponents block, format monster sub-lines with indentation
        mon_match = re.match(r'^(?:[•\-\*○]\s*)?(\d+(?:-\d+)?\s+[A-Za-z0-9 \'–\-]+(?:\([^\)]+\))?|Station Commander Klyss[^\:]*|Overseer Ketone[^\:]*|Paralith Captain):\s*(.*)$', s)
        if mon_match:
            m_name = mon_match.group(1).strip()
            m_rest = mon_match.group(2).strip()
            formatted_lines.append(f"  - {m_name}: {m_rest}")
            continue
            
        # If in opponents but doesn't match monster pattern, check if it's a Trap/Treasure tag
        if in_opponents and any(s.startswith(t) for t in ["Trap:", "Treasure:", "Reward:", "Puzzle:", "Special:"]):
            formatted_lines.append(f"• {s}")
            in_opponents = False
            continue
            
        formatted_lines.append(s)
        
    # Collapse multiple consecutive blank lines to at most 1
    cleaned = []
    prev_blank = False
    for fl in formatted_lines:
        if fl == "":
            if not prev_blank:
                cleaned.append("")
            prev_blank = True
        else:
            cleaned.append(fl)
            prev_blank = False
            
    return "\n".join(cleaned).strip()

enc_count = 0
for act in acts:
    for enc in act.get("encounters", []):
        raw_notes = enc.get("notes") or enc.get("tactical_notes") or ""
        formatted = format_encounter_notes(raw_notes)
        enc["notes"] = formatted
        enc["tactical_notes"] = formatted
        enc_count += 1

print(f"✅ Formatted notes across all {enc_count} encounters.")

# Upsert back to Supabase
now_iso = datetime.now().isoformat()
payload = {
    "structure": adv["structure"],
    "updated_at": now_iso
}

patch_url = f"{supabase_url}/rest/v1/adventures?id=eq.{adv_id}"
patch_req = urllib.request.Request(
    patch_url,
    data=json.dumps(payload).encode('utf-8'),
    headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    },
    method="PATCH"
)

with urllib.request.urlopen(patch_req) as resp:
    res = json.loads(resp.read().decode('utf-8'))

print(f"🎉 Successfully updated notes in Supabase for adventure ID: {res[0]['id']}")
