# C:\Repos\Projects\SupaFlex\scripts\stage_mso_gear_and_hardware_to_gsheet.py
# Phase 2 (Part 3): Translates MSO_Gear_&_Devices into SB_Gear and SB_Hardware staging tabs in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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

SOURCE_SPREADSHEET_ID = "1LvnISer4vPJOFmkmZGEluc0_ZcKJDSk5Yg3hQLHFVg8"
TARGET_SPREADSHEET_ID = "1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4"

GEAR_HEADERS = [
    "category",
    "name",
    "cost",
    "notes",
    "genres",
    "is_guildspace_locked",
    "discipline",
    "table_group",
    "compatible_with"
]

HARDWARE_HEADERS = [
    "name",
    "category",
    "tier",
    "action",
    "usage",
    "cost",
    "effect",
    "notes",
    "genres",
    "is_guildspace_locked",
    "discipline",
    "table_group",
    "compatible_with"
]

def parse_cost(cost_str):
    if not cost_str:
        return '0g'
    if 'artf' in str(cost_str).lower():
        return 'Artifact'
    clean = re.sub(r'[^\d]', '', str(cost_str))
    if not clean:
        return '0g'
    c = int(clean)
    g = c // 100
    s = c % 100
    if g > 0 and s > 0:
        return f"{g}g {s}s"
    elif g > 0:
        return f"{g}g"
    elif s > 0:
        return f"{s}s"
    return '0g'

def determine_hardware_tier(name, cat, subcat, req, cost_str, notes):
    name_lower = name.lower()
    sub_lower = subcat.lower()
    notes_lower = notes.lower()
    cost_clean = re.sub(r'[^\d]', '', str(cost_str))
    cost_val = int(cost_clean) if cost_clean else 0
    is_artf = 'artf' in str(cost_str).lower() or 'artifact' in sub_lower or 'artifact' in notes_lower
    
    # Cyber-Eye Upgrades are light modular attachments -> Minor
    if 'upgrade' in name_lower and cost_val <= 150:
        return 'Minor'
        
    if is_artf or any(kw in name_lower for kw in ['dimensional', 'static bar', 'quantum']):
        return 'Epic'
    elif cost_val >= 750 or any(kw in name_lower for kw in ['endoskeleton', 'couplink', 'tish-shock', 'personal transporter', 'hover pod', 'turbo pack']):
        return 'Greater'
    elif cost_val >= 250 or any(kw in name_lower for kw in ['targeter', 'scanner', 'cyber-arm', 'cyber-eye', 'cyber-legs', 'joint', 'survival shield', 'breather', 'feeder', 'phase deviator', 'transportal', 'qa forearm', 'jump-pack', 'medikit']):
        return 'Lesser'
    else:
        return 'Minor'

def determine_action_and_usage(name, subcat, tier):
    name_lower = name.lower()
    sub_lower = subcat.lower()
    
    # Passives / Implants
    if any(kw in sub_lower for kw in ['implant', 'skeletal', 'power storage', 'power source', 'storage', 'upgrade']) or any(kw in name_lower for kw in ['endoskeleton', 'joint', 'ear', 'thermoplas', 'plating', 'clip', 'pack', 'eye']):
        return 'P', 'Constant'
    elif any(kw in name_lower for kw in ['transporter', 'phase deviator', 'jump-pack', 'turbo pack', 'transportal', 'miniflare', 'grapple']):
        return 'A', 'At-Will'
    elif any(kw in name_lower for kw in ['scanner', 'targeter', 'sensor', 'biometer', 'bionocular']):
        return 'A', 'Constant'
    else:
        return 'P', 'Constant'

def write_and_format_tab(sheets_service, spreadsheet_id, tab_name, headers, data_rows):
    print(f"\n🎯 Preparing target tab '{tab_name}' in sheet {spreadsheet_id}...")
    target_meta = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    existing_sheets = {s['properties']['title']: s['properties']['sheetId'] for s in target_meta.get('sheets', [])}

    if tab_name in existing_sheets:
        sheet_id = existing_sheets[tab_name]
        print(f"  Tab '{tab_name}' exists (Sheet ID: {sheet_id}). Clearing existing contents...")
        sheets_service.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id,
            range=f"{tab_name}!A1:Z500"
        ).execute()
    else:
        print(f"  Creating new tab '{tab_name}' in target sheet...")
        add_res = sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "requests": [
                    {
                        "addSheet": {
                            "properties": {
                                "title": tab_name,
                                "gridProperties": {
                                    "frozenRowCount": 1
                                }
                            }
                        }
                    }
                ]
            }
        ).execute()
        sheet_id = add_res['replies'][0]['addSheet']['properties']['sheetId']
        print(f"  ✅ Tab '{tab_name}' created (Sheet ID: {sheet_id}).")

    all_values = [headers] + data_rows
    print(f"📝 Writing {len(all_values)} rows to '{tab_name}'...")
    sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"{tab_name}!A1",
        valueInputOption="RAW",
        body={"values": all_values}
    ).execute()

    print(f"🎨 Applying professional styling to '{tab_name}'...")
    format_requests = [
        # Format Header Row: Dark Slate background, white bold text, center align
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": len(headers)
                },
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": {"red": 0.12, "green": 0.16, "blue": 0.22},
                        "textFormat": {"bold": True, "foregroundColor": {"red": 1.0, "green": 0.85, "blue": 0.4}},
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE"
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
            }
        },
        # Freeze top row
        {
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {
                        "frozenRowCount": 1
                    }
                },
                "fields": "gridProperties.frozenRowCount"
            }
        },
        # Auto-resize columns
        {
            "autoResizeDimensions": {
                "dimensions": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": len(headers)
                }
            }
        }
    ]

    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": format_requests}
    ).execute()
    print(f"✅ Finished formatting '{tab_name}'.")

def main():
    print("🔌 Authenticating with Google Sheets API via metascapegame credentials...")
    creds = drive_helper.get_credentials("metascapegame")
    if not creds:
        print("❌ Failed to obtain metascapegame credentials.")
        sys.exit(1)

    sheets_service = build('sheets', 'v4', credentials=creds)

    print(f"📖 Reading source rows from MSO Stats (ID: {SOURCE_SPREADSHEET_ID})...")
    res = sheets_service.spreadsheets().values().get(
        spreadsheetId=SOURCE_SPREADSHEET_ID,
        range="MSO_Gear_&_Devices!A1:Z120"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 8:
        print("❌ Could not read source rows from MSO_Gear_&_Devices.")
        sys.exit(1)

    print(f"✓ Read {len(rows)} raw rows from MSO_Gear_&_Devices.")

    staged_gear = []
    staged_hardware = []

    for r in rows[7:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1] and not r[2]):
            continue
        if 'No non-weapon' in r[0]:
            continue

        name = str(r[0]).strip()
        tag = str(r[1]).strip() if len(r) > 1 else ''
        cat = str(r[2]).strip() if len(r) > 2 else 'Tech'
        subcat = str(r[3]).strip() if len(r) > 3 else ''
        req = str(r[4]).strip() if len(r) > 4 else ''
        cost_raw = str(r[5]).strip() if len(r) > 5 else ''
        notes = str(r[9]).strip() if len(r) > 9 else ''

        cat_lower = cat.lower()
        sub_lower = subcat.lower()
        cost_str = parse_cost(cost_raw)

        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"

        # Check Column B "Gear/Device" tag
        if tag.lower() == 'gear':
            # Routes to SB_Gear
            gear_cat = subcat if subcat and subcat != '—' else 'General'
            discipline = 'Tech' if 'tech' in cat_lower else 'BioTech'
            table_group = 'Tech Gear' if discipline == 'Tech' else 'Bio Gear'
            compat = 'universal'

            staged_gear.append([
                gear_cat,
                name,
                cost_str,
                notes,
                genres_json,
                is_locked,
                discipline,
                table_group,
                compat
            ])
        else:
            # Routes to SB_Hardware
            if 'bio' in cat_lower:
                discipline = 'BioTech'
                table_group = 'BioTech Hardware'
                compat = 'universal'
                hw_cat = 'BioTech Hardware'
            elif 'cyber' in cat_lower:
                discipline = 'CyberTech'
                table_group = 'CyberTech Hardware'
                compat = 'cyberware'
                hw_cat = 'CyberTech Hardware'
            else:
                discipline = 'Tech'
                if 'artf' in cost_raw.lower() or 'artifact' in sub_lower or 'artifact' in notes.lower():
                    table_group = 'Artifact Devices'
                    hw_cat = 'Artifact Hardware'
                else:
                    table_group = 'Tech Hardware'
                    hw_cat = 'Tech Hardware'
                compat = 'universal'

            tier = determine_hardware_tier(name, cat, subcat, req, cost_raw, notes)
            action, usage = determine_action_and_usage(name, subcat, tier)

            # Generate concise effect summary from notes if available
            first_sentence = notes.split('.')[0] + '.' if notes and '.' in notes else notes[:80]
            effect_str = first_sentence.strip()

            staged_hardware.append([
                name,
                hw_cat,
                tier,
                action,
                usage,
                cost_str,
                effect_str,
                notes,
                genres_json,
                is_locked,
                discipline,
                table_group,
                compat
            ])

    print(f"✓ Converted {len(staged_gear)} Gear items and {len(staged_hardware)} Hardware items.")

    # Write SB_Gear
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, "SB_Gear", GEAR_HEADERS, staged_gear)

    # Write SB_Hardware
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, "SB_Hardware", HARDWARE_HEADERS, staged_hardware)

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_gear)} Gear to 'SB_Gear' and {len(staged_hardware)} Hardware to 'SB_Hardware'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
