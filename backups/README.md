# 📦 SupaFlex Supabase Database Backups

**Location:** `C:\Repos\Projects\SupaFlex\backups\`  
**Last Generated:** `2026-09-24 17:20:40`  
**Source Project:** `https://zipebnjazayhfjstykwl.supabase.co` (`zipebnjazayhfjstykwl`)

---

> [!WARNING]
> **Point-In-Time Snapshot Disclaimer:**
> The `.sql` script and `.json` files in this directory represent static, point-in-time snapshot backups of all Supabase tables.
> **These backup files WILL become out of sync/date as tabletop sessions, character updates, and database modifications continue.**

---

## 📑 Backup Inventory (2026-09-24)

| Table Name | Backup Row Count | SQL File Location |
| :--- | :--- | :--- |
| `characters` | 53 rows | `supabase_full_backup_2026-09-24.sql` |
| `powers` | 850 rows | `supabase_full_backup_2026-09-24.sql` |
| `weapons` | 215 rows | `supabase_full_backup_2026-09-24.sql` |
| `armor` | 89 rows | `supabase_full_backup_2026-09-24.sql` |
| `shields` | 10 rows | `supabase_full_backup_2026-09-24.sql` |
| `monsters` | 149 rows | `supabase_full_backup_2026-09-24.sql` |
| `parties` | 3 rows | `supabase_full_backup_2026-09-24.sql` |
| `party_session_members` | 0 rows | `supabase_full_backup_2026-09-24.sql` |

---

## 🛠️ How to Restore or Execute Backup

### Option A: Restore via Supabase Dashboard SQL Editor
1. Open [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/zipebnjazayhfjstykwl/sql/new).
2. Open [`supabase_full_backup_2026-09-24.sql`](file:///C:/Repos/Projects/SupaFlex/backups/supabase_full_backup_2026-09-24.sql).
3. Copy and paste the SQL statements into the editor and click **Run**.

### Option B: Automated Refresh Script
Run the automated python backup generator anytime:
```bash
python C:\Repos\Projects\SupaFlex\scripts\backup_all_supabase_tables.py
```
