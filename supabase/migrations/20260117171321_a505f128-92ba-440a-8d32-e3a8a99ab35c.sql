-- Remove old constraint and add updated one without 'original'
ALTER TABLE public.song_audios DROP CONSTRAINT IF EXISTS song_audios_naipe_check;

ALTER TABLE public.song_audios ADD CONSTRAINT song_audios_naipe_check 
CHECK (naipe = ANY (ARRAY['soprano'::text, 'contralto'::text, 'tenor'::text, 'baixo'::text, 'unissono'::text, 'todos'::text]));