ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS pdf_cover_url TEXT,
ADD COLUMN IF NOT EXISTS pdf_back_cover_url TEXT;