import os
import sys
import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://ddibmiifxwqlnlpaekui.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaWJtaWlmeHdxbG5scGFla3VpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU1NjA5NiwiZXhwIjoyMTAwMTMyMDk2fQ.tzpdIj39T8-fe5zk_6NA75lx7OS-VcIigmdM8zeeRhc"

def check_parties_schema():
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/parties?select=*&limit=1"
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            print("[SUCCESS] Successfully connected to public.parties table!")
            if data:
                print("Parties table columns:", list(data[0].keys()))
            else:
                print("Parties table is active and accessible.")
            return True
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"[HTTP {e.code}] Error querying parties table: {err_body}")
        return False

if __name__ == "__main__":
    check_parties_schema()
