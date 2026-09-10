// src/lib/supabase.ts
// Supabase Client Initialization with env fallback support

import { createClient } from '@supabase/supabase-js';
import { getTabSessionId } from '../utils/tabSession';

// Supabase Version 2.0 (Target: zipebnjazayhfjstykwl)
export const V2_SUPABASE_URL = 'https://zipebnjazayhfjstykwl.supabase.co';
export const V2_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppcGVibmphemF5aGZqc3R5a3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU3ODgsImV4cCI6MjEwMjA0MTc4OH0.Hxi256UqfikRhfWh9GB3F8PJDXGmqQEWiGox6A-766Y';

// Defend against stale legacy Ver 1 env vars in host providers (Vercel)
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseUrl = (rawUrl && !rawUrl.includes('ddibmiifxwqlnlpaekui')) ? rawUrl : V2_SUPABASE_URL;

const rawKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseKey = (rawKey && !rawKey.includes('ddibmiifxwqlnlpaekui')) ? rawKey : V2_SUPABASE_ANON_KEY;

const tabId = getTabSessionId();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    storageKey: `supaflex_auth_token_${tabId}`,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
  return data;
}



