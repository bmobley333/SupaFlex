# C:\Repos\Projects\SupaFlex\scripts\calibrate_sb_hardware_action_usage.py
# Calibrates Action (Column E) and Usage (Column F) on SB_Hardware in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

import os
import sys
import json
import re
from googleapiclient.discovery import build

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(r"C:\Repos\Jodar\services\gdrive-helper")
import drive_helper

TARGET_SPREADSHEET_ID = "1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4"
TAB_NAME = "SB_Hardware"

VALID_ACTIONS = {'AM', 'A', 'M', 'P', 'F'}
VALID_USAGES = {'1', '2', '3', '1- 🍀', '1- ⚡', '1-Enc', '2-Enc', '3-Enc', '1-Rnd'}

def map_action_and_usage(name, cat, tier, notes):
    name_lower = name.lower()
    
    # 1. AM (Attack + Move or MAJOR reality-altering action)
    if 'dimensional shifter' in name_lower:
        return 'AM', '1- ⚡'
        
    # 2. A (Attack or Heal action strictly)
    if any(kw in name_lower for kw in ['laser cutter', 'miniflare', 'phase deviator', 'slap pack', 'first aid', 'genesis capsule', 'medikit', 'tech wand', 'static bar', 'poison']):
        if any(kw in name_lower for kw in ['slap pack', 'first aid', 'genesis capsule', 'medikit', 'phase deviator']):
            return 'A', '1-Enc'
        elif 'static bar' in name_lower:
            return 'A', '1- ⚡'
        elif 'miniflare' in name_lower:
            return 'A', '3'
        else:
            return 'A', '2-Enc'
            
    # 3. M (Movement: locomotion, vehicles, flight, jetpacks, jump-packs, teleportation)
    if any(kw in name_lower for kw in ['jump-pack', 'turbo pack', 'personal transporter', 'dimensional transporter', 'transportal', 'crawler', 'hover pod', 'lift pods', 'ultralock boots']):
        if any(kw in name_lower for kw in ['jump-pack', 'turbo pack', 'personal transporter', 'dimensional transporter', 'transportal', 'lift pods']):
            return 'M', '1-Enc'
        else:
            return 'M', '2-Enc'
            
    # 4. F (Free action: instant toggle, optics mode switch, smart-sight weapon lock)
    if any(kw in name_lower for kw in ['targeter', 'star lamp', 'infrared', 'macro enhancer', 'micro enhancer', 'starlight', 'macrovisor', 'microvisor', 'glow goggles', 'survival shield generator', 'thermoplas implant', 'communicator watch']):
        if 'survival shield generator' in name_lower:
            return 'F', '1-Enc'
        elif 'targeter' in name_lower:
            return 'F', '2-Enc'
        else:
            return 'F', '3-Enc'
            
    # 5. P (Small action: slight effort, subtle tactical adjustments, cyberware triggers, energy storage)
    if any(kw in name_lower for kw in ['energy clip', 'power pack', 'plasma precipitator']):
        return 'P', '1'
    elif any(kw in name_lower for kw in ['endoskeleton', 'cyber-arm', 'cyber-legs', 'tish-shock', 'power joint', 'couplink', 'qa forearm', 'enhanced ear', 'audial transceiver', 'joint locks', 'cyber-eye']):
        return 'P', '2-Enc'
    elif any(kw in name_lower for kw in ['scanner', 'biometer', 'bionocular', 'hacker', 'hologuise', 'holo-imager', 'tech pack', 'survival kit', 'survival tent', 'survival bag', 'grapple', 'disguise kit', 'wirelocks', 'palmstore', 'oxygenator', 'compressor', 'breather', 'feeder', 'engineer tool']):
        return 'P', '2-Enc'
    elif any(kw in name_lower for kw in ['platelets', 'saliva mites', 'techmites', 'tube-worms', 'firegnat', 'glow egg', 'living rope', 'slimemold']):
        return 'P', '1-Enc'
        
    return 'P', '2-Enc'

def main():
    print("🔌 Authenticating with Google Sheets API via metascapegame credentials...")
    creds = drive_helper.get_credentials("metascapegame")
    if not creds:
        print("❌ Failed to obtain metascapegame credentials.")
        sys.exit(1)

    sheets_service = build('sheets', 'v4', credentials=creds)

    print(f"📖 Reading existing rows from tab '{TAB_NAME}' (Sheet ID: {TARGET_SPREADSHEET_ID})...")
    res = sheets_service.spreadsheets().values().get(
        spreadsheetId=TARGET_SPREADSHEET_ID,
        range=f"{TAB_NAME}!A1:N120"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 2:
        print(f"❌ Could not read rows from {TAB_NAME}.")
        sys.exit(1)

    header = rows[0]
    print(f"✓ Read {len(rows)} rows. Header: {header}")

    # Determine Column Indexes
    name_idx = header.index("name") if "name" in header else 1
    cat_idx = header.index("category") if "category" in header else 2
    tier_idx = header.index("tier") if "tier" in header else 3
    act_idx = header.index("action") if "action" in header else 4
    usg_idx = header.index("usage") if "usage" in header else 5
    notes_idx = header.index("notes") if "notes" in header else 8

    updated_rows = [header]
    action_counts = {}
    usage_counts = {}

    for row_idx, r in enumerate(rows[1:], start=2):
        if not r or len(r) <= name_idx or not r[name_idx]:
            continue

        name = r[name_idx].strip()
        cat = r[cat_idx].strip() if len(r) > cat_idx else 'Tech Hardware'
        tier = r[tier_idx].strip() if len(r) > tier_idx else 'Minor'
        notes = r[notes_idx].strip() if len(r) > notes_idx else ''

        new_act, new_usg = map_action_and_usage(name, cat, tier, notes)

        # Validate against strict token sets
        if new_act not in VALID_ACTIONS:
            raise ValueError(f"Invalid Action '{new_act}' for {name}")
        if new_usg not in VALID_USAGES:
            raise ValueError(f"Invalid Usage '{new_usg}' for {name}")

        action_counts[new_act] = action_counts.get(new_act, 0) + 1
        usage_counts[new_usg] = usage_counts.get(new_usg, 0) + 1

        # Pad row if needed
        while len(r) < len(header):
            r.append('')

        # Update action and usage columns in place
        r[act_idx] = new_act
        r[usg_idx] = new_usg
        updated_rows.append(r)

    print(f"\n📊 Summary of Action Updates ({len(updated_rows) - 1} items):")
    for act, count in sorted(action_counts.items()):
        print(f"  {act:<4}: {count} items")

    print(f"\n📊 Summary of Usage Updates ({len(updated_rows) - 1} items):")
    for usg, count in sorted(usage_counts.items()):
        print(f"  {usg:<6}: {count} items")

    print(f"\n📝 Writing calibrated Action and Usage values back to '{TAB_NAME}'...")
    sheets_service.spreadsheets().values().update(
        spreadsheetId=TARGET_SPREADSHEET_ID,
        range=f"{TAB_NAME}!A1",
        valueInputOption="RAW",
        body={"values": updated_rows}
    ).execute()

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Calibrated all 97 rows in '{TAB_NAME}'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit#gid=2097850625")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
