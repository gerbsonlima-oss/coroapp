-- Add song_sheet_url column to events table for storing the PDF of song sheets
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS song_sheet_url text;