
-- Migration: 20251106003654

-- Migration: 20251105235822

-- Migration: 20251105203724
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Users can view their own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- Create songs table
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'perdao', 'ofertorio', 'comunhao', 'final', 'outro')),
  sheet_music_url TEXT,
  soprano_url TEXT,
  contralto_url TEXT,
  tenor_url TEXT,
  baixo_url TEXT,
  original_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on songs
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Songs policies
CREATE POLICY "Users can view their own songs"
  ON public.songs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own songs"
  ON public.songs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own songs"
  ON public.songs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own songs"
  ON public.songs FOR DELETE
  USING (auth.uid() = user_id);

-- Create event_songs junction table
CREATE TABLE public.event_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, song_id)
);

-- Enable RLS on event_songs
ALTER TABLE public.event_songs ENABLE ROW LEVEL SECURITY;

-- Event_songs policies
CREATE POLICY "Users can view event_songs for their events"
  ON public.event_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_songs.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add songs to their events"
  ON public.event_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_songs.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove songs from their events"
  ON public.event_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_songs.event_id
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update event_songs order"
  ON public.event_songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_songs.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audio-files', 'audio-files', false);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('sheet-music', 'sheet-music', false);

-- Storage policies for audio-files
CREATE POLICY "Users can upload their own audio files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own audio files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own audio files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for sheet-music
CREATE POLICY "Users can upload their own sheet music"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sheet-music'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own sheet music"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'sheet-music'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own sheet music"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'sheet-music'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON public.songs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Migration: 20251105203752
-- Fix security warning: set search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- Migration: 20251106000216
-- Force types regeneration by adding a comment
COMMENT ON TABLE public.events IS 'Events table for storing user events';
COMMENT ON TABLE public.songs IS 'Songs table for storing choir music';
COMMENT ON TABLE public.event_songs IS 'Junction table for events and songs';
COMMENT ON TABLE public.profiles IS 'User profiles table';


-- Migration: 20251106004439
-- Tornar o bucket audio-files público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'audio-files';

-- Migration: 20251106005947
-- Tornar o bucket sheet-music público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'sheet-music';

-- Migration: 20251106012420
-- Criar tabela para múltiplos áudios por naipe
CREATE TABLE public.song_audios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  naipe TEXT NOT NULL CHECK (naipe IN ('soprano', 'contralto', 'tenor', 'baixo', 'original')),
  audio_url TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para buscas eficientes
CREATE INDEX idx_song_audios_song_id ON public.song_audios(song_id);
CREATE INDEX idx_song_audios_naipe ON public.song_audios(naipe);

-- Habilitar RLS
ALTER TABLE public.song_audios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view audios from their songs"
ON public.song_audios
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.songs
  WHERE songs.id = song_audios.song_id
  AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can insert audios to their songs"
ON public.song_audios
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.songs
  WHERE songs.id = song_audios.song_id
  AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can update audios from their songs"
ON public.song_audios
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.songs
  WHERE songs.id = song_audios.song_id
  AND songs.user_id = auth.uid()
));

CREATE POLICY "Users can delete audios from their songs"
ON public.song_audios
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.songs
  WHERE songs.id = song_audios.song_id
  AND songs.user_id = auth.uid()
));

-- Migrar dados existentes dos campos antigos para a nova tabela
INSERT INTO public.song_audios (song_id, naipe, audio_url, name)
SELECT id, 'soprano', soprano_url, 'Soprano' FROM public.songs WHERE soprano_url IS NOT NULL
UNION ALL
SELECT id, 'contralto', contralto_url, 'Contralto' FROM public.songs WHERE contralto_url IS NOT NULL
UNION ALL
SELECT id, 'tenor', tenor_url, 'Tenor' FROM public.songs WHERE tenor_url IS NOT NULL
UNION ALL
SELECT id, 'baixo', baixo_url, 'Baixo' FROM public.songs WHERE baixo_url IS NOT NULL
UNION ALL
SELECT id, 'original', original_url, 'Original' FROM public.songs WHERE original_url IS NOT NULL;
