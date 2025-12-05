-- Remove campos de naipe da tabela songs
-- Os áudios agora são gerenciados pela tabela song_audios
ALTER TABLE public.songs 
DROP COLUMN IF EXISTS soprano_url,
DROP COLUMN IF EXISTS contralto_url,
DROP COLUMN IF EXISTS tenor_url,
DROP COLUMN IF EXISTS baixo_url,
DROP COLUMN IF EXISTS original_url;