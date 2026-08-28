# C:\Repos\Projects\SupaFlex\scripts\stage_mso_relics_to_gsheet.py
# Phase 2 (Part 8): Translates galactic relics from MSO_Relics into SB_Relics in Google Sheet 1NMf63a6hXIDcUy2rHufOW-g4dHqQsv1dxR6qi7ozWu4

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
TARGET_TAB_NAME = "SB_Relics"

TARGET_HEADERS = [
    "name",
    "category",
    "tier",
    "action",
    "usage",
    "effect",
    "notes",
    "discipline",
    "table_group",
    "genres",
    "is_guildspace_locked"
]

def evaluate_relic(name, cat, notes):
    name_lower = name.lower()
    cat_lower = cat.lower()
    notes_lower = notes.lower()
    
    # 1. Tier & Category
    if any(kw in name_lower for kw in ['dimensional', 'atm sphere', 'disintegrator', 'quantum', 'warmoon', 'stasis']):
        tier = 'Epic'
        category = '💫 Epic'
    elif any(kw in name_lower for kw in ['greater', 'cannon', 'battle', 'cloaking', 'genesis', 'phaser', 'force field', 'teleporter']):
        tier = 'Greater'
        category = '✨ Greater'
    elif any(kw in name_lower for kw in ['lesser', 'bracer', 'shield', 'amulet', 'ring', 'capsule', 'key', 'goggles', 'visor']):
        tier = 'Lesser'
        category = '🪄 Lesser'
    else:
        tier = 'Minor'
        category = '🍺 Minor'
        
    # 2. Action
    # AM: Attack + Move or MAJOR
    if any(kw in name_lower for kw in ['atm sphere', 'dimensional shifter', 'quantum']):
        action = 'AM'
        usage = '1- ⚡'
    # A: Attack or Heal strictly
    elif any(kw in name_lower for kw in ['gun', 'phaser', 'disintegrator', 'cannon', 'genesis capsule', 'heal', 'blast']):
        action = 'A'
        usage = '1-Enc'
    # M: Movement
    elif any(kw in name_lower for kw in ['disks', 'cylinders', 'hovercraft', 'flight', 'teleport']):
        action = 'M'
        usage = '1-Enc'
    # F: Free Action
    elif any(kw in name_lower for kw in ['shield', 'bracer', 'cloak', 'environ', 'toggle']):
        action = 'F'
        usage = '2-Enc'
    # P: Small Action
    else:
        action = 'P'
        usage = '1-Enc' if tier in ['Greater', 'Epic'] else '2-Enc'
        
    # 3. Discipline & Table Group
    if 'archaic' in cat_lower:
        discipline = 'Universal'
        table_group = 'Archaic Relics'
    elif 'bio' in cat_lower:
        discipline = 'BioTech'
        table_group = 'BioTech Relics'
    elif 'cyber' in cat_lower:
        discipline = 'CyberTech'
        table_group = 'CyberTech Relics'
    elif 'sorce' in cat_lower:
        discipline = 'Sorce'
        table_group = 'Sorce Relics'
    elif 'psionic' in cat_lower:
        discipline = 'Psionics'
        table_group = 'Psionic Relics'
    elif 'psychosomatic' in cat_lower:
        discipline = 'Psychosomatics'
        table_group = 'Psychosomatic Relics'
    elif 'other' in cat_lower:
        discipline = 'Universal'
        table_group = 'Alien Relics'
    else:
        discipline = 'Tech'
        table_group = 'Tech Relics'
        
    first_sentence = notes.split('.')[0] + '.' if '.' in notes else notes[:80]
    effect = first_sentence.strip()
    
    return tier, category, action, usage, effect, discipline, table_group

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
        range="MSO_Relics!A1:Z100"
    ).execute()
    rows = res.get('values', [])
    if not rows or len(rows) < 9:
        print("❌ Could not read source rows from MSO_Relics.")
        sys.exit(1)

    print(f"✓ Read {len(rows)} raw rows.")

    staged_relics = []
    action_counts = {}
    usage_counts = {}
    tier_counts = {}
    table_counts = {}

    for r in rows[8:]:
        if not r or len(r) < 2 or not r[0] or (len(r) > 1 and not r[1]):
            continue

        name = str(r[0]).strip()
        cat = str(r[1]).strip()
        notes = str(r[6]).strip() if len(r) > 6 else ''

        genres_json = '["SciFi", "GuildSpace"]'
        is_locked = "TRUE"

        tier, category, action, usage, effect, discipline, table_group = evaluate_relic(name, cat, notes)

        action_counts[action] = action_counts.get(action, 0) + 1
        usage_counts[usage] = usage_counts.get(usage, 0) + 1
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        table_counts[table_group] = table_counts.get(table_group, 0) + 1

        staged_relics.append([
            name,
            category,
            tier,
            action,
            usage,
            effect,
            notes,
            discipline,
            table_group,
            genres_json,
            is_locked
        ])

    print(f"\n📊 Summary of Relics Staged ({len(staged_relics)} items):")
    print(f"  Tiers  : {tier_counts}")
    print(f"  Actions: {action_counts}")
    print(f"  Usages : {usage_counts}")
    print(f"  Tables : {table_counts}")

    # Write SB_Relics
    write_and_format_tab(sheets_service, TARGET_SPREADSHEET_ID, TARGET_TAB_NAME, TARGET_HEADERS, staged_relics)

    print("\n════════════════════════════════════════════════════════════════")
    print(f"🎉 SUCCESS! Staged {len(staged_relics)} Relics to '{TARGET_TAB_NAME}'")
    print(f"🔗 Target Sheet URL: https://docs.google.com/spreadsheets/d/{TARGET_SPREADSHEET_ID}/edit")
    print("════════════════════════════════════════════════════════════════\n")

if __name__ == "__main__":
    main()
