-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Anyone can view user roles"
  ON public.user_roles
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

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

-- Function to auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Trigger to assign user role on signup
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Update RLS policies for events table
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;

CREATE POLICY "Admins can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update events"
  ON public.events
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete events"
  ON public.events
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for songs table
DROP POLICY IF EXISTS "Users can create their own songs" ON public.songs;
DROP POLICY IF EXISTS "Users can update their own songs" ON public.songs;
DROP POLICY IF EXISTS "Users can delete their own songs" ON public.songs;

CREATE POLICY "Admins can create songs"
  ON public.songs
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update songs"
  ON public.songs
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete songs"
  ON public.songs
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for event_songs table
DROP POLICY IF EXISTS "Users can add songs to their events" ON public.event_songs;
DROP POLICY IF EXISTS "Users can update event_songs order" ON public.event_songs;
DROP POLICY IF EXISTS "Users can remove songs from their events" ON public.event_songs;

CREATE POLICY "Admins can add songs to events"
  ON public.event_songs
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update event_songs"
  ON public.event_songs
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can remove songs from events"
  ON public.event_songs
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for song_audios table
DROP POLICY IF EXISTS "Users can insert audios to their songs" ON public.song_audios;
DROP POLICY IF EXISTS "Users can update audios from their songs" ON public.song_audios;
DROP POLICY IF EXISTS "Users can delete audios from their songs" ON public.song_audios;

CREATE POLICY "Admins can insert audios"
  ON public.song_audios
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update audios"
  ON public.song_audios
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete audios"
  ON public.song_audios
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));