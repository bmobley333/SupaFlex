import sys
import json
import urllib.request
import urllib.parse

# Force UTF-8 output encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def purge_user(email_to_purge: str):
    clean_email = email_to_purge.strip().lower()
    print(f"=== PURGING USER ACCOUNT: {clean_email} ===")

    env = json.load(open(r'C:\Repos\Projects\SupaFlex\env.json'))
    url = env['VITE_SUPABASE_URL']
    service_key = env['SUPABASE_SERVICE_ROLE_KEY']

    headers = {
        'apikey': service_key,
        'Authorization': f'Bearer {service_key}',
        'Content-Type': 'application/json'
    }

    # 1. Delete from public.characters
    req_char = urllib.request.Request(
        f"{url}/rest/v1/characters?owner_email=eq.{urllib.parse.quote(clean_email)}",
        headers=headers,
        method='DELETE'
    )
    try:
        with urllib.request.urlopen(req_char) as resp:
            print(f"[OK] Deleted characters for {clean_email} (HTTP {resp.status})")
    except Exception as e:
        print(f"[WARN] Error deleting characters: {e}")

    # 2. Delete from public.party_session_members
    req_ps = urllib.request.Request(
        f"{url}/rest/v1/party_session_members?player_email=eq.{urllib.parse.quote(clean_email)}",
        headers=headers,
        method='DELETE'
    )
    try:
        with urllib.request.urlopen(req_ps) as resp:
            print(f"[OK] Deleted party session memberships for {clean_email} (HTTP {resp.status})")
    except Exception as e:
        print(f"[WARN] Error deleting party session memberships: {e}")

    # 3. Delete from public.players
    req_pl = urllib.request.Request(
        f"{url}/rest/v1/players?email=eq.{urllib.parse.quote(clean_email)}",
        headers=headers,
        method='DELETE'
    )
    try:
        with urllib.request.urlopen(req_pl) as resp:
            print(f"[OK] Deleted player profile for {clean_email} (HTTP {resp.status})")
    except Exception as e:
        print(f"[WARN] Error deleting player profile: {e}")

    # 4. Delete from auth.users via Admin Auth API
    req_users = urllib.request.Request(f"{url}/auth/v1/admin/users", headers=headers)
    try:
        with urllib.request.urlopen(req_users) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            users = data.get('users', [])
            target_user = next((u for u in users if (u.get('email') or '').lower() == clean_email), None)

            if target_user:
                user_id = target_user['id']
                req_del_user = urllib.request.Request(
                    f"{url}/auth/v1/admin/users/{user_id}",
                    headers=headers,
                    method='DELETE'
                )
                with urllib.request.urlopen(req_del_user) as del_resp:
                    print(f"[OK] Deleted auth user {user_id} ({clean_email}) from auth.users (HTTP {del_resp.status})")
            else:
                print(f"[INFO] User {clean_email} was not found in auth.users.")
    except Exception as e:
        print(f"[WARN] Error deleting auth user: {e}")

    print(f"=== PURGE COMPLETE FOR {clean_email} ===")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'ogluck333@gmail.com'
    purge_user(target)
