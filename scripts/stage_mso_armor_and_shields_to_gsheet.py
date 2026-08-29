# C:\Repos\Projects\SupaFlex\scripts\stage_mso_armor_and_shields_to_gsheet.py
# Phase 2 (Part 2): Translates MSO_Armor and MSO_Shield into SB_Armor and SB_Shield staging tabs in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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

ARMOR_HEADERS = [
    "name",
    "requirement",
    "ar",
    "mr",
    "cost",
    "notes",
    "genres",
    "is_guildspace_locked",
    "discipline",
    "table_group"
]

SHIELD_HEADERS = [
    "name",
    "requirement",
    "max_block",
    "mr",
    "cost",
    "notes",
    "genres",
    "is_guildspace_locked",
    "discipline",
    "table_group"
]

def parse_cost(cost_str):
    if not cost_str:
        return '0g'
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

ARMOR_SCHEDULE = {
    4:  ('💪 4',  '🧥4',  '👣12'),
    6:  ('💪 6',  '🧥6',  '👣11'),
    8:  ('💪 8',  '🧥8',  '👣10'),
    10: ('💪 10', '🧥10', '👣9'),
    12: ('💪 12', '🧥12', '👣8')
}

SHIELD_SCHEDULE = {
    4:  ('💪 4',  '🛡️12', '👣0'),
    6:  ('💪 6',  '🛡️16', '👣-1'),
    8:  ('💪 8',  '🛡️20', '👣-2'),
    10: ('💪 10', '🛡️24', '👣-3'),
    12: ('💪 12', '🛡️28', '👣-4')
}

def determine_armor_tier(name, cat, subcat, mso_ar):
    ar_num = 0
    clean_ar = re.search(r'\d+', str(mso_ar))
    if clean_ar:
        ar_num = int(clean_ar.group(0))
        
    name_lower = name.lower()
    
    # Destron / Assault
    if 'destron' in name_lower or 'assault' in name_lower:
        return 12
    elif ar_num >= 20 or 'power frame' in name_lower or 'calemora plate' in name_lower or 'carapace' in name_lower:
        return 10
    elif ar_num >= 10 or 'chain' in name_lower or 'marine' in name_lower or 'trooper' in name_lower or 'spider' in name_lower or 'expedition' in name_lower:
        return 8
    elif ar_num >= 5 or 'flak' in name_lower or 'leaf' in name_lower or 'scout' in name_lower or 'space suit' in name_lower or 'husk' in name_lower or 'breastplate' in name_lower:
        return 6
    else:
        return 4

def determine_shield_tier(name, cat, mso_ar):
    ar_num = 0
    clean_ar = re.search(r'\d+', str(mso_ar))
    if clean_ar:
        ar_num = int(clean_ar.group(0))
        
    name_lower = name.lower()
    
    if 'tower' in name_lower or 'pff 6' in name_lower or ar_num >= 18:
        return 10
    elif 'pff 5' in name_lower or ar_num >= 14:
        return 8
    elif 'heater' in name_lower or 'power shield' in name_lower or 'pff 3' in name_lower or ar_num >= 6:
        return 6
    else:
        return 4

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

    # 1. Process MSO_Armor
    print(f"\n📖 Reading source armor from MSO Stats (ID: {SOURCE_SPREADSHEET_ID})...")
    res_armor = sheets_service.spreadsheets().values().get(
        spreadsheetId=SOURCE_SPREADSHEET_ID,
        range="MSO_Armor!A1:Z60"
    ).execute()
    rows_armor = res_armor.get('values', [])
    
    staged_armor = []
    for r in rows_armor[7:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            continue
            
        a_name = str(r[0]).strip()
        cat = str(r[1]).strip() if len(r) > 1 else 'Tech'
        subcat = str(r[2]).strip() if len(r) > 2 else ''
        cost_raw = str(r[4]).strip() if len(r) > 4 else ''
        mso_ar = str(r[8]).strip() if len(r) > 8 else ''
        notes_raw = str(r[11]).strip() if len(r) > 11 else ''

        cat_lower = cat.lower()
        sub_lower = subcat.lower()
        name_lower = a_name.lower()

        # Determine Discipline & Table Group
        if 'bio' in cat_lower:
            discipline = 'BioTech'
            table_group = 'Bio Armor'
            compat = 'universal'
        elif 'cyber' in cat_lower:
            discipline = 'CyberTech'
            table_group = 'Cyber Armor'
            compat = 'cyberware'
        elif 'archaic' in cat_lower:
            discipline = 'Archaic'
            table_group = 'Archaic Armor'
            compat = 'universal'
        else:
            discipline = 'Tech'
            if 'destron' in name_lower or 'power frame' in name_lower or 'assault' in name_lower:
                table_group = 'Powered Suits'
                compat = 'powered_armor'
            else:
                table_group = 'Tech Armor'
                compat = 'universal'

        tier = determine_armor_tier(a_name, cat, subcat, mso_ar)
        req_str, ar_str, mr_str = ARMOR_SCHEDULE[tier]
        cost_str = parse_cost(cost_raw)

        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"

        staged_armor.append([
            a_name,
            req_str,
            ar_str,
            mr_str,
            cost_str,
            notes_raw,
            genres_json,
            is_locked,
            discipline,
            table_group
        ])

    print(f"✓ Converted {len(staged_armor)} armor items.")
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, "SB_Armor", ARMOR_HEADERS, staged_armor)

    # 2. Process MSO_Shield
    print(f"\n📖 Reading source shields from MSO Stats (ID: {SOURCE_SPREADSHEET_ID})...")
    res_shield = sheets_service.spreadsheets().values().get(
        spreadsheetId=SOURCE_SPREADSHEET_ID,
        range="MSO_Shield!A1:Z30"
    ).execute()
    rows_shield = res_shield.get('values', [])
    
    staged_shields = []
    for r in rows_shield[7:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            continue
            
        s_name = str(r[0]).strip()
        cat = str(r[1]).strip() if len(r) > 1 else 'Tech'
        subcat = str(r[2]).strip() if len(r) > 2 else ''
        cost_raw = str(r[4]).strip() if len(r) > 4 else ''
        mso_ar = str(r[8]).strip() if len(r) > 8 else ''
        notes_raw = str(r[11]).strip() if len(r) > 11 else ''

        cat_lower = cat.lower()
        if 'archaic' in cat_lower:
            discipline = 'Archaic'
            table_group = 'Archaic Shields'
        else:
            discipline = 'Tech'
            table_group = 'Tech Shields'

        tier = determine_shield_tier(s_name, cat, mso_ar)
        req_str, blk_str, mr_str = SHIELD_SCHEDULE[tier]
        cost_str = parse_cost(cost_raw)

        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"

        staged_shields.append([
            s_name,
            req_str,
            blk_str,
            mr_str,
            cost_str,
            notes_raw,
            genres_json,
            is_locked,
            discipline,
            table_group
        ])

    print(f"✓ Converted {len(staged_shields)} shield items.")
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, "SB_Shield", SHIELD_HEADERS, staged_shields)

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_armor)} Armor to 'SB_Armor' and {len(staged_shields)} Shields to 'SB_Shield'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
