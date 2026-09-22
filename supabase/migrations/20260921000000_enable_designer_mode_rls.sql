-- 20260921000000_enable_designer_mode_rls.sql
-- Enables metascapegame@gmail.com (Master Architect) full CRUD access to all canonical reference tables in Supabase.

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'paths',
        'powers',
        'weapons',
        'armor',
        'shields',
        'supplies',
        'traits',
        'chaos_gems',
        'mods',
        'gear_powers',
        'kits',
        'skills'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        -- Drop existing policy if any to ensure clean idempotent re-run
        EXECUTE format('DROP POLICY IF EXISTS "Allow metascapegame admin all on %I" ON public.%I;', tbl, tbl);
        
        -- Create ALL policy strictly locked to authenticated user with email metascapegame@gmail.com
        EXECUTE format(
            'CREATE POLICY "Allow metascapegame admin all on %I" ON public.%I ' ||
            'FOR ALL TO authenticated ' ||
            'USING ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);',
            tbl, tbl
        );
        
        -- Ensure table has RLS enabled
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Grant permissions to authenticated and service_role
        EXECUTE format('GRANT ALL ON public.%I TO authenticated, service_role;', tbl);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
