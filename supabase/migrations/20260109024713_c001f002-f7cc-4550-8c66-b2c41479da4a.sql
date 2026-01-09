-- Drop existing constraint
ALTER TABLE public.song_audios DROP CONSTRAINT song_audios_naipe_check;

-- Add updated constraint with 'unissono' included
ALTER TABLE public.song_audios ADD CONSTRAINT song_audios_naipe_check 
CHECK (naipe = ANY (ARRAY['soprano'::text, 'contralto'::text, 'tenor'::text, 'baixo'::text, 'original'::text, 'unissono'::text, 'todos'::text]));