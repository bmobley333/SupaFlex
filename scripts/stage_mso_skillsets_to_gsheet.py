# C:\Repos\Projects\SupaFlex\scripts\stage_mso_skillsets_to_gsheet.py
# Phase 2 (Part 7): Filters and synthesizes Skill Sets and Specialization Sets from MSO_Sets into SB_SkillSets in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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
TARGET_TAB_NAME = "SB_SkillSets"

TARGET_HEADERS = [
    "name",
    "skills",
    "category",
    "table_group",
    "discipline",
    "source",
    "genres",
    "is_guildspace_locked"
]

def get_discipline(set_name, set_type):
    s_lower = set_name.lower()
    if any(kw in s_lower for kw in ['vessel', 'astrogat', 'pilot', 'helm', 'engineer', 'mechanic', 'programmer', 'communicat']):
        return 'Tech'
    elif any(kw in s_lower for kw in ['archer', 'blaster', 'carbinier', 'fighter', 'martial', 'pistolier', 'pulse laser', 'rifle', 'tactical']):
        return 'Martial'
    elif any(kw in s_lower for kw in ['thief', 'covert', 'spy']):
        return 'Covert'
    elif any(kw in s_lower for kw in ['athletic', 'physical', 'survivalist']):
        return 'Physical'
    elif any(kw in s_lower for kw in ['medic']):
        return 'Medical'
    elif any(kw in s_lower for kw in ['scientist']):
        return 'Science'
    else:
        return 'Universal'

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
        range="MSO_Sets!A1:Z400"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 9:
        print("❌ Could not read source rows from MSO_Sets.")
        sys.exit(1)

    print(f"✓ Read {len(rows)} raw rows.")

    sets_dict = {}
    skipped_rows = 0
    member_count = 0

    for r in rows[8:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            continue

        set_name = str(r[0]).strip()
        set_type = str(r[1]).strip() if len(r) > 1 else ''
        member_name = str(r[2]).strip() if len(r) > 2 else ''

        if set_type.lower() not in ['skill set', 'specialization set']:
            skipped_rows += 1
            continue

        member_count += 1

        if set_name not in sets_dict:
            sets_dict[set_name] = {
                'name': set_name,
                'category': set_type,
                'table_group': 'Skill Sets' if 'skill' in set_type.lower() else 'Specialization Sets',
                'discipline': get_discipline(set_name, set_type),
                'source': 'MSO',
                'genres': '["SciFi", "GuildSpace"]',
                'is_guildspace_locked': 'TRUE',
                'members': []
            }

        if member_name and member_name not in sets_dict[set_name]['members']:
            sets_dict[set_name]['members'].append(member_name)

    staged_rows = []
    group_counts = {}
    disc_counts = {}

    for sname, sdata in sets_dict.items():
        skills_json = json.dumps(sdata['members'], ensure_ascii=False)
        staged_rows.append([
            sdata['name'],
            skills_json,
            sdata['category'],
            sdata['table_group'],
            sdata['discipline'],
            sdata['source'],
            sdata['genres'],
            sdata['is_guildspace_locked']
        ])
        group_counts[sdata['table_group']] = group_counts.get(sdata['table_group'], 0) + 1
        disc_counts[sdata['discipline']] = disc_counts.get(sdata['discipline'], 0) + 1

    print(f"\n📊 Summary of SkillSets Staged ({len(staged_rows)} sets from {member_count} member rows, {skipped_rows} non-skillset rows ignored):")
    print(f"  Groups     : {group_counts}")
    print(f"  Disciplines: {disc_counts}")

    # Write SB_SkillSets
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, TARGET_TAB_NAME, TARGET_HEADERS, staged_rows)

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_rows)} SkillSets to '{TARGET_TAB_NAME}'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
