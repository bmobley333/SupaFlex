// src/lib/supabase.ts
// Supabase Client Initialization with env fallback support

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zipebnjazayhfjstykwl.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppcGVibmphemF5aGZqc3R5a3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU3ODgsImV4cCI6MjEwMjA0MTc4OH0.Hxi256UqfikRhfWh9GB3F8PJDXGmqQEWiGox6A-766Y';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    storageKey: 'supaflex_auth_token',
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  if (error) throw error;
  return data;
}



