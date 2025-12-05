-- Drop legacy check constraint that restricts song types to a fixed list
ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_type_check;