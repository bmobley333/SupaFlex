-- 20260810000000_fix_players_rls_and_auto_provision.sql
-- Fix RLS policies on public.players, drop fragile FK constraint, and add auto-provisioning trigger

-- 1. Enable RLS and grant full permissions to public/authenticated playtest users on players table
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for authenticated players" ON public.players;
DROP POLICY IF EXISTS "Allow players to update their own profile" ON public.players;
DROP POLICY IF EXISTS "Allow public select on players" ON public.players;
DROP POLICY IF EXISTS "Allow public all on players" ON public.players;

CREATE POLICY "Allow public all on players" ON public.players
    FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Drop fragile Foreign Key constraint on characters.owner_email to prevent creation crashes
ALTER TABLE public.characters DROP CONSTRAINT IF EXISTS characters_owner_email_fkey;

-- 3. Create Trigger Function to Auto-Provision Missing Player Profiles on Character Creation/Update
CREATE OR REPLACE FUNCTION public.auto_provision_player_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_email IS NOT NULL AND TRIM(NEW.owner_email) <> '' THEN
        INSERT INTO public.players (email, allow_cloning, created_at)
        VALUES (LOWER(TRIM(NEW.owner_email)), true, NOW())
        ON CONFLICT (email) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach Trigger to public.characters Table
DROP TRIGGER IF EXISTS trg_auto_provision_player ON public.characters;
CREATE TRIGGER trg_auto_provision_player
    BEFORE INSERT OR UPDATE ON public.characters
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_provision_player_profile();

-- 5. Backfill any existing orphan character owner emails into public.players
INSERT INTO public.players (email, allow_cloning, created_at)
SELECT DISTINCT LOWER(TRIM(owner_email)), true, NOW()
FROM public.characters
WHERE owner_email IS NOT NULL AND TRIM(owner_email) <> ''
ON CONFLICT (email) DO NOTHING;
