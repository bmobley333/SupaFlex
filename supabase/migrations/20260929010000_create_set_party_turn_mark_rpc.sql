-- Migration: 20260929010000_create_set_party_turn_mark_rpc.sql
-- Description: Atomic PostgreSQL functions to set, unmark, and clear party turn marks
-- Guarantees zero lost updates and zero egress overhead.

CREATE OR REPLACE FUNCTION public.set_party_turn_mark(
  p_party_id text,
  p_member_id text,
  p_marked boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated jsonb;
  v_target_id uuid;
BEGIN
  BEGIN
    v_target_id := p_party_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_target_id FROM public.parties WHERE upper(room_code) = upper(p_party_id) OR upper(party_code) = upper(p_party_id) LIMIT 1;
  END;

  IF v_target_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  UPDATE public.parties
  SET marked_turn_ids = CASE
    WHEN p_marked THEN
      CASE
        WHEN COALESCE(marked_turn_ids, '[]'::jsonb) @> to_jsonb(p_member_id) THEN COALESCE(marked_turn_ids, '[]'::jsonb)
        ELSE COALESCE(marked_turn_ids, '[]'::jsonb) || to_jsonb(p_member_id)
      END
    ELSE
      COALESCE(marked_turn_ids, '[]'::jsonb) - p_member_id
  END
  WHERE id = v_target_id
  RETURNING marked_turn_ids INTO v_updated;

  RETURN COALESCE(v_updated, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_party_turn_marks(
  p_party_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id uuid;
BEGIN
  BEGIN
    v_target_id := p_party_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_target_id FROM public.parties WHERE upper(room_code) = upper(p_party_id) OR upper(party_code) = upper(p_party_id) LIMIT 1;
  END;

  IF v_target_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  UPDATE public.parties
  SET marked_turn_ids = '[]'::jsonb
  WHERE id = v_target_id;

  RETURN '[]'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_party_turn_mark(text, text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_party_turn_marks(text) TO anon, authenticated, service_role;
