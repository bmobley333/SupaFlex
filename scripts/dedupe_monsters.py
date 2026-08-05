import os
import sys
import json
import urllib.request

# Ensure UTF-8 output on Windows console
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def main():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "env.json")
    with open(env_path, "r", encoding="utf-8") as f:
        env_data = json.load(f)

    supabase_url = env_data["VITE_SUPABASE_URL"]
    service_key = env_data["SUPABASE_SERVICE_ROLE_KEY"]

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    # Fetch current monsters
    fetch_url = f"{supabase_url}/rest/v1/monsters?select=*&order=id.asc"
    req = urllib.request.Request(fetch_url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        monsters = json.loads(resp.read().decode('utf-8'))

    print(f"[Dedupe] Current monster count: {len(monsters)}")

    target_id_to_delete = 2
    match = [m for m in monsters if m['id'] == target_id_to_delete]
    
    if match:
        print(f"[Dedupe] Found duplicate row to delete: ID {target_id_to_delete}")
        delete_url = f"{supabase_url}/rest/v1/monsters?id=eq.{target_id_to_delete}"
        del_req = urllib.request.Request(delete_url, headers=headers, method="DELETE")
        with urllib.request.urlopen(del_req) as del_resp:
            deleted_data = json.loads(del_resp.read().decode('utf-8'))
            print(f"[Dedupe] Successfully deleted row ID {target_id_to_delete}")
    else:
        print(f"[Dedupe] Row ID {target_id_to_delete} is absent (successfully deduplicated).")

    # Verify final count
    req_verify = urllib.request.Request(fetch_url, headers=headers)
    with urllib.request.urlopen(req_verify) as resp_v:
        final_monsters = json.loads(resp_v.read().decode('utf-8'))

    print(f"[Dedupe] Final monster count: {len(final_monsters)}")

if __name__ == "__main__":
    main()
