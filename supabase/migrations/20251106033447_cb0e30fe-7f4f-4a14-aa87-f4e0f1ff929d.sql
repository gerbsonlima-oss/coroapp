-- Add type column to event_songs table
ALTER TABLE public.event_songs 
ADD COLUMN type text;

-- Add a comment to explain the column
COMMENT ON COLUMN public.event_songs.type IS 'Tipo de música na ordem da missa (Canto de Entrada, Ato Penitencial, etc.)';