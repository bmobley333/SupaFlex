# C:\Repos\Projects\SupaFlex\scripts\stage_mso_sorpsi_powers_to_gsheet.py
# Phase 2 (Part 4): Translates MSO_Sorce_Psionics_Psychosomatics into SB_SorPsiPsy_Powers staging tab in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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
TARGET_TAB_NAME = "SB_SorPsiPsy_Powers"

TARGET_HEADERS = [
    "name",
    "action",
    "usage",
    "effect",
    "category",
    "genres",
    "table_group",
    "is_guildspace_locked",
    "usage_type",
    "source",
    "discipline",
    "is_handicap",
    "flaw_points"
]

def map_sorpsi_power(name, cat, subcat, mso_act, mso_dur, notes):
    name_lower = name.lower()
    
    # 1. Core Skills
    if 'core skill' in subcat.lower() or ':' in name:
        return 'P', '1-Enc', 'Passive'
        
    # 2. AM: Attack + Move or Major reality power
    if any(kw in name_lower for kw in ['teleport', 'displace group', 'ghost walk']):
        return 'AM', '1- ⚡', 'Active'
        
    # 3. A: Attack or Heal strictly
    if any(kw in name_lower for kw in ['blast', 'blow', 'death blow', 'electric palm', 'power punch', 'death ray', 'energy bolt', 'shockblast', 'life drain', 'vampire touch', 'choke', 'rend', 'shove', 'punch', 'body heal', 'healing', 'heal all', 'light healing', 'life balance', 'vitalize']):
        if any(kw in name_lower for kw in ['death ray', 'heal all', 'shockblast', 'death blow', 'life drain', 'blast']):
            return 'A', '1-Enc', 'Active'
        else:
            return 'A', '2-Enc', 'Active'
            
    # 4. M: Movement
    if any(kw in name_lower for kw in ['hurl', 'landing', 'jump', 'speed', 'displace', 'levitate self', 'levitate other']):
        if any(kw in name_lower for kw in ['landing', 'displace']):
            return 'M', '1-Enc', 'Active'
        else:
            return 'M', '2-Enc', 'Active'
            
    # 5. F: Free Action
    if any(kw in name_lower for kw in ['shield', 'flash']):
        return 'F', '2-Enc', 'Active'
        
    # 6. P: Small Action
    if any(kw in name_lower for kw in ['immortal stance', 'encase', 'radiate fear', 'sorce field', 'molecular diffusion']):
        return 'P', '1-Enc', 'Active'
    else:
        return 'P', '2-Enc', 'Active'

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

    print(f"📖 Reading source powers from MSO Stats (ID: {SOURCE_SPREADSHEET_ID})...")
    res = sheets_service.spreadsheets().values().get(
        spreadsheetId=SOURCE_SPREADSHEET_ID,
        range="MSO_Sorce_Psionics_Psychosomatics!A1:Z90"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 7:
        print("❌ Could not read source rows from MSO_Sorce_Psionics_Psychosomatics.")
        sys.exit(1)

    print(f"✓ Read {len(rows)} raw rows.")

    staged_powers = []
    action_counts = {}
    usage_counts = {}

    for r in rows[6:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            continue

        name = str(r[0]).strip()
        cat = str(r[1]).strip()
        subcat = str(r[2]).strip() if len(r) > 2 else ''
        mso_act = str(r[6]).strip() if len(r) > 6 else ''
        mso_dur = str(r[7]).strip() if len(r) > 7 else ''
        notes = str(r[9]).strip() if len(r) > 9 else ''

        # Map Discipline & Table Group
        discipline = cat
        table_group = cat
        category = "Discipline"
        source = "Discipline"
        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"
        is_handicap = "FALSE"
        flaw_points = "0"

        action, usage, usage_type = map_sorpsi_power(name, cat, subcat, mso_act, mso_dur, notes)

        action_counts[action] = action_counts.get(action, 0) + 1
        usage_counts[usage] = usage_counts.get(usage, 0) + 1

        staged_powers.append([
            name,
            action,
            usage,
            notes,
            category,
            genres_json,
            table_group,
            is_locked,
            usage_type,
            source,
            discipline,
            is_handicap,
            flaw_points
        ])

    print(f"\n📊 Summary of Powers Staged ({len(staged_powers)} items):")
    print(f"  Actions: {action_counts}")
    print(f"  Usages : {usage_counts}")

    # Write SB_SorPsiPsy_Powers
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, TARGET_TAB_NAME, TARGET_HEADERS, staged_powers)

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_powers)} Powers to '{TARGET_TAB_NAME}'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
