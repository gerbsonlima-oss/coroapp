-- Padroniza os naipes de audio para os 4 principais + "4 vozes"
ALTER TABLE public.song_audios
DROP CONSTRAINT IF EXISTS song_audios_naipe_check;

UPDATE public.song_audios
SET naipe = CASE
  WHEN lower(trim(naipe)) = 'soprano' THEN 'soprano'
  WHEN lower(trim(naipe)) = 'contralto' THEN 'contralto'
  WHEN lower(trim(naipe)) = 'tenor' THEN 'tenor'
  WHEN lower(trim(naipe)) = 'baixo' THEN 'baixo'
  WHEN lower(trim(naipe)) IN ('4 vozes', '4vozes', '4-vozes', 'quatro vozes', 'original', 'unissono', 'todos') THEN '4 vozes'
  ELSE '4 vozes'
END;

ALTER TABLE public.song_audios
ADD CONSTRAINT song_audios_naipe_check
CHECK (
  naipe = ANY (
    ARRAY[
      'soprano'::text,
      'contralto'::text,
      'tenor'::text,
      'baixo'::text,
      '4 vozes'::text
    ]
  )
);
