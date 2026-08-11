-- 20260811000000_harden_players_rls.sql
-- Harden public.players table RLS and add RPC single-target cloning lookup

-- 1. Enable RLS on players
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy open public policy
DROP POLICY IF EXISTS "Allow public all on players" ON public.players;
DROP POLICY IF EXISTS "Allow select for authenticated players" ON public.players;
DROP POLICY IF EXISTS "Allow players to update their own profile" ON public.players;
DROP POLICY IF EXISTS "Allow public select on players" ON public.players;
DROP POLICY IF EXISTS "Players self select" ON public.players;
DROP POLICY IF EXISTS "Players self insert" ON public.players;
DROP POLICY IF EXISTS "Players self update" ON public.players;

-- 3. Create Strict Self-Only RLS Policies
CREATE POLICY "Players self select" 
    ON public.players FOR SELECT 
    TO public 
    USING (email = LOWER(TRIM(coalesce(auth.jwt() ->> 'email', ''))));

CREATE POLICY "Players self insert" 
    ON public.players FOR INSERT 
    TO public 
    WITH CHECK (email = LOWER(TRIM(coalesce(auth.jwt() ->> 'email', ''))));

CREATE POLICY "Players self update" 
    ON public.players FOR UPDATE 
    TO public 
    USING (email = LOWER(TRIM(coalesce(auth.jwt() ->> 'email', ''))));

-- 4. Create Single-Target RPC Function for Clone Permission Lookups
CREATE OR REPLACE FUNCTION public.get_player_cloning_profile(target_email text)
RETURNS TABLE (
    email text,
    allow_cloning boolean,
    player_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.email, 
        coalesce(p.allow_cloning, true) AS allow_cloning, 
        p.player_name
    FROM public.players p
    WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(target_email));
END;
$$;

-- 5. Grant Execute Rights to Playtest Roles
GRANT EXECUTE ON FUNCTION public.get_player_cloning_profile(text) TO anon, authenticated, service_role;
