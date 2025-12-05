-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create song_types table
CREATE TABLE public.song_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT,
  notes TEXT,
  cover_image_url TEXT,
  pdf_theme TEXT NOT NULL DEFAULT 'deep_blue_gold',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create songs table
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sheet_music_url TEXT,
  sheet_music_pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event_songs junction table
CREATE TABLE public.event_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs ON DELETE CASCADE,
  type TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, song_id, type)
);

-- Create song_audios table
CREATE TABLE public.song_audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  naipe TEXT NOT NULL CHECK (naipe IN ('soprano', 'contralto', 'tenor', 'baixo', 'original')),
  audio_url TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_song_types table
CREATE TABLE public.event_song_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  song_type_id UUID NOT NULL REFERENCES public.song_types(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, song_type_id)
);

-- Create indexes
CREATE INDEX idx_song_audios_song_id ON public.song_audios(song_id);
CREATE INDEX idx_song_audios_naipe ON public.song_audios(naipe);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_song_types ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Anyone can view user roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Song types policies
CREATE POLICY "Public can view song types" ON public.song_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage song types" ON public.song_types FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Events policies (public read, admin write)
CREATE POLICY "Public can view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admins can create events" ON public.events FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update events" ON public.events FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete events" ON public.events FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Songs policies (public read, admin write)
CREATE POLICY "Public can view songs" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Admins can create songs" ON public.songs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update songs" ON public.songs FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete songs" ON public.songs FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Event songs policies
CREATE POLICY "Public can view event_songs" ON public.event_songs FOR SELECT USING (true);
CREATE POLICY "Admins can add songs to events" ON public.event_songs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update event_songs" ON public.event_songs FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can remove songs from events" ON public.event_songs FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Song audios policies
CREATE POLICY "Public can view song audios" ON public.song_audios FOR SELECT USING (true);
CREATE POLICY "Admins can insert audios" ON public.song_audios FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update audios" ON public.song_audios FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete audios" ON public.song_audios FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Event song types policies
CREATE POLICY "Public can view event song types" ON public.event_song_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage event song types" ON public.event_song_types FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Update timestamp function
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

-- Triggers for updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Handle new user signup (profile + role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-files', 'audio-files', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('sheet-music', 'sheet-music', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true);

-- Storage policies for audio-files
CREATE POLICY "Audio files are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'audio-files');
CREATE POLICY "Users can upload audio files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their audio files" ON storage.objects FOR DELETE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for sheet-music
CREATE POLICY "Sheet music is publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'sheet-music');
CREATE POLICY "Users can upload sheet music" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'sheet-music' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their sheet music" ON storage.objects FOR DELETE USING (bucket_id = 'sheet-music' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for event-covers
CREATE POLICY "Event covers are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'event-covers');
CREATE POLICY "Users can upload event covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-covers' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their event covers" ON storage.objects FOR DELETE USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed default liturgical song types
INSERT INTO public.song_types (slug, name, description, order_index)
VALUES
  ('canto_entrada', 'Canto de Entrada', 'Canto de entrada da missa', 1),
  ('ato_penitencial', 'Ato Penitencial (Kyrie)', 'Momento de pedido de perdão', 2),
  ('gloria', 'Glória', 'Hino de louvor (Glória)', 3),
  ('salmo', 'Salmo Responsorial', 'Salmo entre as leituras', 4),
  ('aclamacao', 'Aclamação ao Evangelho (Aleluia)', 'Aclamação antes do Evangelho', 5),
  ('oferendas', 'Canto das Oferendas (Ofertório)', 'Canto das oferendas', 6),
  ('santo', 'Santo', 'Aclamação do Santo', 7),
  ('cordeiro', 'Cordeiro de Deus', 'Canto Cordeiro de Deus', 8),
  ('comunhao', 'Canto da Comunhão', 'Canto durante a comunhão', 9),
  ('acao_gracas', 'Canto de Ação de Graças', 'Canto após comunhão', 10),
  ('final', 'Canto Final (ou de Envio)', 'Canto de envio/final', 11);