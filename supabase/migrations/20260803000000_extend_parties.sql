CREATE TABLE IF NOT EXISTS public.parties (
  id SERIAL PRIMARY KEY,
  gm_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS name text DEFAULT 'GM Campaign',
  ADD COLUMN IF NOT EXISTS room_code text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS active_monsters jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS parties_room_code_idx ON public.parties (room_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS parties_gm_email_idx ON public.parties (gm_email);

