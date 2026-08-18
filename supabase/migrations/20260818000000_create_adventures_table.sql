-- Migration: 20260818000000_create_adventures_table.sql
-- Description: Create public.adventures table for GM Adventure/Act/Encounter pre-staging

CREATE TABLE IF NOT EXISTS public.adventures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gm_email TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT DEFAULT 'Medieval',
    is_active BOOLEAN DEFAULT true,
    structure JSONB NOT NULL DEFAULT '{"acts": []}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_adventures_gm_email ON public.adventures (gm_email);
CREATE INDEX IF NOT EXISTS idx_adventures_is_active ON public.adventures (is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE public.adventures ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Adventures select policy" ON public.adventures;
DROP POLICY IF EXISTS "Adventures modify policy" ON public.adventures;
DROP POLICY IF EXISTS "Adventures insert policy" ON public.adventures;
DROP POLICY IF EXISTS "Adventures update policy" ON public.adventures;
DROP POLICY IF EXISTS "Adventures delete policy" ON public.adventures;

-- RLS Policies: GMs can view their own adventures, plus metascapegame admin
CREATE POLICY "Adventures select policy" ON public.adventures
    FOR SELECT USING (
        lower(gm_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        OR lower(gm_email) = 'metascapegame@gmail.com'
        OR auth.jwt() ->> 'email' = 'metascapegame@gmail.com'
        OR auth.role() = 'anon'
        OR auth.role() = 'authenticated'
    );

CREATE POLICY "Adventures insert policy" ON public.adventures
    FOR INSERT WITH CHECK (
        true
    );

CREATE POLICY "Adventures update policy" ON public.adventures
    FOR UPDATE USING (
        true
    );

CREATE POLICY "Adventures delete policy" ON public.adventures
    FOR DELETE USING (
        true
    );

-- PostgREST Schema Reload
NOTIFY pgrst, 'reload schema';
