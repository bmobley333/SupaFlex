#!/usr/bin/env python3
"""
SupaFlex Auth & Environment Parity Auditor
Deterministic CLI for validating Supabase URL, Anon Key JWT refs, and Auth API health.

Usage:
    python scripts/audit_auth_env.py [--local] [--prod] [--all]
"""

import sys
import os
import re
import json
import base64
import argparse
import urllib.request
import urllib.error

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def b64_decode_jwt_payload(jwt_token: str) -> dict:
    try:
        parts = jwt_token.strip().split('.')
        if len(parts) < 2:
            return {}
        padded = parts[1] + '=' * (-len(parts[1]) % 4)
        raw = base64.urlsafe_b64decode(padded).decode('utf-8')
        return json.loads(raw)
    except Exception as e:
        return {'error': str(e)}

def test_supabase_auth_endpoint(url: str, anon_key: str) -> tuple[int, str]:
    endpoint = f"{url.rstrip('/')}/auth/v1/settings"
    try:
        req = urllib.request.Request(
            endpoint,
            headers={
                'apikey': anon_key.strip(),
                'Authorization': f"Bearer {anon_key.strip()}",
                'User-Agent': 'SupaFlex-Auditor/1.0'
            }
        )
        with urllib.request.urlopen(req, timeout=8) as res:
            return res.status, "OK"
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        return e.code, body
    except Exception as e:
        return 0, str(e)

def audit_local(root_dir: str):
    print("\n" + "=" * 60)
    print(" [*] LOCAL ENVIRONMENT AUDIT")
    print("=" * 60)

    # 1. Parse .env
    env_path = os.path.join(root_dir, '.env')
    env_url = None
    env_key = None
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('VITE_SUPABASE_URL='):
                    env_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                elif line.startswith('VITE_SUPABASE_ANON_KEY=') or line.startswith('VITE_SUPABASE_KEY='):
                    env_key = line.split('=', 1)[1].strip().strip('"').strip("'")
        print(f"  [.env File]: Found at {env_path}")
    else:
        print("  [.env File]: Not present (using src/lib/supabase.ts fallbacks)")

    # 2. Parse src/lib/supabase.ts fallbacks
    ts_path = os.path.join(root_dir, 'src', 'lib', 'supabase.ts')
    v2_url = None
    v2_key = None
    if os.path.exists(ts_path):
        with open(ts_path, 'r', encoding='utf-8') as f:
            content = f.read()
            m_url = re.search(r"V2_SUPABASE_URL\s*=\s*['\"]([^'\"]+)['\"]", content)
            m_key = re.search(r"V2_SUPABASE_ANON_KEY\s*=\s*['\"]([^'\"]+)['\"]", content)
            if m_url: v2_url = m_url.group(1)
            if m_key: v2_key = m_key.group(1)

    target_url = env_url or v2_url
    target_key = env_key or v2_key

    if not target_url or not target_key:
        print("  [FAIL] Could not resolve Supabase URL or Anon Key!")
        return False

    # Extract URL project ref
    url_ref_match = re.search(r"https://([a-z0-9]+)\.supabase\.co", target_url)
    url_ref = url_ref_match.group(1) if url_ref_match else "unknown"

    # Decode JWT payload
    payload = b64_decode_jwt_payload(target_key)
    key_ref = payload.get('ref', 'unknown')
    key_role = payload.get('role', 'unknown')

    print(f"  Target URL:       {target_url}")
    print(f"  URL Project Ref:  {url_ref}")
    print(f"  Anon Key Ref:     {key_ref}")
    print(f"  Anon Key Role:    {key_role}")

    # Check match
    if url_ref == key_ref:
        print("  [OK] Parity Match: URL and Anon Key project refs match!")
    else:
        print(f"  [FAIL] CRITICAL MISMATCH: URL has '{url_ref}' but Key has '{key_ref}'!")
        return False

    # Test Auth endpoint
    code, msg = test_supabase_auth_endpoint(target_url, target_key)
    if code == 200:
        print("  [OK] Auth Endpoint: HTTP 200 OK (Key accepted by Supabase)")
        return True
    else:
        print(f"  [FAIL] Auth Endpoint: HTTP {code} FAILED! Message: {msg}")
        return False

def audit_prod():
    print("\n" + "=" * 60)
    print(" [*] VERCEL PRODUCTION AUDIT (https://supaflex.vercel.app)")
    print("=" * 60)

    site_url = "https://supaflex.vercel.app"
    try:
        req = urllib.request.Request(site_url, headers={'User-Agent': 'SupaFlex-Auditor/1.0', 'Cache-Control': 'no-cache'})
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
    except Exception as e:
        print(f"  [FAIL] Failed to fetch {site_url}: {e}")
        return False

    m_bundle = re.search(r'src="/assets/(index-[^"]+\.js)"', html)
    if not m_bundle:
        print("  [FAIL] Failed to locate entry bundle in production HTML!")
        return False

    bundle_name = m_bundle.group(1)
    bundle_url = f"{site_url}/assets/{bundle_name}"
    print(f"  Deployed Bundle:  {bundle_name}")

    try:
        req = urllib.request.Request(bundle_url, headers={'User-Agent': 'SupaFlex-Auditor/1.0', 'Cache-Control': 'no-cache'})
        js = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
    except Exception as e:
        print(f"  [FAIL] Failed to fetch bundle {bundle_url}: {e}")
        return False

    # Find URLs
    urls = set(re.findall(r'https://[a-z0-9]+\.supabase\.co', js))
    print(f"  Supabase URLs:    {', '.join(urls)}")

    # Find JWTs
    keys = set(re.findall(r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]+', js))
    print(f"  Keys in Bundle:   {len(keys)} unique JWT signature(s)")

    has_active_v2_match = False
    for k in keys:
        payload = b64_decode_jwt_payload(k)
        ref = payload.get('ref')
        role = payload.get('role')
        if ref:
            print(f"    - Key Ref: {ref:<22} Role: {role}")
            if ref == 'zipebnjazayhfjstykwl':
                has_active_v2_match = True

    # Test production endpoint with V2 key
    v2_url = "https://zipebnjazayhfjstykwl.supabase.co"
    v2_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppcGVibmphemF5aGZqc3R5a3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU3ODgsImV4cCI6MjEwMjA0MTc4OH0.Hxi256UqfikRhfWh9GB3F8PJDXGmqQEWiGox6A-766Y"

    code, msg = test_supabase_auth_endpoint(v2_url, v2_key)
    if code == 200:
        print(f"  [OK] V2 Endpoint Test: HTTP 200 OK ({v2_url})")
    else:
        print(f"  [FAIL] V2 Endpoint Test: HTTP {code} FAILED! Message: {msg}")

    # Verify bundle has active protection against V1
    has_protection = 'ddibmiifxwqlnlpaekui' in js and 'atob' in js
    if has_protection:
        print("  [OK] Guardrail Status: Active (JWT payload decoder protecting against stale V1 keys)")
    else:
        print("  [WARN] Guardrail Status: JWT protection logic not detected in bundle!")

    success = has_active_v2_match and code == 200 and has_protection
    print("=" * 60)
    if success:
        print("  >>> PRODUCTION HEALTH: 100% HEALTHY & AUTH-ALIGNED <<<")
    else:
        print("  >>> PRODUCTION HEALTH: ISSUES DETECTED <<<")
    print("=" * 60)
    return success

def main():
    parser = argparse.ArgumentParser(description="SupaFlex Auth & Environment Auditor")
    parser.add_argument('--local', action='store_true', help="Audit local environment")
    parser.add_argument('--prod', action='store_true', help="Audit live production on Vercel")
    parser.add_argument('--all', action='store_true', help="Audit both local and production")

    args = parser.parse_args()
    if not args.local and not args.prod and not args.all:
        args.all = True

    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

    local_ok = True
    prod_ok = True

    if args.local or args.all:
        local_ok = audit_local(root_dir)

    if args.prod or args.all:
        prod_ok = audit_prod()

    sys.exit(0 if (local_ok and prod_ok) else 1)

if __name__ == '__main__':
    main()
