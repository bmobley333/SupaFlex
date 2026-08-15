import os
import sys
import json
import urllib.request
from datetime import datetime

# Ensure UTF-8 output on Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    supaflex_root = os.path.abspath(os.path.join(base_dir, ".."))
    env_path = os.path.join(supaflex_root, "env.json")

    with open(env_path, "r", encoding="utf-8") as f:
        env_data = json.load(f)

    supabase_url = env_data["VITE_SUPABASE_URL"]
    service_key = env_data["SUPABASE_SERVICE_ROLE_KEY"]

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    # List of all active tables to back up
    tables = [
        "characters",
        "players",
        "powers",
        "skillsets",
        "relics",
        "hardware",
        "weapons",
        "armor",
        "shields",
        "gear",
        "monsters",
        "parties",
        "party_session_members"
    ]

    timestamp_str = datetime.now().strftime("%Y-%m-%d")
    backup_dir = os.path.join(supaflex_root, "backups")
    json_dir = os.path.join(backup_dir, "json", timestamp_str)
    os.makedirs(backup_dir, exist_ok=True)
    os.makedirs(json_dir, exist_ok=True)

    sql_backup_file = os.path.join(backup_dir, f"supabase_full_backup_{timestamp_str}.sql")

    print(f"🌌 Starting full Supabase table backup for project: {env_data.get('SUPABASE_CLI_PROJECT_REF')}")
    print(f"📁 Output Directory: {backup_dir}")

    sql_lines = []
    sql_lines.append(f"-- ==============================================================================")
    sql_lines.append(f"-- SupaFlex Master Supabase Full Database SQL Backup")
    sql_lines.append(f"-- Date Generated: {datetime.now().isoformat()}")
    sql_lines.append(f"-- Source Project: {supabase_url} ({env_data.get('SUPABASE_CLI_PROJECT_REF')})")
    sql_lines.append(f"-- NOTE: This is a point-in-time snapshot backup. Data will become out-of-sync")
    sql_lines.append(f"--       as active tabletop sessions and database updates continue.")
    sql_lines.append(f"-- ==============================================================================\n")

    summary_counts = {}

    for table in tables:
        url = f"{supabase_url}/rest/v1/{table}?select=*&order=id.asc"
        req = urllib.request.Request(url, headers=headers)
        
        try:
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                
            summary_counts[table] = len(data)
            print(f"  [Backup] Table '{table}': {len(data)} rows fetched.")

            # Write JSON snapshot
            json_file = os.path.join(json_dir, f"{table}.json")
            with open(json_file, "w", encoding="utf-8") as f_json:
                json.dump(data, f_json, indent=2, ensure_ascii=False)

            # Generate SQL INSERT statements
            sql_lines.append(f"-- ------------------------------------------------------------------------------")
            sql_lines.append(f"-- Table Data: public.{table} ({len(data)} rows)")
            sql_lines.append(f"-- ------------------------------------------------------------------------------")

            if not data:
                sql_lines.append(f"-- (No rows present in table public.{table})\n")
                continue

            for row in data:
                cols = list(row.keys())
                vals = []
                for k in cols:
                    v = row[k]
                    if v is None:
                        vals.append("NULL")
                    elif isinstance(v, (int, float)):
                        vals.append(str(v))
                    elif isinstance(v, bool):
                        vals.append("TRUE" if v else "FALSE")
                    elif isinstance(v, (dict, list)):
                        # Escape single quotes in JSON string
                        escaped_json = json.dumps(v, ensure_ascii=False).replace("'", "''")
                        vals.append(f"'{escaped_json}'::jsonb")
                    else:
                        escaped_str = str(v).replace("'", "''")
                        vals.append(f"'{escaped_str}'")

                cols_str = ", ".join([f'"{c}"' for c in cols])
                vals_str = ", ".join(vals)
                sql_lines.append(f'INSERT INTO public."{table}" ({cols_str}) VALUES ({vals_str}) ON CONFLICT DO NOTHING;')

            sql_lines.append("\n")

        except Exception as e:
            print(f"  [Warning] Could not backup table '{table}': {e}", file=sys.stderr)

    # Write SQL backup file
    with open(sql_backup_file, "w", encoding="utf-8") as f_sql:
        f_sql.write("\n".join(sql_lines))

    # Write README in backups directory explaining usage and out-of-sync disclaimer
    readme_path = os.path.join(backup_dir, "README.md")
    readme_content = f"""# 📦 SupaFlex Supabase Database Backups

**Location:** `C:\\Repos\\Projects\\SupaFlex\\backups\\`  
**Last Generated:** `{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`  
**Source Project:** `{supabase_url}` (`{env_data.get('SUPABASE_CLI_PROJECT_REF')}`)

---

> [!WARNING]
> **Point-In-Time Snapshot Disclaimer:**
> The `.sql` script and `.json` files in this directory represent static, point-in-time snapshot backups of all Supabase tables.
> **These backup files WILL become out of sync/date as tabletop sessions, character updates, and database modifications continue.**

---

## 📑 Backup Inventory ({timestamp_str})

| Table Name | Backup Row Count | SQL File Location |
| :--- | :--- | :--- |
"""
    for tbl, cnt in summary_counts.items():
        readme_content += f"| `{tbl}` | {cnt} rows | `supabase_full_backup_{timestamp_str}.sql` |\n"

    readme_content += f"""
---

## 🛠️ How to Restore or Execute Backup

### Option A: Restore via Supabase Dashboard SQL Editor
1. Open [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/{env_data.get('SUPABASE_CLI_PROJECT_REF')}/sql/new).
2. Open [`supabase_full_backup_{timestamp_str}.sql`](file:///{sql_backup_file.replace('\\', '/')}).
3. Copy and paste the SQL statements into the editor and click **Run**.

### Option B: Automated Refresh Script
Run the automated python backup generator anytime:
```bash
python C:\\Repos\\Projects\\SupaFlex\\scripts\\backup_all_supabase_tables.py
```
"""

    with open(readme_path, "w", encoding="utf-8") as f_readme:
        f_readme.write(readme_content)

    print(f"\n🎉 Backup Complete!")
    print(f"✅ Generated SQL Backup Script: {sql_backup_file}")
    print(f"✅ Generated JSON Snapshots: {json_dir}")
    print(f"✅ Generated Backup README: {readme_path}")

if __name__ == "__main__":
    main()
