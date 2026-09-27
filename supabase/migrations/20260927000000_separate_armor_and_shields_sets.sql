-- =============================================================================
-- Migration: 20260927000000_separate_armor_and_shields_sets.sql
-- Description: Separates 'Armor & Shields' into distinct 'Armor' and 'Shields' categories
--              for public.sets table.
-- =============================================================================

ALTER TABLE public.sets DROP CONSTRAINT IF EXISTS sets_category_check;
ALTER TABLE public.sets ADD CONSTRAINT sets_category_check 
    CHECK (category IN ('Traits', 'Skills', 'Powers', 'Weapons', 'Armor', 'Shields', 'Armor & Shields'));

-- Migrate existing records
UPDATE public.sets 
SET category = 'Armor' 
WHERE category = 'Armor & Shields' AND lower(name) LIKE '%armor%';

UPDATE public.sets 
SET category = 'Shields' 
WHERE category = 'Armor & Shields' AND lower(name) LIKE '%shield%';
