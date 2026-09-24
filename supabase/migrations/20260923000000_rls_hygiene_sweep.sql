-- 20260923000000_rls_hygiene_sweep.sql
-- Phase 1: Database RLS Hygiene Sweep
-- Standardizes Row-Level Security across all 12 SupaFlex catalog and reference tables.
-- Purges legacy 'OR true' fallback policies, enforces strict canonical immunity for 'Designer' rows,
-- isolates custom user CRUD to authenticated owners, and guarantees universal public read access.

DO $$
DECLARE
    pol record;
    tbl text;
    user_owned_tables text[] := ARRAY[
        'paths',
        'powers',
        'weapons',
        'armor',
        'shields',
        'supplies',
        'traits',
        'skills',
        'chaos_gems',
        'mods',
        'gear_powers'
    ];
BEGIN
    -- =========================================================================
    -- PART 1: 11 USER-CREATION TABLES (with 'owner' column)
    -- =========================================================================
    FOREACH tbl IN ARRAY user_owned_tables LOOP
        -- 1. Drop all existing policies on this table to prevent conflicting/permissive policy leaks
        FOR pol IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = tbl
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
        END LOOP;

        -- 2. Master Architect Policy: metascapegame@gmail.com has full ALL access
        EXECUTE format(
            'CREATE POLICY "Allow metascapegame admin all on %I" ON public.%I ' ||
            'FOR ALL TO authenticated ' ||
            'USING ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);',
            tbl, tbl
        );

        -- 3. Sovereign User Policy: Regular users can ONLY manage rows they personally own (never Designer rows)
        EXECUTE format(
            'CREATE POLICY "Allow users to manage their own custom %I" ON public.%I ' ||
            'FOR ALL TO authenticated ' ||
            'USING (owner IS NOT NULL AND owner <> ''Designer''::text AND lower(trim(both from owner)) = lower(trim(both from (auth.jwt() ->> ''email''::text)))) ' ||
            'WITH CHECK (owner IS NOT NULL AND owner <> ''Designer''::text AND lower(trim(both from owner)) = lower(trim(both from (auth.jwt() ->> ''email''::text))));',
            tbl, tbl
        );

        -- 4. Universal Read Policy: Public / Anon / Authenticated can SELECT all rows
        EXECUTE format(
            'CREATE POLICY "Allow public read access on %I" ON public.%I ' ||
            'FOR SELECT TO public ' ||
            'USING (true);',
            tbl, tbl
        );

        -- 5. Service Role Policy: Internal automation, CLI scripts, and backup engines retain full bypass
        EXECUTE format(
            'CREATE POLICY "Service role full access on %I" ON public.%I ' ||
            'FOR ALL TO service_role ' ||
            'USING (true) ' ||
            'WITH CHECK (true);',
            tbl, tbl
        );

        -- 6. Ensure Row-Level Security is strictly enabled
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

        -- 7. Ensure role table permissions
        EXECUTE format('GRANT SELECT ON public.%I TO public, anon;', tbl);
        EXECUTE format('GRANT ALL ON public.%I TO authenticated, service_role;', tbl);
    END LOOP;

    -- =========================================================================
    -- PART 2: KITS TABLE (Purely Designer Reference Data, No 'owner' Column)
    -- =========================================================================
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'kits'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.kits;', pol.policyname);
    END LOOP;

    EXECUTE 'CREATE POLICY "Allow metascapegame admin all on kits" ON public.kits ' ||
            'FOR ALL TO authenticated ' ||
            'USING ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    EXECUTE 'CREATE POLICY "Allow public read access on kits" ON public.kits ' ||
            'FOR SELECT TO public USING (true);';

    EXECUTE 'CREATE POLICY "Service role full access on kits" ON public.kits ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT SELECT ON public.kits TO public, anon;';
    EXECUTE 'GRANT ALL ON public.kits TO authenticated, service_role;';

END $$;

NOTIFY pgrst, 'reload schema';
