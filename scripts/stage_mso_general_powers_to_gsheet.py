# C:\Repos\Projects\SupaFlex\scripts\stage_mso_general_powers_to_gsheet.py
# Phase 2 (Part 6): Filters and translates general powers from MSO_General_Skills_&_Powers into SB_Gen_Powers in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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
TARGET_TAB_NAME = "SB_Gen_Powers"

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

def evaluate_gen_power(name, classification, notes):
    name_lower = name.lower()
    class_lower = classification.lower()
    notes_lower = notes.lower()
    
    # 1. Action & Usage Type
    # A: Attack or Heal strictly
    if any(kw in name_lower for kw in ['strike', 'disarm', 'knockout', 'sweep', 'penetration', 'anti-vehicle', 'crushing damage', 'power attack', 'precision strike', 'rending', 'vital strike', 'headshot']):
        action = 'A'
        usage = '2-Enc'
        usage_type = 'Active'
    # F: Free Action (reaction defense, stances, instant triggers)
    elif any(kw in name_lower for kw in ['aiming bonus', 'block ranged', 'catch ranged', 'quick draw', 'feint', 'danger sense', 'reflex', 'reaction', 'deflection', 'intercept']):
        action = 'F'
        usage = '2-Enc'
        usage_type = 'Active'
    # M: Movement
    elif any(kw in name_lower for kw in ['tumble', 'sprint', 'leap', 'evade', 'mobility', 'reposition']):
        action = 'M'
        usage = '2-Enc'
        usage_type = 'Active'
    # AM: Attack + Move
    elif any(kw in name_lower for kw in ['charge', 'spring attack', 'flyby']):
        action = 'AM'
        usage = '1-Enc'
        usage_type = 'Active'
    # P: Passive perks / Small Actions
    else:
        action = 'P'
        if any(kw in class_lower for kw in ['physical', 'mental', 'social', 'survival', 'defensive', 'sensory', 'economic']) and not any(kw in name_lower for kw in ['berserk', 'focus', 'rally']):
            usage = '1-Enc'
            usage_type = 'Passive'
        else:
            usage = '2-Enc'
            usage_type = 'Active'
            
    # 2. Table Group & Discipline
    if 'combat' in class_lower or 'weapon' in class_lower:
        table_group = 'Combat Enhancement'
        discipline = 'Martial'
    elif 'physical' in class_lower:
        table_group = 'Physical Enhancement'
        discipline = 'Physical'
    elif 'mental' in class_lower or 'sensory' in class_lower:
        table_group = 'Mental Enhancement'
        discipline = 'Mental'
    elif 'social' in class_lower or 'economic' in class_lower:
        table_group = 'Social Enhancement'
        discipline = 'Social'
    else:
        table_group = 'Technical Enhancement'
        discipline = 'Tech'
        
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

    print(f"📖 Reading source rows from MSO Stats (ID: {SOURCE_SPREADSHEET_ID})...")
    res = sheets_service.spreadsheets().values().get(
        spreadsheetId=SOURCE_SPREADSHEET_ID,
        range="MSO_General_Skills_&_Powers!A1:Z150"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 8:
        print("❌ Could not read source rows from MSO_General_Skills_&_Powers.")
        sys.exit(1)

    print(f"✓ Read {len(rows)} raw rows.")

    staged_powers = []
    action_counts = {}
    usage_counts = {}
    table_counts = {}
    type_counts = {}
    skipped_skills = 0

    for r in rows[7:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            continue

        name = str(r[0]).strip()
        cat = str(r[1]).strip()
        subcat = str(r[2]).strip() if len(r) > 2 else ''
        notes = str(r[7]).strip() if len(r) > 7 else ''

        # Filter strictly on Column B Category == 'Power'
        if cat.lower() != 'power':
            skipped_skills += 1
            continue

        category = "General"
        source = "General"
        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"
        is_handicap = "FALSE"
        flaw_points = "0"

        action, usage, usage_type, discipline, table_group = evaluate_gen_power(name, subcat, notes)

        action_counts[action] = action_counts.get(action, 0) + 1
        usage_counts[usage] = usage_counts.get(usage, 0) + 1
        table_counts[table_group] = table_counts.get(table_group, 0) + 1
        type_counts[usage_type] = type_counts.get(usage_type, 0) + 1

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

    print(f"\n📊 Summary of General Powers Staged ({len(staged_powers)} items, {skipped_skills} skills ignored):")
    print(f"  Actions: {action_counts}")
    print(f"  Usages : {usage_counts}")
    print(f"  Types  : {type_counts}")
    print(f"  Tables : {table_counts}")

    # Write SB_Gen_Powers
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, TARGET_TAB_NAME, TARGET_HEADERS, staged_powers)

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_powers)} General Powers to '{TARGET_TAB_NAME}'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
