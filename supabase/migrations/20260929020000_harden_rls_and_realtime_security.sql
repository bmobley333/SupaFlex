-- 20260929020000_harden_rls_and_realtime_security.sql
-- Phase 1: Comprehensive Supabase RLS Hardening & Anti-Sniffing Architecture
-- Purges all legacy wildcard 'Allow public all' policies across characters, adventures, parties,
-- party_session_members, custom_elements, and player_subscriptions.
-- Enforces strict sovereign owner isolation on characters (protecting character_vault and private notes),
-- locks down adventure structures and GM notes, and deploys the atomic Security Definer roster RPC.

DO $$
DECLARE
    pol record;
BEGIN
    -- =========================================================================
    -- 1. CHARACTERS TABLE: Strict Sovereign Owner Isolation
    -- =========================================================================
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'characters'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.characters;', pol.policyname);
    END LOOP;

    -- Owner sovereign access
    EXECUTE 'CREATE POLICY "Allow users manage own characters" ON public.characters ' ||
            'FOR ALL TO authenticated ' ||
            'USING (lower(trim(both from owner_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text)))) ' ||
            'WITH CHECK (lower(trim(both from owner_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))));';

    -- Master Admin full access
    EXECUTE 'CREATE POLICY "Allow metascapegame admin all on characters" ON public.characters ' ||
            'FOR ALL TO authenticated ' ||
            'USING ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    -- Service role full access
    EXECUTE 'CREATE POLICY "Service role full access on characters" ON public.characters ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT ALL ON public.characters TO authenticated, service_role;';
    EXECUTE 'REVOKE ALL ON public.characters FROM anon;';

    -- =========================================================================
    -- 2. ADVENTURES TABLE: GM & Master Admin Custody
    -- =========================================================================
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'adventures'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.adventures;', pol.policyname);
    END LOOP;

    -- GM sovereign management
    EXECUTE 'CREATE POLICY "Allow GM manage own adventures" ON public.adventures ' ||
            'FOR ALL TO authenticated ' ||
            'USING (lower(trim(both from gm_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK (lower(trim(both from gm_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    -- Public read strictly for published active adventures
    EXECUTE 'CREATE POLICY "Allow public read published adventures" ON public.adventures ' ||
            'FOR SELECT TO public ' ||
            'USING (is_published = true AND is_active = true);';

    -- Service role full access
    EXECUTE 'CREATE POLICY "Service role full access on adventures" ON public.adventures ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.adventures ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT ALL ON public.adventures TO authenticated, service_role;';
    EXECUTE 'GRANT SELECT ON public.adventures TO public, anon;';

    -- =========================================================================
    -- 3. PARTIES TABLE: Session Custody & Anti-Tampering
    -- =========================================================================
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'parties'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.parties;', pol.policyname);
    END LOOP;

    -- Public read active parties (to allow joining via 4-character room codes)
    EXECUTE 'CREATE POLICY "Allow public read active parties" ON public.parties ' ||
            'FOR SELECT TO public ' ||
            'USING (status <> ''expired''::text);';

    -- GM manage own parties
    EXECUTE 'CREATE POLICY "Allow GM manage own parties" ON public.parties ' ||
            'FOR ALL TO authenticated ' ||
            'USING (lower(trim(both from gm_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK (lower(trim(both from gm_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    -- Authenticated users can create party rows
    EXECUTE 'CREATE POLICY "Allow authenticated create parties" ON public.parties ' ||
            'FOR INSERT TO authenticated WITH CHECK (true);';

    -- Service role full access
    EXECUTE 'CREATE POLICY "Service role full access on parties" ON public.parties ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT ALL ON public.parties TO authenticated, service_role;';
    EXECUTE 'GRANT SELECT ON public.parties TO public, anon;';

    -- =========================================================================
    -- 4. PARTY_SESSION_MEMBERS TABLE: Self Session & GM Member Management
    -- =========================================================================
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'party_session_members'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.party_session_members;', pol.policyname);
    END LOOP;

    -- Public read roster members (needed for local roster hydration)
    EXECUTE 'CREATE POLICY "Allow public read roster members" ON public.party_session_members ' ||
            'FOR SELECT TO public USING (true);';

    -- Player manage own session
    EXECUTE 'CREATE POLICY "Allow player manage own session" ON public.party_session_members ' ||
            'FOR ALL TO authenticated ' ||
            'USING (lower(trim(both from player_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK (lower(trim(both from player_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    -- GM dismiss party members
    EXECUTE 'CREATE POLICY "Allow GM delete party members" ON public.party_session_members ' ||
            'FOR DELETE TO authenticated ' ||
            'USING (EXISTS (SELECT 1 FROM public.parties p WHERE (p.id = party_session_members.party_uuid OR p.id = party_session_members.party_id) AND (lower(trim(both from p.gm_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text)));';

    -- Service role full access
    EXECUTE 'CREATE POLICY "Service role full access on party_session_members" ON public.party_session_members ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.party_session_members ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT ALL ON public.party_session_members TO authenticated, service_role;';
    EXECUTE 'GRANT SELECT ON public.party_session_members TO public, anon;';

    -- =========================================================================
    -- 5. MONSTERS TABLE: Restrict Anonymous Codex Scraping
    -- =========================================================================
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monsters'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.monsters;', pol.policyname);
    END LOOP;

    EXECUTE 'CREATE POLICY "Allow authenticated read monsters" ON public.monsters ' ||
            'FOR SELECT TO authenticated USING (true);';

    EXECUTE 'CREATE POLICY "Allow metascapegame admin all on monsters" ON public.monsters ' ||
            'FOR ALL TO authenticated ' ||
            'USING ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK ((auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    EXECUTE 'CREATE POLICY "Service role full access on monsters" ON public.monsters ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.monsters TO authenticated, service_role;';

    -- =========================================================================
    -- 6. CUSTOM_ELEMENTS TABLE: Author Ownership & Approved Read
    -- =========================================================================
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_elements'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.custom_elements;', pol.policyname);
    END LOOP;

    EXECUTE 'CREATE POLICY "Allow authors manage own custom elements" ON public.custom_elements ' ||
            'FOR ALL TO authenticated ' ||
            'USING (lower(trim(both from author_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK (lower(trim(both from author_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    EXECUTE 'CREATE POLICY "Allow public read approved party custom elements" ON public.custom_elements ' ||
            'FOR SELECT TO public ' ||
            'USING (gm_approved = true OR lower(trim(both from author_email)) = lower(trim(both from coalesce((auth.jwt() ->> ''email''::text), ''''))));';

    EXECUTE 'CREATE POLICY "Service role full access on custom_elements" ON public.custom_elements ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.custom_elements ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT ALL ON public.custom_elements TO authenticated, service_role;';
    EXECUTE 'GRANT SELECT ON public.custom_elements TO public, anon;';

    -- =========================================================================
    -- 7. PLAYER_SUBSCRIPTIONS TABLE: Subscriber Sovereignty
    -- =========================================================================
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'player_subscriptions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.player_subscriptions;', pol.policyname);
    END LOOP;

    EXECUTE 'CREATE POLICY "Allow users manage own player subscriptions" ON public.player_subscriptions ' ||
            'FOR ALL TO authenticated ' ||
            'USING (lower(trim(both from subscriber_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text) ' ||
            'WITH CHECK (lower(trim(both from subscriber_email)) = lower(trim(both from (auth.jwt() ->> ''email''::text))) OR (auth.jwt() ->> ''email''::text) = ''metascapegame@gmail.com''::text);';

    EXECUTE 'CREATE POLICY "Service role full access on player_subscriptions" ON public.player_subscriptions ' ||
            'FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.player_subscriptions ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'GRANT ALL ON public.player_subscriptions TO authenticated, service_role;';

    -- =========================================================================
    -- 8. REFERENCE TABLES (loot_main, nish_tc, orphaned_traits): Public Read Only
    -- =========================================================================
    FOR pol IN 
        SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('loot_main', 'nish_tc', 'orphaned_traits')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
    END LOOP;

    EXECUTE 'CREATE POLICY "Allow public read on loot_main" ON public.loot_main FOR SELECT TO public USING (true);';
    EXECUTE 'CREATE POLICY "Service role full access on loot_main" ON public.loot_main FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'CREATE POLICY "Allow public read on nish_tc" ON public.nish_tc FOR SELECT TO public USING (true);';
    EXECUTE 'CREATE POLICY "Service role full access on nish_tc" ON public.nish_tc FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'CREATE POLICY "Allow public read on orphaned_traits" ON public.orphaned_traits FOR SELECT TO public USING (true);';
    EXECUTE 'CREATE POLICY "Service role full access on orphaned_traits" ON public.orphaned_traits FOR ALL TO service_role USING (true) WITH CHECK (true);';

    EXECUTE 'ALTER TABLE public.loot_main ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.nish_tc ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.orphaned_traits ENABLE ROW LEVEL SECURITY;';

    EXECUTE 'GRANT SELECT ON public.loot_main, public.nish_tc, public.orphaned_traits TO public, anon;';
    EXECUTE 'GRANT ALL ON public.loot_main, public.nish_tc, public.orphaned_traits TO authenticated, service_role;';

END $$;

-- =============================================================================
-- 9. ATOMIC SECURITY DEFINER RPC: public.get_party_roster_members
-- Safely exposes teammate combat scalars (name, class, race, hp, vitals, nish)
-- while 100% sealing character_vault, private inventory, and background notes.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_party_roster_members(p_party_id text)
RETURNS TABLE (
    id uuid,
    party_id uuid,
    party_code text,
    player_email text,
    character_id bigint,
    tab_session_id text,
    last_seen timestamptz,
    char_name text,
    char_race text,
    char_class text,
    char_hp integer,
    char_current_vitality integer,
    char_vitality_max integer,
    char_current_nish text,
    player_first_name text
) AS $$
DECLARE
    v_party_uuid uuid;
BEGIN
    -- 1. Resolve UUID from 4-character room code or UUID string
    IF length(trim(p_party_id)) = 4 THEN
        SELECT p.id INTO v_party_uuid 
        FROM public.parties p 
        WHERE (upper(p.party_code) = upper(trim(p_party_id)) OR upper(p.room_code) = upper(trim(p_party_id)))
        LIMIT 1;
    ELSE
        BEGIN
            v_party_uuid := trim(p_party_id)::uuid;
        EXCEPTION WHEN OTHERS THEN
            SELECT p.id INTO v_party_uuid 
            FROM public.parties p 
            WHERE (upper(p.party_code) = upper(trim(p_party_id)) OR upper(p.room_code) = upper(trim(p_party_id)))
            LIMIT 1;
        END;
    END IF;

    IF v_party_uuid IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        psm.id,
        COALESCE(psm.party_uuid, psm.party_id, v_party_uuid) AS party_id,
        psm.party_code,
        psm.player_email,
        psm.character_id,
        psm.tab_session_id,
        psm.last_seen,
        COALESCE(c.name, 'Hero #' || psm.character_id::text) AS char_name,
        COALESCE(c.race, 'Human'::text) AS char_race,
        COALESCE(c.class, 'Adventurer'::text) AS char_class,
        COALESCE(c.hp, 28) AS char_hp,
        COALESCE((c.sheet_data->>'current_vitality')::integer, c.hp, 28) AS char_current_vitality,
        COALESCE((c.sheet_data->>'vitality_max')::integer, 28) AS char_vitality_max,
        COALESCE(c.sheet_data->>'current_nish', c.might, 'd4'::text) AS char_current_nish,
        COALESCE(p.first_name, 'Player'::text) AS player_first_name
    FROM public.party_session_members psm
    LEFT JOIN public.characters c ON c.id = psm.character_id
    LEFT JOIN public.players p ON lower(trim(p.email)) = lower(trim(psm.player_email))
    WHERE (psm.party_uuid = v_party_uuid OR psm.party_id = v_party_uuid)
    ORDER BY psm.character_id ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_party_roster_members(text) TO authenticated, anon, public, service_role;

NOTIFY pgrst, 'reload schema';
