-- Add lyrics column to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics TEXT;