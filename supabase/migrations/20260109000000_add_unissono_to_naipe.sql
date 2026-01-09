-- Update the check constraint on song_audios to allow 'unissono'
ALTER TABLE public.song_audios DROP CONSTRAINT IF EXISTS song_audios_naipe_check;
ALTER TABLE public.song_audios ADD CONSTRAINT song_audios_naipe_check CHECK (naipe IN ('soprano', 'contralto', 'tenor', 'baixo', 'unissono', 'original'));