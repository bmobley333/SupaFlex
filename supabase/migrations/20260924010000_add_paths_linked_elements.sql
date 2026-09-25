-- =============================================================================
-- Migration: 20260924010000_add_paths_linked_elements.sql
-- Description: Adds linked_elements JSONB column and GIN index to public.paths.
-- Allows Paths to store manifests of individual abilities and linked sets.
-- =============================================================================

ALTER TABLE public.paths 
ADD COLUMN IF NOT EXISTS linked_elements JSONB DEFAULT '[]'::JSONB;

CREATE INDEX IF NOT EXISTS idx_paths_linked_elements 
ON public.paths USING gin(linked_elements);
