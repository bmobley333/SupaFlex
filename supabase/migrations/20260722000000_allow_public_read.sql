-- 20260722000000_allow_public_read.sql
-- Enable public / anonymous read access on reference tables for SupaFlex Playtest Suite

-- Powers RLS Policies
ALTER TABLE public.powers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read-only select on powers" ON public.powers;
DROP POLICY IF EXISTS "Allow public select on powers" ON public.powers;
CREATE POLICY "Allow public select on powers" ON public.powers FOR SELECT TO public USING (true);

-- Magic Items RLS Policies
ALTER TABLE public.magic_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read-only select on magic_items" ON public.magic_items;
DROP POLICY IF EXISTS "Allow public select on magic_items" ON public.magic_items;
CREATE POLICY "Allow public select on magic_items" ON public.magic_items FOR SELECT TO public USING (true);

-- Skillsets RLS Policies
ALTER TABLE public.skillsets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read-only select on skillsets" ON public.skillsets;
DROP POLICY IF EXISTS "Allow public select on skillsets" ON public.skillsets;
CREATE POLICY "Allow public select on skillsets" ON public.skillsets FOR SELECT TO public USING (true);

-- Characters RLS Policies (playtest heroes)
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow players to view all characters in active playtests" ON public.characters;
DROP POLICY IF EXISTS "Allow public select on characters" ON public.characters;
CREATE POLICY "Allow public select on characters" ON public.characters FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public all on characters" ON public.characters;
CREATE POLICY "Allow public all on characters" ON public.characters FOR ALL TO public USING (true) WITH CHECK (true);
