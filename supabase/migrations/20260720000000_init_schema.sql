-- 20260720000000_init_schema.sql
-- SupaFlex RPG Core Schema Initialization

-- Enable standard cryptographic extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. PLAYERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Players Policies
CREATE POLICY "Allow select for authenticated players" ON public.players
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow players to update their own profile" ON public.players
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ==========================================
-- 2. CHARACTERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    campaign_id TEXT,
    level INTEGER DEFAULT 1 NOT NULL,
    class TEXT,
    race TEXT,
    vitality_max INTEGER DEFAULT 10 NOT NULL,
    wounds INTEGER DEFAULT 0 NOT NULL,
    attributes JSONB DEFAULT '{}'::jsonb NOT NULL,
    powers JSONB DEFAULT '[]'::jsonb NOT NULL,
    magic_items JSONB DEFAULT '[]'::jsonb NOT NULL,
    skillsets JSONB DEFAULT '[]'::jsonb NOT NULL,
    general_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Characters
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Characters Policies
CREATE POLICY "Allow players to view all characters in active playtests" ON public.characters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow players to manage their own characters" ON public.characters
    FOR ALL TO authenticated USING (auth.uid() = player_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_characters_player_id ON public.characters(player_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign_id ON public.characters(campaign_id);

-- ==========================================
-- 3. RULES & ABILITIES DICTIONARY (Powers, Items, Skillsets)
-- ==========================================

-- Powers Catalog
CREATE TABLE IF NOT EXISTS public.powers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    action TEXT,
    usage TEXT,
    effect TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Magic Items Catalog
CREATE TABLE IF NOT EXISTS public.magic_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slot TEXT,
    action TEXT,
    usage TEXT,
    effect TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Skillsets Catalog
CREATE TABLE IF NOT EXISTS public.skillsets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    skills JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Catalog Tables
ALTER TABLE public.powers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skillsets ENABLE ROW LEVEL SECURITY;

-- Read-only select policies for all authenticated users
CREATE POLICY "Allow read-only select on powers" ON public.powers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read-only select on magic_items" ON public.magic_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read-only select on skillsets" ON public.skillsets FOR SELECT TO authenticated USING (true);
