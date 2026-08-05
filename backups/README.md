# 📦 SupaFlex Supabase Database Backups

**Location:** `C:\Repos\Projects\SupaFlex\backups\`  
**Last Generated:** `2026-08-05 12:03:25`  
**Source Project:** `https://ddibmiifxwqlnlpaekui.supabase.co` (`ddibmiifxwqlnlpaekui`)

---

> [!WARNING]
> **Point-In-Time Snapshot Disclaimer:**
> The `.sql` script and `.json` files in this directory represent static, point-in-time snapshot backups of all Supabase tables.
> **These backup files WILL become out of sync/date as tabletop sessions, character updates, and database modifications continue.**

---

## 📑 Backup Inventory (2026-08-05)

| Table Name | Backup Row Count | SQL File Location |
| :--- | :--- | :--- |
| `monsters` | 58 rows | `supabase_full_backup_2026-08-05.sql` |
| `weapons` | 43 rows | `supabase_full_backup_2026-08-05.sql` |
| `armor` | 32 rows | `supabase_full_backup_2026-08-05.sql` |
| `shields` | 5 rows | `supabase_full_backup_2026-08-05.sql` |
| `gear` | 92 rows | `supabase_full_backup_2026-08-05.sql` |
| `powers` | 519 rows | `supabase_full_backup_2026-08-05.sql` |
| `magic_items` | 211 rows | `supabase_full_backup_2026-08-05.sql` |
| `skillsets` | 41 rows | `supabase_full_backup_2026-08-05.sql` |
| `treasure_tables` | 5 rows | `supabase_full_backup_2026-08-05.sql` |
| `treasure_entries` | 44 rows | `supabase_full_backup_2026-08-05.sql` |
| `nish_tc` | 100 rows | `supabase_full_backup_2026-08-05.sql` |
| `parties` | 4 rows | `supabase_full_backup_2026-08-05.sql` |
| `party_session_members` | 2 rows | `supabase_full_backup_2026-08-05.sql` |
| `characters` | 12 rows | `supabase_full_backup_2026-08-05.sql` |

---

## 🛠️ How to Restore or Execute Backup

### Option A: Restore via Supabase Dashboard SQL Editor
1. Open [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/ddibmiifxwqlnlpaekui/sql/new).
2. Open [`supabase_full_backup_2026-08-05.sql`](file:///c:/Repos/Projects/SupaFlex/backups/supabase_full_backup_2026-08-05.sql).
3. Copy and paste the SQL statements into the editor and click **Run**.

### Option B: Automated Refresh Script
Run the automated python backup generator anytime:
```bash
python C:\Repos\Projects\SupaFlex\scripts\backup_all_supabase_tables.py
```
