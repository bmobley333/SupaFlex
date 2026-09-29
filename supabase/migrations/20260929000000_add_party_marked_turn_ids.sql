-- Migration: Add marked_turn_ids to parties table
ALTER TABLE public.parties 
  ADD COLUMN IF NOT EXISTS marked_turn_ids jsonb DEFAULT '[]'::jsonb;
