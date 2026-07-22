// src/lib/supabase.ts
// Supabase Client Initialization with env fallback support

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ddibmiifxwqlnlpaekui.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaWJtaWlmeHdxbG5scGFla3VpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU1NjA5NiwiZXhwIjoyMTAwMTMyMDk2fQ.tzpdIj39T8-fe5zk_6NA75lx7OS-VcIigmdM8zeeRhc';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

