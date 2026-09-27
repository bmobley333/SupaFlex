# SupaFlex Supabase Egress Architecture & Forensic Playbook

> **Authoritative Source of Truth (SoT) Reference**  
> **Target Project:** `SupaFlex-Dev` (`zipebnjazayhfjstykwl` on `us-west-2`)  
> **Last Updated:** September 2026  
> **Tier Boundary:** Free Tier (Strict 5.0 GB / month Egress Quota, \$0/month)

---

## 1. Executive Summary & Architecture Context

SupaFlex is designed to operate seamlessly on Supabase's Free Tier with zero monthly hosting costs. The underlying database footprint is exceptionally compact (~36 MB), yet high-frequency catalog downloads, uncached queries, redundant table fetching, and unattended development hot-reloads can rapidly consume the 5.0 GB egress quota if guardrails are not strictly maintained.

This playbook provides the permanent operational manual, forensic diagnostic commands, architectural invariants, and remediation patterns to guarantee SupaFlex stays well below free-tier egress limits indefinitely.

---

## 2. The Living Triad: Egress & Caching Mandates

### Triad Mandate 1: Single-Pass Raw Catalog Resolution
* **Rule (The What):** Network queries during catalog initialization (`fetchInitialData`) MUST fetch each base database table (`supplies`, `weapons`, `armor`, `shields`, `gear_powers`, `mods`, `powers`, `skills`, `traits`, `paths`, `sets`, `bundles`, `chaos_gems`) **exactly once**. Derived catalogs (`artifactsData`, `exoticsData`, `magicItems`) MUST be computed deterministically in-memory on the client using `resolveArtifactCatalog` and `resolveExoticCatalog`.
* **Rationale (The Why):** In legacy builds, calling `getMagicItems()`, `getArtifacts()`, and `getExotics()` alongside individual table getters executed 20+ concurrent SQL queries, downloading identical equipment rows 3 to 5 times in parallel. This multiplied network egress from ~300 KB compressed to over 1.2 MB per reload.
* **Failure Mechanism (What Breaks):** Supabase network egress spikes 400% on every cold start or page refresh, exhausting the 5.0 GB monthly quota within 50–100 active development sessions.

### Triad Mandate 2: Native IndexedDB Catalog Caching & Storage Isolation
* **Rule (The What):** All client-side catalog caches MUST be stored in persistent browser `IndexedDB` (`supaflex_cache_db`), with localStorage reserved solely as a fallback. Furthermore, cached payloads MUST store ONLY raw normalized tables. Derived collections (`items`, `artifactsData`, `exoticsData`) MUST NEVER be serialized to persistent storage.
* **Rationale (The Why):** Browser `localStorage` enforces a strict 5 MB origin quota. Serializing both raw tables and duplicate derived collections ballooned the cache payload to ~2.9 MB. When multiple user keys or session metadata were present, `localStorage.setItem` threw an unhandled `QuotaExceededError`. This silently broke caching, turning 100% of subsequent page visits into cold cache misses.
* **Failure Mechanism (What Breaks):** Users and developers endure 100% cold database fetches on every single browser reload, generating 5–15 MB of uncompressed egress per visit.

### Triad Mandate 3: In-Flight Boot Deduplication
* **Rule (The What):** `fetchInitialData()` MUST implement a module-scoped in-flight Promise singleton. If a catalog fetch is already executing, subsequent calls MUST return the pending Promise rather than initiating parallel network requests. Authentication state changes in `App.tsx` and `setPlayerEmail` MUST NOT trigger redundant re-fetches if data is already loaded or in-flight.
* **Rationale (The Why):** During cold application mount, React component lifecycle, `supabase.auth.getSession()`, and `supabase.auth.onAuthStateChange` fire in rapid sequence (0–150ms). Without in-flight deduplication, a single tab launch triggered `fetchInitialData()` 3 times concurrently.
* **Failure Mechanism (What Breaks):** Every user login or page refresh initiates a 3x download storm (15+ MB egress per cold boot), burning through gigabytes of network quota during normal testing.

### Triad Mandate 4: Surgical Workshop Invalidation
* **Rule (The What):** Mutations in `PlayerWorkshopModal` or Forge tools MUST NOT wipe the entire global catalog cache or trigger full 18-table re-downloads. Workshop saves MUST update the local Zustand store in-memory and, if cloud sync is required, re-fetch ONLY the specific modified table (e.g. `refreshCatalogs(['gear_powers'])`).
* **Rationale (The Why):** During intense item design sessions, creators unlink, modify, or forge dozens of powers and mods in minutes. Triggering a full catalog download on every save turns a 2 KB record update into a 5 MB egress penalty.
* **Failure Mechanism (What Breaks):** A single 30-minute Forge design session can generate 100–300 MB of egress, draining the monthly quota while editing just a handful of items.

---

## 3. Forensic Diagnostic Runbook

When investigating sudden egress increases on the Supabase project, execute these diagnostics immediately:

### Step 1: Query Direct Postgres `pg_stat_statements`
Connect to the database pooler (`aws-0-us-west-2.pooler.supabase.com:6543`, database `postgres`, user `postgres.zipebnjazayhfjstykwl`):

```sql
-- Identify highest frequency queries
SELECT 
    query, 
    calls, 
    round(total_exec_time::numeric, 2) AS total_time_ms,
    round(mean_exec_time::numeric, 2) AS mean_time_ms,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC
LIMIT 15;
```

### Step 2: Sample Real-Time Query Velocity (Detect Runaway Polling)
Execute two snapshots 5 seconds apart to calculate delta query velocity:

```sql
SELECT 
    query, 
    calls 
FROM pg_stat_statements 
WHERE calls > 500 
ORDER BY calls DESC 
LIMIT 10;
-- Wait 5 seconds, re-run, and check if delta > 0
```
* If delta is high (>10 calls/sec across static tables), an unmuted polling loop or HMR loop is active in a client tab.

### Step 3: Check Client Network Telemetry
In any browser running SupaFlex:
1. Open DevTools Console.
2. Run:
   ```javascript
   import('./src/utils/networkTelemetry').then(m => console.table(m.getSessionNetworkStats()));
   ```
3. Inspect `totalBytes` and `largePayloadWarnings`.

---

## 4. Egress Budget & Safety Boundaries

| Metric | Free Tier Ceiling | Safe Daily Target | Incident Threshold |
| :--- | :--- | :--- | :--- |
| **Monthly Total Egress** | 5.0 GB | < 1.0 GB / month | > 2.0 GB / month |
| **Daily Egress Budget** | ~166 MB / day | < 30 MB / day | > 100 MB / day |
| **Cold Catalog Load** | N/A | < 350 KB (gzip) | > 1.0 MB |
| **Warm Catalog Load (Cache Hit)** | N/A | 0 KB (0 REST calls) | > 0 KB |
| **Beacon Check** | N/A | ~40 bytes | > 1 KB |
| **Character Summary Boot** | N/A | < 20 KB | > 100 KB |

---

## 5. Development Environment Rules (Preventing Phantom Spikes)

1. **Unattended Dev Servers:** Never leave Vite (`npm run dev`) running unattended in the background for days with active browser tabs. Vite's WebSocket HMR triggers hot reloads on any repo file change, causing connected tabs to execute cold boots if browser caching is bypassed.
2. **Tab Sleep / Background Suspension:** `PartyRosterHud` and realtime listeners must check `document.visibilityState`. If the tab is hidden, background polling must suspend immediately.
3. **Database Reset Command:** If `pg_stat_statements` becomes noisy after an investigation, reset metrics via:
   ```sql
   SELECT pg_stat_statements_reset();
   ```
