#!/usr/bin/env python3
"""
update_temp_sheet_spark.py

Updates the Google Sheet "Temp Magic & Powers" (ID: 1KFpUOglf4tdk4j2RIUAw-dPARGgyA08JjgkmsiosNpw):
1. Replaces all usage entries containing 'Day' (e.g. 1-Day, 2-Day, 3-Day) with '1-⚡'.
2. Rebuilds the dropdown column for both magic_items and powers tabs to reflect the new usage.
3. Updates Google Sheet Data Validation rules on the Usage column (Column E).
"""

import os
import sys
import argparse
from googleapiclient.discovery import build

# Force UTF-8 encoding for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Ensure gdrive-helper is in search path
JODAR_ROOT = r"C:\Repos\Jodar"
sys.path.append(os.path.join(JODAR_ROOT, "services", "gdrive-helper"))

import drive_helper

SPREADSHEET_ID = "1KFpUOglf4tdk4j2RIUAw-dPARGgyA08JjgkmsiosNpw"

SUB_EMOJI_MAP = {
    "Minor": "Minor🍺",
    "Lesser": "Lesser🔮",
    "Greater": "Greater🪬",
    "Artifact": "Artifact🌀"
}

def get_sheets_service():
    creds = drive_helper.get_credentials("metascapegame")
    return build('sheets', 'v4', credentials=creds)

def format_sub_emoji(sub_val: str) -> str:
    cleaned = sub_val.strip().replace("🍺", "").replace("🔮", "").replace("🪬", "").replace("🌀", "").strip()
    return SUB_EMOJI_MAP.get(cleaned, sub_val.strip())

def generate_magic_item_dropdown(sub: str, name: str, usage: str, action: str, effect: str) -> str:
    sub_formatted = format_sub_emoji(sub)
    return f"{sub_formatted} - {name.strip()} ({usage.strip()}, {action.strip()}) ➡ {effect.strip()}"

def generate_power_dropdown(table_name: str, name: str, usage: str, action: str, effect: str) -> str:
    t_name = table_name.strip()
    p_name = name.strip()
    if not p_name.endswith("⚡"):
        p_name = f"{p_name}⚡"
    return f"{t_name} - {p_name} ({usage.strip()}, {action.strip()}) ➡ {effect.strip()}"

def process_tab(service, tab_name: str, dry_run: bool = False):
    print(f"\n--- Processing Tab: '{tab_name}' ---")
    range_name = f"'{tab_name}'!A1:Z2000"
    res = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=range_name).execute()
    rows = res.get('values', [])

    if not rows:
        print(f"No rows found in tab {tab_name}.")
        return 0, 0

    header = rows[0]
    name_idx = header.index('name')
    sub_idx = header.index('sub')
    tbl_idx = header.index('table_name')
    u_idx = header.index('usage')
    a_idx = header.index('action')
    e_idx = header.index('effect')
    d_idx = header.index('dropdown')

    modified_count = 0
    updated_rows = [header]

    for r_idx, r in enumerate(rows[1:], start=2):
        if len(r) < len(header):
            r = r + [''] * (len(header) - len(r))

        old_usage = r[u_idx].strip()
        is_day = 'day' in old_usage.lower()

        if is_day:
            new_usage = '1-⚡'
            r[u_idx] = new_usage
            modified_count += 1

        # Rebuild dropdown column for all rows (or modified rows) to ensure 100% consistency
        name_val = r[name_idx].strip()
        sub_val = r[sub_idx].strip()
        tbl_val = r[tbl_idx].strip()
        usage_val = r[u_idx].strip()
        action_val = r[a_idx].strip()
        effect_val = r[e_idx].strip()

        if name_val:
            if tab_name == "magic_items":
                new_dropdown = generate_magic_item_dropdown(sub_val, name_val, usage_val, action_val, effect_val)
            else:
                new_dropdown = generate_power_dropdown(tbl_val, name_val, usage_val, action_val, effect_val)

            if len(r) <= d_idx:
                r.extend([''] * (d_idx - len(r) + 1))
            r[d_idx] = new_dropdown

        updated_rows.append(r)

    print(f"[{tab_name}] Total Rows: {len(rows)-1} | Usage Modified ('Day' -> '1-⚡'): {modified_count}")

    if not dry_run and modified_count > 0:
        body = {'values': updated_rows}
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{tab_name}'!A1",
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        print(f"[{tab_name}] ✅ Successfully updated {len(updated_rows)} rows in Google Sheet.")
    elif dry_run:
        print(f"[{tab_name}] 🔍 DRY-RUN MODE: No changes written to Google Sheet.")

    return len(rows) - 1, modified_count

def update_data_validation(service):
    print("\n--- Updating Data Validation Rules for Usage Column (Column E) ---")
    meta = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    allowed_usages = ["1-⚡", "1-Enc", "2-Enc", "3-Enc", "1-Rnd", "1-Luck🍀", "1-Luck", "Perm", "Passive", "At-Will"]

    requests = []
    for sheet in meta.get('sheets', []):
        sheet_id = sheet['properties']['sheetId']
        title = sheet['properties']['title']
        if title in ['magic_items', 'powers']:
            req = {
                "setDataValidation": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": 1,
                        "endRowIndex": 2000,
                        "startColumnIndex": 4,
                        "endColumnIndex": 5
                    },
                    "rule": {
                        "condition": {
                            "type": "ONE_OF_LIST",
                            "values": [{"userEnteredValue": u} for u in allowed_usages]
                        },
                        "showCustomUi": True,
                        "strict": False
                    }
                }
            }
            requests.append(req)

    if requests:
        service.spreadsheets().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={'requests': requests}).execute()
        print("✅ Data validation updated on Column E (Usage) for both tabs.")

def main():
    parser = argparse.ArgumentParser(description="Update Temp Magic & Powers Google Sheet for Meta⚡ & Spark ⚡︎ rules.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to Google Sheets.")
    args = parser.parse_args()

    print("🌌 Starting Temp Magic & Powers Sheet Refactoring...")
    service = get_sheets_service()

    total_m, mod_m = process_tab(service, "magic_items", dry_run=args.dry_run)
    total_p, mod_p = process_tab(service, "powers", dry_run=args.dry_run)

    if not args.dry_run:
        update_data_validation(service)

    print("\n" + "="*50)
    print("✅ REFACTORING COMPLETE")
    print(f"Magic Items Modified: {mod_m} / {total_m}")
    print(f"Powers Modified:      {mod_p} / {total_p}")
    print(f"Total Entries Updated: {mod_m + mod_p}")
    print("="*50)

if __name__ == "__main__":
    main()
