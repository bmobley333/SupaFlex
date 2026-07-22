#!/usr/bin/env python3
"""
update_supabase_spark.py

Updates production Supabase database tables ('magic_items' and 'powers') and master Google Sheet:
1. Replaces all usage entries containing 'Day' (e.g. 1-Day, 2-Day, 3-Day) with '1-⚡'.
2. Rebuilds the dropdown column for both magic_items and powers tables.
3. Updates the Master Database Google Sheet (ID: 1BaGHeqPDuZSA3OMLKWiSeUdAHxq6y8-rw2cVHqRMXs8) to maintain 100% parity.
"""

import os
import sys
import argparse
import tomllib
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

try:
    from supabase import create_client, Client
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "supabase"], check=True)
    from supabase import create_client, Client

MASTER_SHEET_ID = "1BaGHeqPDuZSA3OMLKWiSeUdAHxq6y8-rw2cVHqRMXs8"

SUB_EMOJI_MAP = {
    "Minor": "Minor🍺",
    "Lesser": "Lesser🔮",
    "Greater": "Greater🪬",
    "Artifact": "Artifact🌀"
}

def load_supabase_client() -> Client:
    secrets_path = r"C:\Repos\Projects\SupaFlex\.streamlit\secrets.toml"
    if not os.path.exists(secrets_path):
        print(f"ERROR: Secrets file not found at {secrets_path}", file=sys.stderr)
        sys.exit(1)

    with open(secrets_path, "rb") as f:
        secrets = tomllib.load(f)

    url = secrets["connections"]["supabase"]["SUPABASE_URL"]
    key = secrets["connections"]["supabase"]["SUPABASE_KEY"]
    return create_client(url, key)

def get_sheets_service():
    creds = drive_helper.get_credentials("metascapegame")
    return build('sheets', 'v4', credentials=creds)

def format_sub_emoji(sub_val: str) -> str:
    cleaned = (sub_val or "").strip().replace("🍺", "").replace("🔮", "").replace("🪬", "").replace("🌀", "").strip()
    return SUB_EMOJI_MAP.get(cleaned, (sub_val or "").strip())

def generate_magic_item_dropdown(sub: str, name: str, usage: str, action: str, effect: str) -> str:
    sub_formatted = format_sub_emoji(sub)
    return f"{sub_formatted} - {(name or '').strip()} ({(usage or '').strip()}, {(action or '').strip()}) ➡ {(effect or '').strip()}"

def generate_power_dropdown(table_name: str, name: str, usage: str, action: str, effect: str) -> str:
    t_name = (table_name or "").strip()
    p_name = (name or "").strip()
    if not p_name.endswith("⚡"):
        p_name = f"{p_name}⚡"
    return f"{t_name} - {p_name} ({(usage or '').strip()}, {(action or '').strip()}) ➡ {(effect or '').strip()}"

def update_supabase_table(client: Client, table_name: str, dry_run: bool = False):
    print(f"\n--- Processing Supabase Table: '{table_name}' ---")
    res = client.table(table_name).select("*").execute()
    rows = res.data or []

    modified_rows = []
    for r in rows:
        usage = r.get("usage") or ""
        if "day" in usage.lower():
            new_usage = "1-⚡"
            r["usage"] = new_usage

            name = r.get("name") or ""
            action = r.get("action") or ""
            effect = r.get("effect") or ""

            if table_name == "magic_items":
                sub = r.get("sub") or ""
                r["dropdown"] = generate_magic_item_dropdown(sub, name, new_usage, action, effect)
            else:
                tbl = r.get("table_name") or ""
                r["dropdown"] = generate_power_dropdown(tbl, name, new_usage, action, effect)

            modified_rows.append(r)

    print(f"[{table_name}] Total Records: {len(rows)} | Records to Update ('Day' -> '1-⚡'): {len(modified_rows)}")

    if not dry_run and modified_rows:
        success = 0
        failed = 0
        for item in modified_rows:
            rec_id = item.get("id")
            name = item.get("name")
            try:
                if rec_id:
                    client.table(table_name).update({"usage": item["usage"], "dropdown": item["dropdown"]}).eq("id", rec_id).execute()
                else:
                    client.table(table_name).update({"usage": item["usage"], "dropdown": item["dropdown"]}).eq("name", name).execute()
                success += 1
            except Exception as e:
                print(f"  ❌ Failed to update '{name}': {e}", file=sys.stderr)
                failed += 1
        print(f"[{table_name}] ✅ Successfully updated {success} records in Supabase (Failed: {failed}).")
    elif dry_run:
        print(f"[{table_name}] 🔍 DRY-RUN MODE: No changes written to Supabase.")

    return len(rows), len(modified_rows)

def update_master_sheet(service, sheet_tab: str, dry_run: bool = False):
    print(f"\n--- Updating Master Google Sheet Tab: '{sheet_tab}' ---")
    range_name = f"'{sheet_tab}'!A1:Z2000"
    res = service.spreadsheets().values().get(spreadsheetId=MASTER_SHEET_ID, range=range_name).execute()
    rows = res.get('values', [])

    if not rows:
        print(f"No rows found in master sheet tab '{sheet_tab}'.")
        return

    # Find header row
    header_idx = 0
    for idx, r in enumerate(rows[:10]):
        if 'name' in [c.lower() for c in r]:
            header_idx = idx
            break

    header = rows[header_idx]
    lower_header = [c.lower() for c in header]

    u_idx = lower_header.index('usage') if 'usage' in lower_header else -1
    d_idx = lower_header.index('dropdown') if 'dropdown' in lower_header else -1
    n_idx = lower_header.index('name') if 'name' in lower_header else -1
    sub_idx = lower_header.index('sub') if 'sub' in lower_header else -1
    tbl_idx = lower_header.index('table_name') if 'table_name' in lower_header else -1
    act_idx = lower_header.index('action') if 'action' in lower_header else -1
    eff_idx = lower_header.index('effect') if 'effect' in lower_header else -1

    if u_idx == -1 or d_idx == -1:
        print(f"Skipping tab '{sheet_tab}': missing required headers.")
        return

    modified_count = 0
    updated_rows = rows[:header_idx+1]

    for r in rows[header_idx+1:]:
        if len(r) < len(header):
            r = r + [''] * (len(header) - len(r))

        usage_val = r[u_idx].strip() if u_idx < len(r) else ""
        if 'day' in usage_val.lower():
            r[u_idx] = '1-⚡'
            usage_val = '1-⚡'
            modified_count += 1

            name_val = r[n_idx].strip() if n_idx < len(r) else ""
            act_val = r[act_idx].strip() if act_idx < len(r) else ""
            eff_val = r[eff_idx].strip() if eff_idx < len(r) else ""

            if sheet_tab.lower() == "magic_items":
                sub_val = r[sub_idx].strip() if sub_idx < len(r) else ""
                r[d_idx] = generate_magic_item_dropdown(sub_val, name_val, usage_val, act_val, eff_val)
            else:
                tbl_val = r[tbl_idx].strip() if tbl_idx < len(r) else ""
                r[d_idx] = generate_power_dropdown(tbl_val, name_val, usage_val, act_val, eff_val)

        updated_rows.append(r)

    print(f"[{sheet_tab}] Total Rows: {len(rows)-header_idx-1} | Modified ('Day' -> '1-⚡'): {modified_count}")

    if not dry_run and modified_count > 0:
        body = {'values': updated_rows}
        service.spreadsheets().values().update(
            spreadsheetId=MASTER_SHEET_ID,
            range=f"'{sheet_tab}'!A1",
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        print(f"[{sheet_tab}] ✅ Master Sheet updated successfully.")

def main():
    parser = argparse.ArgumentParser(description="Update production Supabase & Master Google Sheet for Spark ⚡ rules.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to Supabase or Google Sheet.")
    args = parser.parse_args()

    print("🌌 Starting Production Supabase & Master Sheet Refactoring...")
    client = load_supabase_client()
    service = get_sheets_service()

    tot_m, mod_m = update_supabase_table(client, "magic_items", dry_run=args.dry_run)
    tot_p, mod_p = update_supabase_table(client, "powers", dry_run=args.dry_run)

    update_master_sheet(service, "magic_items", dry_run=args.dry_run)
    update_master_sheet(service, "powers", dry_run=args.dry_run)

    print("\n" + "="*50)
    print("✅ SUPABASE & MASTER SHEET UPDATE COMPLETE")
    print(f"Magic Items Modified: {mod_m} / {tot_m}")
    print(f"Powers Modified:      {mod_p} / {tot_p}")
    print(f"Total Records Updated: {mod_m + mod_p}")
    print("="*50)

if __name__ == "__main__":
    main()
