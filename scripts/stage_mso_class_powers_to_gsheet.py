# C:\Repos\Projects\SupaFlex\scripts\stage_mso_class_powers_to_gsheet.py
# Phase 2 (Part 5): Translates MSO_Class_Powers into SB_Class_Powers staging tab in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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
TARGET_TAB_NAME = "SB_Class_Powers"

TARGET_HEADERS = [
    "name",
    "action",
    "usage",
    "effect",
    "category",
    "genres",
    "table_group",
    "is_guildspace_locked",
    "discipline"
]

def evaluate_class_power(name, chapter, p_type, notes):
    name_lower = name.lower()
    type_lower = p_type.lower()
    
    # 1. Action & Usage Type
    if any(kw in type_lower for kw in ['conditioning', 'procurement', 'access', 'inception', 'training', 'allowance', 'ranks', 'bonus', 'special access']):
        action = 'P'
        usage = '1-Enc'
        usage_type = 'Passive'
    elif any(kw in name_lower for kw in ['strike', 'blast', 'rend', 'smite', 'assault', 'execute', 'fury', 'burst']):
        action = 'A'
        usage = '2-Enc'
        usage_type = 'Active'
    elif any(kw in name_lower for kw in ['charge', 'sprint', 'leap', 'evade', 'retreat', 'reposition', 'stride']):
        action = 'M'
        usage = '2-Enc'
        usage_type = 'Active'
    elif any(kw in name_lower for kw in ['stance', 'focus', 'eye', 'sight', 'lock', 'aim', 'ready', 'reflex']):
        action = 'F'
        usage = '2-Enc'
        usage_type = 'Active'
    else:
        action = 'P'
        usage = '2-Enc'
        usage_type = 'Active'
        
    # 2. Discipline
    chap_lower = chapter.lower()
    if 'bio' in chap_lower:
        discipline = 'BioTech'
    elif 'cyber' in chap_lower:
        discipline = 'CyberTech'
    elif 'warlock' in chap_lower:
        discipline = 'Sorce'
    elif 'mensi' in chap_lower:
        discipline = 'Psionics'
    elif 'mutak' in chap_lower:
        discipline = 'Psychosomatics'
    else:
        discipline = 'Universal'
        
    table_group = f"DHA {chapter}"
    return action, usage, usage_type, discipline, table_group

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

    print(f"📖 Reading source class powers from MSO Stats (ID: {SOURCE_SPREADSHEET_ID})...")
    res = sheets_service.spreadsheets().values().get(
        spreadsheetId=SOURCE_SPREADSHEET_ID,
        range="MSO_Class_Powers!A1:Z110"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 9:
        print("❌ Could not read source rows from MSO_Class_Powers.")
        sys.exit(1)

    print(f"✓ Read {len(rows)} raw rows.")

    staged_powers = []
    action_counts = {}
    usage_counts = {}
    class_counts = {}

    for r in rows[8:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            continue

        name = str(r[0]).strip()
        chapter = str(r[1]).strip()
        p_type = str(r[2]).strip() if len(r) > 2 else ''
        notes = str(r[8]).strip() if len(r) > 8 else ''

        category = "Class"
        source = "Class"
        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"
        is_handicap = "FALSE"
        flaw_points = "0"

        action, usage, usage_type, discipline, table_group = evaluate_class_power(name, chapter, p_type, notes)

        action_counts[action] = action_counts.get(action, 0) + 1
        usage_counts[usage] = usage_counts.get(usage, 0) + 1
        class_counts[table_group] = class_counts.get(table_group, 0) + 1

        staged_powers.append([
            name,
            action,
            usage,
            notes,
            category,
            genres_json,
            table_group,
            is_locked,
            discipline
        ])

    print(f"\n📊 Summary of Class Powers Staged ({len(staged_powers)} items):")
    print(f"  Actions: {action_counts}")
    print(f"  Usages : {usage_counts}")
    print(f"  Classes: {class_counts}")

    # Write SB_Class_Powers
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, TARGET_TAB_NAME, TARGET_HEADERS, staged_powers)

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_powers)} Class Powers to '{TARGET_TAB_NAME}'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
