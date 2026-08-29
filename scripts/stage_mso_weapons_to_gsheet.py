# C:\Repos\Projects\SupaFlex\scripts\stage_mso_weapons_to_gsheet.py
# Phase 2 (Part 1): Translates MSO_Weapons into the SB_Weapons staging tab in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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
TARGET_TAB_NAME = "SB_Weapons"

TARGET_HEADERS = [
    "name",
    "type",
    "requirement",
    "atk",
    "dmg",
    "max_block",
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

def parse_range(range_val, weapon_type, weapon_name):
    r_str = str(range_val).strip() if range_val else ''
    name_lower = weapon_name.lower()
    
    # Touch checks for unarmed / touch cyberware
    if name_lower in ['punch', 'grab', 'bite', 'kick', 'stem jaw']:
        return 'Touch'
        
    if not r_str or r_str == '—' or r_str == '-' or r_str == '':
        return '1sq' if weapon_type == 'Melee' else 'Short'
        
    if r_str.lower().startswith('spec'):
        return 'Special'
        
    clean_num_match = re.search(r'\d+', r_str)
    if clean_num_match:
        val = int(clean_num_match.group(0))
        if val <= 1:
            return '1sq'
        elif val <= 2 and weapon_type == 'Melee':
            return '2sq'
        elif val <= 10:
            return 'Short'
        elif val <= 40:
            return 'Medium'
        else:
            return 'Long'
            
    return r_str

def parse_requirement_and_block(w_type, sci_req, atk_base, subcat, weapon_name):
    # Determine base die requirement: 4, 6, 8, 10, 12
    req_num = 6 # Default balanced medium
    
    sci_match = re.search(r'\d+', str(sci_req))
    if sci_match:
        val = int(sci_match.group(0))
        if val <= 6:
            req_num = 4 if val <= 4 else 6
        elif val <= 8:
            req_num = 8
        elif val <= 10:
            req_num = 10
        else:
            req_num = 12
    else:
        # Fallback to atk_base penalty (e.g. -4d -> Req 10, -5d -> Req 12)
        penalty_match = re.search(r'-(\d+)d', str(atk_base))
        if penalty_match:
            pen = int(penalty_match.group(1))
            if pen <= 1:
                req_num = 4
            elif pen == 2:
                req_num = 6
            elif pen == 3:
                req_num = 8
            elif pen == 4:
                req_num = 10
            elif pen >= 5:
                req_num = 12
        else:
            sub_lower = subcat.lower()
            if 'light' in sub_lower:
                req_num = 4
            elif 'medium' in sub_lower:
                req_num = 6
            elif 'heavy' in sub_lower:
                req_num = 10

    # Max block map for Melee
    block_map = {4: '8', 6: '12', 8: '16', 10: '20', 12: '24'}
    
    if w_type == 'Melee':
        req_str = f"💪 {req_num}"
        atk_str = "💪"
        dmg_str = "💪"
        blk_str = block_map.get(req_num, '12')
    elif w_type == 'Hurled':
        req_str = f"🏃 {req_num}"
        atk_str = "🏃"
        dmg_str = "🏃"
        blk_str = ""
    elif w_type == 'Melee, Hurled':
        req_str = f"💪 {req_num}, 🏃 {req_num}"
        atk_str = "💪, 🏃"
        dmg_str = "💪, 🏃"
        blk_str = block_map.get(req_num, '12')
    else: # Shot
        req_str = f"👁️ {req_num}"
        atk_str = "👁️"
        dmg_str = "👁️"
        blk_str = ""

    return req_str, atk_str, dmg_str, blk_str

def main():
    print("🔌 Authenticating with Google Sheets API via metascapegame credentials...")
    creds = drive_helper.get_credentials("metascapegame")
    if not creds:
        print("❌ Failed to obtain metascapegame credentials.")
        sys.exit(1)

    sheets_service = build('sheets', 'v4', credentials=creds)

    print(f"📖 Reading source data from MSO Stats (ID: {SOURCE_SPREADSHEET_ID})...")
    res = sheets_service.spreadsheets().values().get(
        spreadsheetId=SOURCE_SPREADSHEET_ID,
        range="MSO_Weapons!A1:Z100"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 8:
        print("❌ Could not read source rows from MSO_Weapons.")
        sys.exit(1)

    print(f"✓ Read {len(rows)} raw rows from MSO_Weapons.")

    # Parse Weapons
    staged_rows = []
    
    # Dual-type standard list
    combo_weapons = ['combat knife', 'dagger', 'spear', 'axe', 'small axe', 'hand axe']

    for r in rows[7:]:
        if len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            # Skip empty rows or banner headers
            continue
            
        w_name = str(r[0]).strip()
        cat = str(r[1]).strip() if len(r) > 1 else 'Tech'
        subcat = str(r[2]).strip() if len(r) > 2 else ''
        sci_req = str(r[3]).strip() if len(r) > 3 else ''
        cost_raw = str(r[4]).strip() if len(r) > 4 else ''
        atk_base = str(r[7]).strip() if len(r) > 7 else ''
        range_raw = str(r[11]).strip() if len(r) > 11 else ''
        notes_raw = str(r[13]).strip() if len(r) > 13 else ''

        name_lower = w_name.lower()
        sub_lower = subcat.lower()
        atk_lower = atk_base.lower()

        # Determine Discipline
        cat_lower = cat.lower()
        if 'bio' in cat_lower:
            discipline = 'BioTech'
            table_group = 'BioTech Weapons'
        elif 'cyber' in cat_lower:
            discipline = 'CyberTech'
            table_group = 'CyberTech Weapons'
        else:
            discipline = 'Tech'
            if 'heavy' in sub_lower or 'explosive' in sub_lower or 'cannon' in name_lower or 'launcher' in name_lower:
                table_group = 'Heavy Ordnance'
            elif 'melee' in sub_lower or 'sword' in sub_lower or 'blade' in sub_lower or 'axe' in sub_lower:
                table_group = 'Tech Melee'
            else:
                table_group = 'Tech Ranged'

        # Determine Type
        if name_lower in combo_weapons or ('melee' in sub_lower and 'hurled' in sub_lower):
            w_type = 'Melee, Hurled'
        elif 'melee' in sub_lower or 'punch' in atk_lower or 'claw' in atk_lower or 'saw' in atk_lower or 'bite' in atk_lower or 'sword' in sub_lower or 'blade' in sub_lower:
            w_type = 'Melee'
        elif 'hurled' in sub_lower or 'throw' in sub_lower or 'thrown' in atk_lower or 'bomb' in name_lower or 'grenade' in sub_lower:
            w_type = 'Hurled'
        else:
            w_type = 'Shot'

        cost_val = parse_cost(cost_raw)
        range_val = parse_range(range_raw, w_type, w_name)
        req_str, atk_str, dmg_str, blk_str = parse_requirement_and_block(w_type, sci_req, atk_base, subcat, w_name)

        # Build Notes with prepended Range and exact MSO text
        if notes_raw:
            final_notes = f"Range: {range_val}\n\n{notes_raw}"
        else:
            final_notes = f"Range: {range_val}"

        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"
        compat = "universal"

        staged_rows.append([
            w_name,
            w_type,
            req_str,
            atk_str,
            dmg_str,
            blk_str,
            cost_val,
            final_notes,
            genres_json,
            is_locked,
            discipline,
            table_group
        ])

    print(f"✓ Successfully converted {len(staged_rows)} MSO weapons.")

    # 3. Create or Clear Target Tab SB_Weapons in Target Sheet
    print(f"\n🎯 Preparing target sheet (ID: {TARGET_SPREADSHEET_ID})...")
    target_meta = sheets_service.spreadsheets().get(spreadsheetId=TARGET_SPREADSHEET_ID).execute()
    existing_sheets = {s['properties']['title']: s['properties']['sheetId'] for s in target_meta.get('sheets', [])}

    if TARGET_TAB_NAME in existing_sheets:
        sheet_id = existing_sheets[TARGET_TAB_NAME]
        print(f"  Tab '{TARGET_TAB_NAME}' exists (Sheet ID: {sheet_id}). Clearing existing contents...")
        sheets_service.spreadsheets().values().clear(
            spreadsheetId=TARGET_SPREADSHEET_ID,
            range=f"{TARGET_TAB_NAME}!A1:Z500"
        ).execute()
    else:
        print(f"  Creating new tab '{TARGET_TAB_NAME}' in target sheet...")
        add_res = sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=TARGET_SPREADSHEET_ID,
            body={
                "requests": [
                    {
                        "addSheet": {
                            "properties": {
                                "title": TARGET_TAB_NAME,
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
        print(f"  ✅ Tab '{TARGET_TAB_NAME}' created (Sheet ID: {sheet_id}).")

    # 4. Write Header and Data Rows
    all_values = [TARGET_HEADERS] + staged_rows
    print(f"📝 Writing {len(all_values)} rows to '{TARGET_TAB_NAME}'...")
    sheets_service.spreadsheets().values().update(
        spreadsheetId=TARGET_SPREADSHEET_ID,
        range=f"{TARGET_TAB_NAME}!A1",
        valueInputOption="RAW",
        body={"values": all_values}
    ).execute()

    # 5. Apply Formatting (Bold header, frozen top row, column widths)
    print("🎨 Applying professional formatting...")
    format_requests = [
        # Format Header Row: Dark Slate background, white bold text, center align
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": len(TARGET_HEADERS)
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
                    "endIndex": len(TARGET_HEADERS)
                }
            }
        }
    ]

    sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=TARGET_SPREADSHEET_ID,
        body={"requests": format_requests}
    ).execute()

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_rows)} weapons to '{TARGET_TAB_NAME}'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
