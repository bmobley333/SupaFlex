// src/lib/supabase.ts
// Supabase Client Initialization with env fallback support

import { createClient } from '@supabase/supabase-js';

// Supabase Version 2.0 (Target: zipebnjazayhfjstykwl)
export const V2_SUPABASE_URL = 'https://zipebnjazayhfjstykwl.supabase.co';
export const V2_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppcGVibmphemF5aGZqc3R5a3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU3ODgsImV4cCI6MjEwMjA0MTc4OH0.Hxi256UqfikRhfWh9GB3F8PJDXGmqQEWiGox6A-766Y';

function getJwtProjectRef(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    if (typeof atob === 'undefined') return null;
    const json = atob(base64);
    const payload = JSON.parse(json);
    return payload.ref || null;
  } catch {
    return null;
  }
}

// Defend against stale legacy Ver 1 env vars in host providers (Vercel)
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseUrl = (rawUrl && !rawUrl.includes('ddibmiifxwqlnlpaekui')) ? rawUrl : V2_SUPABASE_URL;

const rawKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const rawKeyRef = getJwtProjectRef(rawKey);

// Ensure the anon key matches the active database project ref, falling back to canonical V2 key if mismatched
export const supabaseKey =
  rawKey && rawKeyRef && rawKeyRef !== 'ddibmiifxwqlnlpaekui' && supabaseUrl.includes(rawKeyRef)
    ? rawKey
    : V2_SUPABASE_ANON_KEY;

if (typeof window !== 'undefined' && rawKey && rawKey !== supabaseKey) {
  console.warn(
    `[SupaFlex Auth Guard]: Environment key ref (${rawKeyRef || 'invalid'}) did not match target DB (${supabaseUrl}). Automatically fell back to canonical V2 key.`
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
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
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) throw error;
  return data;
}



