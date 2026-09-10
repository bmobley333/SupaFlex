# SupaFlex Auth & Environment Troubleshooting Runbook

This runbook documents the architecture, failure mechanisms, and deterministic diagnostic procedures for SupaFlex authentication and environment configuration across Localhost and Cloud (Vercel).

---

## 🏛️ The Living Triad Rules

### Rule 1: Base64 JWT Project Ref Invariant
* **Rule (The What):** Never validate Supabase Anon or Service keys using string substring checks on the raw token (e.g. `rawKey.includes(projectId)`). Always base64-decode the second JWT segment (`parts[1]`) and inspect `payload.ref`.
* **Rationale (The Why):** JWTs are base64-encoded strings (`eyJhbGci...`). Base64 chunks 3 bytes into 4 ASCII characters. A project ref like `ddibmiifxwqlnlpaekui` becomes `ImRkaWJtaWlmeHdxbG5scGFla3Vp` or shifts depending on byte offset. Plaintext substring searches on raw tokens will always return `false`.
* **Failure Mechanism (The What Breaks):** Host providers (Vercel, Netlify) with stale environment variables silently bypass fallback checks, pairing a new database URL with an old anon key.

### Rule 2: Database URL & Anon Key Strict Parity
* **Rule (The What):** `supabaseUrl` and `supabaseKey` MUST originate from the exact same Supabase project reference.
* **Rationale (The Why):** Supabase GoTrue Auth validates incoming Bearer tokens and `apikey` headers against the project's internal JWT secret and issuer ID.
* **Failure Mechanism (The What Breaks):** If the URL points to Project A and the Key points to Project B, Supabase returns `HTTP 401 Unauthorized: {"hint":"Double check your Supabase anon or service_role API key.","message":"Invalid API key"}`. Because GoTrue catches this internally during OAuth redirect processing, it outputs no visible UI alert—it silently sets `session: null`, trapping the user in an endless "Sign in" loop with `#access_token` stuck in the address bar.

### Rule 3: OAuth Hash Lifecycle & Race Condition Defense
* **Rule (The What):** Never execute `window.history.replaceState` or clear `window.location.hash` on the initial `onAuthStateChange` event (`INITIAL_SESSION`). URL cleanup must ONLY execute after `session?.user?.email` is verified.
* **Rationale (The Why):** When Supabase mounts in the browser with `#access_token=...` in the URL, `onAuthStateChange` fires immediately with an unauthenticated `INITIAL_SESSION` before GoTrue completes token parsing and HTTP verification.
* **Failure Mechanism (The What Breaks):** Erasing the hash on the initial event strips the OAuth access token from the browser bar before Supabase has finished reading it, destroying the login attempt on every page load.

### Rule 4: Persistent Auth Storage for Cross-Origin Navigations
* **Rule (The What):** The Supabase Auth Client must use persistent `window.localStorage` (`storageKey: 'supaflex_auth_token'`), while per-tab temporary UI state remains isolated in `window.sessionStorage`.
* **Rationale (The Why):** Google OAuth redirects the top-level window across multiple origins (`app.vercel.app` ➔ `accounts.google.com` ➔ `supabase.co` ➔ `app.vercel.app`). Modern browsers isolate or clear `window.name` and tab context on cross-origin roundtrips.
* **Failure Mechanism (The What Breaks):** Using per-tab dynamic keys for auth storage (e.g. `supaflex_auth_token_${tabId}`) causes the app to generate a fresh tab ID upon returning from Google, discarding the code verifier and dropping the session.

### Rule 5: Supabase Dashboard URL Configuration
* **Rule (The What):** In Supabase Dashboard ➔ Authentication ➔ URL Configuration:
  * **Site URL:** Must be set to the canonical production URL (e.g. `https://supaflex.vercel.app`).
  * **Redirect URLs:** Must include both exact domain and wildcard paths:
    * `https://supaflex.vercel.app/**`
    * `https://supaflex.vercel.app`
    * `http://localhost:3000/**`
    * `http://localhost:3000`
* **Rationale (The Why):** Supabase rejects redirects to URLs not explicitly permitted in the allowlist.
* **Failure Mechanism (The What Breaks):** If `supaflex.vercel.app` is missing, Google OAuth redirects back to `http://localhost:3000` even when the user initiates login on the production Vercel site.

---

## ⚡ 60-Second Diagnostic Checklist

When login fails, loops, or behaves differently on Localhost vs Vercel:

| Step | Action | What to Look For | Fix |
| :---: | :--- | :--- | :--- |
| **1** | Run Audit Script | `python scripts/audit_auth_env.py --prod` | Checks key/URL parity and tests HTTP endpoint |
| **2** | Check URL Bar | Does `#access_token=eyJ...` linger in the browser bar? | Indicates GoTrue failed to validate token with Supabase |
| **3** | Check Console Network Tab | Look for request to `/auth/v1/user` or `/auth/v1/settings` | If status is **401 Unauthorized**, the anon key project ref does not match the database URL |
| **4** | Inspect Live Bundle | Check which bundle Vercel is serving: `curl -s https://supaflex.vercel.app \| grep assets/index-` | Verify new commit has deployed on Vercel |
| **5** | Vercel Env Settings | Go to Vercel ➔ Settings ➔ Environment Variables | Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` match active project |

---

## 🛠️ Instant Verification Script
Run the automated diagnostic tool:
```powershell
# Audit production Vercel
python C:\Repos\Projects\SupaFlex\scripts\audit_auth_env.py --prod

# Audit local environment
python C:\Repos\Projects\SupaFlex\scripts\audit_auth_env.py --local
```
