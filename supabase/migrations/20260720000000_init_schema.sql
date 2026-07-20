-- 20260720000000_init_schema.sql
-- Exact replica schema from legacy FlexWeb Supabase Database

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- DROP EXISTING TABLES (to start clean)
DROP TABLE IF EXISTS public.characters CASCADE;
DROP TABLE IF EXISTS public.players CASCADE;
DROP TABLE IF EXISTS public.powers CASCADE;
DROP TABLE IF EXISTS public.magic_items CASCADE;
DROP TABLE IF EXISTS public.skillsets CASCADE;

-- ==========================================
-- 1. PLAYERS TABLE
-- ==========================================
CREATE TABLE public.players (
    email TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Players Policies
CREATE POLICY "Allow select for authenticated players" ON public.players
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow players to update their own profile" ON public.players
    FOR UPDATE TO authenticated USING (auth.jwt()->>'email' = email);

-- ==========================================
-- 2. CHARACTERS TABLE
-- ==========================================
CREATE TABLE public.characters (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    class TEXT,
    race TEXT,
    hp INTEGER DEFAULT 10 NOT NULL,
    inventory JSONB DEFAULT '[]'::jsonb NOT NULL,
    log JSONB DEFAULT '[]'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    might TEXT,
    motion TEXT,
    mind TEXT,
    magic TEXT,
    moxie TEXT,
    skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    owner_email TEXT REFERENCES public.players(email) ON DELETE CASCADE,
    sheet_data JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- Enable RLS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Characters Policies
CREATE POLICY "Allow players to view all characters in active playtests" ON public.characters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow players to manage their own characters" ON public.characters
    FOR ALL TO authenticated USING (auth.jwt()->>'email' = owner_email);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_characters_owner_email ON public.characters(owner_email);

-- ==========================================
-- 3. POWERS TABLE
-- ==========================================
CREATE TABLE public.powers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    usage TEXT,
    action TEXT,
    effect TEXT,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    dropdown TEXT,
    sub TEXT,
    table_name TEXT
);

-- Enable RLS
ALTER TABLE public.powers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read-only select on powers" ON public.powers FOR SELECT TO authenticated USING (true);

-- ==========================================
-- 4. MAGIC ITEMS TABLE
-- ==========================================
CREATE TABLE public.magic_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    usage TEXT,
    action TEXT,
    effect TEXT,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    dropdown TEXT,
    sub TEXT,
    table_name TEXT
);

-- Enable RLS
ALTER TABLE public.magic_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read-only select on magic_items" ON public.magic_items FOR SELECT TO authenticated USING (true);

-- ==========================================
-- 5. SKILLSETS TABLE
-- ==========================================
CREATE TABLE public.skillsets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    dropdown TEXT,
    sub TEXT,
    table_name TEXT
);

-- Enable RLS
ALTER TABLE public.skillsets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read-only select on skillsets" ON public.skillsets FOR SELECT TO authenticated USING (true);
