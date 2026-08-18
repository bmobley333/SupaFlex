-- Add is_published column and index to public.adventures table
ALTER TABLE public.adventures
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_adventures_is_published ON public.adventures(is_published);
