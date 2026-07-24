-- 20260724000000_create_new_tables.sql
-- Migration to create weapons, armor, shields, gear, and monsters tables

CREATE TABLE IF NOT EXISTS public.weapons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    requirement TEXT,
    max_block TEXT,
    atk_dmg TEXT,
    cost TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.armor (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    requirement TEXT,
    dodge TEXT,
    ar TEXT,
    mr TEXT,
    cost TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shields (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    requirement TEXT,
    max_block TEXT,
    mr TEXT,
    description TEXT,
    cost TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gear (
    id SERIAL PRIMARY KEY,
    category TEXT,
    name TEXT NOT NULL,
    cost TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.monsters (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    nish TEXT,
    mr TEXT,
    atk_dmg_ftg TEXT,
    dod_ar TEXT,
    vit TEXT,
    attributes TEXT,
    abilities TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
