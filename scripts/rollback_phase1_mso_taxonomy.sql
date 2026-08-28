-- C:\Repos\Projects\SupaFlex\scripts\rollback_phase1_mso_taxonomy.sql
-- Rollback Script for Phase 1 MSO Taxonomy & Quick Deck Migration

-- 1. powers table
ALTER TABLE public.powers 
    DROP COLUMN IF EXISTS usage_type,
    DROP COLUMN IF EXISTS source,
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS is_handicap,
    DROP COLUMN IF EXISTS flaw_points,
    DROP COLUMN IF EXISTS stat_hook;
DROP INDEX IF EXISTS idx_powers_table_lookup;
DROP INDEX IF EXISTS idx_powers_discipline;

-- 2. power_tables
DROP INDEX IF EXISTS idx_power_tables_cat;

-- 3. hardware table
ALTER TABLE public.hardware 
    DROP COLUMN IF EXISTS tier,
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS compatible_with,
    DROP COLUMN IF EXISTS table_group,
    DROP COLUMN IF EXISTS is_guildspace_locked;
DROP INDEX IF EXISTS idx_hardware_table_tier;

-- 4. relics table
ALTER TABLE public.relics 
    DROP COLUMN IF EXISTS tier,
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS table_group,
    DROP COLUMN IF EXISTS is_guildspace_locked;
DROP INDEX IF EXISTS idx_relics_table_tier;

-- 5. weapons table
ALTER TABLE public.weapons 
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS table_group,
    DROP COLUMN IF EXISTS compatible_with;
DROP INDEX IF EXISTS idx_weapons_table_group;

-- 6. armor table
ALTER TABLE public.armor 
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS table_group,
    DROP COLUMN IF EXISTS compatible_with;
DROP INDEX IF EXISTS idx_armor_table_group;

-- 7. shields table
ALTER TABLE public.shields 
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS table_group,
    DROP COLUMN IF EXISTS compatible_with;
DROP INDEX IF EXISTS idx_shields_discipline;

-- 8. gear table
ALTER TABLE public.gear 
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS table_group,
    DROP COLUMN IF EXISTS compatible_with;
DROP INDEX IF EXISTS idx_gear_table_group;

-- 9. skillsets table
ALTER TABLE public.skillsets 
    DROP COLUMN IF EXISTS discipline,
    DROP COLUMN IF EXISTS category;
DROP INDEX IF EXISTS idx_skillsets_category;
