-- Migration: party_blueprint_v2_5
-- Implements Schema v2.5 for SupaFlex Master Party & Session Architecture

-- 1. Master Parties Table
CREATE TABLE IF NOT EXISTS public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_code text UNIQUE NOT NULL,
  gm_email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'orphaned', 'expired'))
);

-- Ensure required columns exist if updating an existing table
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS party_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS gm_email text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 2. Party Session Members Table
CREATE TABLE IF NOT EXISTS public.party_session_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_uuid uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  party_code text NOT NULL,
  player_email text NOT NULL,
  character_id bigint NOT NULL,
  tab_session_id text NOT NULL UNIQUE,
  last_seen timestamptz DEFAULT now()
);

-- Ensure required columns exist on party_session_members
ALTER TABLE public.party_session_members
  ADD COLUMN IF NOT EXISTS party_uuid uuid REFERENCES public.parties(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS party_code text,
  ADD COLUMN IF NOT EXISTS player_email text,
  ADD COLUMN IF NOT EXISTS character_id bigint,
  ADD COLUMN IF NOT EXISTS tab_session_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_parties_code ON public.parties(party_code);
CREATE INDEX IF NOT EXISTS idx_psm_party_uuid ON public.party_session_members(party_uuid);
CREATE INDEX IF NOT EXISTS idx_psm_tab_char ON public.party_session_members(tab_session_id, character_id);
CREATE INDEX IF NOT EXISTS idx_psm_last_seen ON public.party_session_members(last_seen);

-- 4. Row Level Security (RLS) Policies
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_session_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read active parties" ON public.parties;
CREATE POLICY "Allow public read active parties" ON public.parties
  FOR SELECT USING (status != 'expired');

DROP POLICY IF EXISTS "Allow public read roster members" ON public.party_session_members;
CREATE POLICY "Allow public read roster members" ON public.party_session_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow GM manage party" ON public.parties;
CREATE POLICY "Allow GM manage party" ON public.parties
  FOR ALL USING (auth.jwt() ->> 'email' = gm_email);

DROP POLICY IF EXISTS "Allow player manage own session" ON public.party_session_members;
CREATE POLICY "Allow player manage own session" ON public.party_session_members
  FOR ALL USING (auth.jwt() ->> 'email' = player_email);

-- 5. Atomic Database Functions (RPCs)

-- Atomic Join Function: Deletes old tab/char instances before inserting new session row
CREATE OR REPLACE FUNCTION public.join_party_session_atomic(
  p_party_code text,
  p_email text,
  p_char_id bigint,
  p_tab_id text
) RETURNS uuid AS $$
DECLARE
  v_party_uuid uuid;
BEGIN
  -- Resolve active party UUID
  SELECT id INTO v_party_uuid
  FROM public.parties
  WHERE (party_code = UPPER(p_party_code) OR id::text = p_party_code) AND status != 'expired'
  LIMIT 1;

  IF v_party_uuid IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired Party Code: %', p_party_code;
  END IF;

  -- Remove stale ghost sessions for this tab or character
  DELETE FROM public.party_session_members
  WHERE tab_session_id = p_tab_id OR character_id = p_char_id;

  -- Insert fresh membership record
  INSERT INTO public.party_session_members (
    party_uuid, party_code, player_email, character_id, tab_session_id, last_seen
  ) VALUES (
    v_party_uuid, UPPER(p_party_code), LOWER(p_email), p_char_id, p_tab_id, NOW()
  );

  RETURN v_party_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic Heartbeat Function
CREATE OR REPLACE FUNCTION public.send_player_heartbeat_atomic(
  p_tab_id text
) RETURNS void AS $$
BEGIN
  UPDATE public.party_session_members
  SET last_seen = NOW()
  WHERE tab_session_id = p_tab_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
