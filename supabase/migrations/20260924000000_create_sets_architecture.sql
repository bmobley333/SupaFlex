-- =============================================================================
-- Migration: 20260924000000_create_sets_architecture.sql
-- Description: Establishes first-class Sets architecture for SupaFlex.
-- 1. Creates public.sets table with RLS and GIN indexes.
-- 2. Adds sets TEXT[] column with GIN indexes to skills, traits, powers,
--    weapons, armor, and shields.
-- =============================================================================

-- 1. Create public.sets table
CREATE TABLE IF NOT EXISTS public.sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('Traits', 'Skills', 'Powers', 'Weapons', 'Armor & Shields')),
    description TEXT DEFAULT '',
    paths TEXT[] DEFAULT '{}'::TEXT[],
    genres TEXT[] DEFAULT '{"Medieval", "Modern", "SciFi"}'::TEXT[],
    owner TEXT DEFAULT 'Designer',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for public.sets
CREATE INDEX IF NOT EXISTS idx_sets_name ON public.sets(name);
CREATE INDEX IF NOT EXISTS idx_sets_category ON public.sets(category);
CREATE INDEX IF NOT EXISTS idx_sets_paths ON public.sets USING gin(paths);
CREATE INDEX IF NOT EXISTS idx_sets_genres ON public.sets USING gin(genres);

-- Enable Row Level Security
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access on sets" ON public.sets;
DROP POLICY IF EXISTS "Allow metascapegame admin all on sets" ON public.sets;
DROP POLICY IF EXISTS "Allow users to manage their own custom sets" ON public.sets;
DROP POLICY IF EXISTS "Service role full access on sets" ON public.sets;

-- Policies mirroring public.paths
CREATE POLICY "Allow public read access on sets"
    ON public.sets FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow metascapegame admin all on sets"
    ON public.sets FOR ALL
    TO authenticated
    USING ((auth.jwt() ->> 'email'::text) = 'metascapegame@gmail.com'::text)
    WITH CHECK ((auth.jwt() ->> 'email'::text) = 'metascapegame@gmail.com'::text);

CREATE POLICY "Allow users to manage their own custom sets"
    ON public.sets FOR ALL
    TO authenticated
    USING ((owner IS NOT NULL) AND (owner <> 'Designer'::text) AND (lower(TRIM(BOTH FROM owner)) = lower(TRIM(BOTH FROM (auth.jwt() ->> 'email'::text)))))
    WITH CHECK ((owner IS NOT NULL) AND (owner <> 'Designer'::text) AND (lower(TRIM(BOTH FROM owner)) = lower(TRIM(BOTH FROM (auth.jwt() ->> 'email'::text)))));

CREATE POLICY "Service role full access on sets"
    ON public.sets FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Add sets column to target element tables
ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS sets TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.traits ADD COLUMN IF NOT EXISTS sets TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.powers ADD COLUMN IF NOT EXISTS sets TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.weapons ADD COLUMN IF NOT EXISTS sets TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.armor ADD COLUMN IF NOT EXISTS sets TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.shields ADD COLUMN IF NOT EXISTS sets TEXT[] DEFAULT '{}'::TEXT[];

-- GIN Indexes on element tables
CREATE INDEX IF NOT EXISTS idx_skills_sets ON public.skills USING gin(sets);
CREATE INDEX IF NOT EXISTS idx_traits_sets ON public.traits USING gin(sets);
CREATE INDEX IF NOT EXISTS idx_powers_sets ON public.powers USING gin(sets);
CREATE INDEX IF NOT EXISTS idx_weapons_sets ON public.weapons USING gin(sets);
CREATE INDEX IF NOT EXISTS idx_armor_sets ON public.armor USING gin(sets);
CREATE INDEX IF NOT EXISTS idx_shields_sets ON public.shields USING gin(sets);
