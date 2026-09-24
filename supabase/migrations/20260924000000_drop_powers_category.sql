-- 20260924000000_drop_powers_category.sql
-- Deprecate legacy 'category' column from public.powers (superseded 100% by 'path')

ALTER TABLE public.powers DROP COLUMN IF EXISTS category;

NOTIFY pgrst, 'reload schema';
