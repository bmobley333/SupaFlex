# 📦 SupaFlex Supabase Database Backups

**Location:** `C:\Repos\Projects\SupaFlex\backups\`  
**Last Generated:** `2026-08-27 16:45:59`  
**Source Project:** `https://zipebnjazayhfjstykwl.supabase.co` (`zipebnjazayhfjstykwl`)

---

> [!WARNING]
> **Point-In-Time Snapshot Disclaimer:**
> The `.sql` script and `.json` files in this directory represent static, point-in-time snapshot backups of all Supabase tables.
> **These backup files WILL become out of sync/date as tabletop sessions, character updates, and database modifications continue.**

---

## 📑 Backup Inventory (2026-08-27)

| Table Name | Backup Row Count | SQL File Location |
| :--- | :--- | :--- |
| `characters` | 3 rows | `supabase_full_backup_2026-08-27.sql` |
| `powers` | 698 rows | `supabase_full_backup_2026-08-27.sql` |
| `skillsets` | 59 rows | `supabase_full_backup_2026-08-27.sql` |
| `relics` | 269 rows | `supabase_full_backup_2026-08-27.sql` |
| `hardware` | 29 rows | `supabase_full_backup_2026-08-27.sql` |
| `weapons` | 137 rows | `supabase_full_backup_2026-08-27.sql` |
| `armor` | 64 rows | `supabase_full_backup_2026-08-27.sql` |
| `shields` | 6 rows | `supabase_full_backup_2026-08-27.sql` |
| `gear` | 106 rows | `supabase_full_backup_2026-08-27.sql` |
| `monsters` | 149 rows | `supabase_full_backup_2026-08-27.sql` |
| `parties` | 0 rows | `supabase_full_backup_2026-08-27.sql` |
| `party_session_members` | 0 rows | `supabase_full_backup_2026-08-27.sql` |

---

## 🛠️ How to Restore or Execute Backup

### Option A: Restore via Supabase Dashboard SQL Editor
1. Open [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/zipebnjazayhfjstykwl/sql/new).
2. Open [`supabase_full_backup_2026-08-27.sql`](file:///C:/Repos/Projects/SupaFlex/backups/supabase_full_backup_2026-08-27.sql).
3. Copy and paste the SQL statements into the editor and click **Run**.

### Option B: Automated Refresh Script
Run the automated python backup generator anytime:
```bash
python C:\Repos\Projects\SupaFlex\scripts\backup_all_supabase_tables.py
```
