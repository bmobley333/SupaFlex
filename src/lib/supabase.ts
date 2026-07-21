// src/lib/supabase.ts
// Supabase Client Initialization with env fallback support

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ddibmiifxwqlnlpaekui.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaWJtaWlmeHdxbG5scGFla3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTYwOTYsImV4cCI6MjEwMDEzMjA5Nn0.gGFJU-7fg0RnRy8-rKe4kmw60c8RBo6c7mLtqc5bF5k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
