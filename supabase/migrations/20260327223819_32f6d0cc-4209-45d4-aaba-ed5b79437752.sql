
-- Add type_name text column to event_song_types
ALTER TABLE public.event_song_types ADD COLUMN type_name text;

-- Make song_type_id nullable (was NOT NULL via FK)
ALTER TABLE public.event_song_types ALTER COLUMN song_type_id DROP NOT NULL;

-- Backfill type_name from existing song_types
UPDATE public.event_song_types est
SET type_name = st.name
FROM public.song_types st
WHERE est.song_type_id = st.id AND est.type_name IS NULL;
