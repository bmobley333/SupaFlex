-- 20260907000000_rename_spec_rules_to_traits_and_perks.sql
-- 1. Rename table spec_rules to traits
ALTER TABLE IF EXISTS public.spec_rules RENAME TO traits;

-- 2. Rename sequence if exists and grant permissions
ALTER SEQUENCE IF EXISTS public.spec_rules_id_seq RENAME TO traits_id_seq;
GRANT ALL ON public.traits TO postgres, anon, authenticated, service_role;
GRANT ALL ON SEQUENCE public.traits_id_seq TO postgres, anon, authenticated, service_role;

-- 3. Update RLS policies on traits
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'traits' AND policyname = 'Allow public read traits'
    ) THEN
        CREATE POLICY "Allow public read traits" ON public.traits FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'traits' AND policyname = 'Allow service_role all traits'
    ) THEN
        CREATE POLICY "Allow service_role all traits" ON public.traits FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Update {Trait} to {Perk} across path columns
UPDATE public.traits SET path = replace(path, '{Trait}', '{Perk}') WHERE path LIKE '%{Trait}%';
UPDATE public.skills SET path = replace(path, '{Trait}', '{Perk}') WHERE path LIKE '%{Trait}%';
UPDATE public.powers SET path = replace(path, '{Trait}', '{Perk}') WHERE path LIKE '%{Trait}%';
UPDATE public.weapons SET path = replace(path, '{Trait}', '{Perk}') WHERE path LIKE '%{Trait}%';
UPDATE public.armor SET path = replace(path, '{Trait}', '{Perk}') WHERE path LIKE '%{Trait}%';
UPDATE public.supplies SET path = replace(path, '{Trait}', '{Perk}') WHERE path LIKE '%{Trait}%';
