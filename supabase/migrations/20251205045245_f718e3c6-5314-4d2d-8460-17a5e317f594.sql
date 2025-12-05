-- Adiciona coluna para tema de PDF nos eventos
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS pdf_theme text NOT NULL DEFAULT 'deep_blue_gold';