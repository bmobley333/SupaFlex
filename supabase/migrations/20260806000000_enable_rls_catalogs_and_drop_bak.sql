-- 20260806000000_enable_rls_catalogs_and_drop_bak.sql
-- Migration to drop legacy bak_ tables and enable RLS with public read policies on catalog tables

-- 1. Drop legacy backup tables
DROP TABLE IF EXISTS public.bak_magic_items CASCADE;
DROP TABLE IF EXISTS public.bak_powers CASCADE;
DROP TABLE IF EXISTS public.bak_skillsets CASCADE;

-- 2. Enable Row Level Security on catalog tables
ALTER TABLE public.armor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weapons ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any to ensure clean idempotent execution
DROP POLICY IF EXISTS "Allow public read armor" ON public.armor;
DROP POLICY IF EXISTS "Allow public read gear" ON public.gear;
DROP POLICY IF EXISTS "Allow public read monsters" ON public.monsters;
DROP POLICY IF EXISTS "Allow public read shields" ON public.shields;
DROP POLICY IF EXISTS "Allow public read weapons" ON public.weapons;

-- 4. Create public SELECT policies
CREATE POLICY "Allow public read armor" ON public.armor FOR SELECT USING (true);
CREATE POLICY "Allow public read gear" ON public.gear FOR SELECT USING (true);
CREATE POLICY "Allow public read monsters" ON public.monsters FOR SELECT USING (true);
CREATE POLICY "Allow public read shields" ON public.shields FOR SELECT USING (true);
CREATE POLICY "Allow public read weapons" ON public.weapons FOR SELECT USING (true);
