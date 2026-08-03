import os
import sys
import json
import urllib.request
import urllib.error

# Load .env variables from parent directory if needed
SUPABASE_URL = "https://ddibmiifxwqlnlpaekui.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaWJtaWlmeHdxbG5scGFla3VpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU1NjA5NiwiZXhwIjoyMTAwMTMyMDk2fQ.tzpdIj39T8-fe5zk_6NA75lx7OS-VcIigmdM8zeeRhc"

def provision_user(email, password):
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    payload = {
        "email": email.strip().toLowerCase() if hasattr(email.strip(), 'toLowerCase') else email.strip().lower(),
        "password": password,
        "email_confirm": True
    }
    
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            data = json.loads(res.read().decode('utf-8'))
            print(f"[SUCCESS] User '{email}' provisioned in Supabase auth successfully!")
            print("User Details:", json.dumps(data, indent=2))
            return data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f"[HTTP {e.code}] Failed to provision user: {err_body}")
        if "already registered" in err_body or "already exists" in err_body:
            print(f"[INFO] User '{email}' already exists in Supabase Auth.")
        return None

if __name__ == "__main__":
    email_to_create = sys.argv[1] if len(sys.argv) > 1 else "thebmobley@gmail.com"
    pwd = sys.argv[2] if len(sys.argv) > 2 else "TempPassword123!"
    provision_user(email_to_create, pwd)
