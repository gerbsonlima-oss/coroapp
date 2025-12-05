-- Remove políticas duplicadas de SELECT que restringem acesso
DROP POLICY IF EXISTS "Users can view their own events" ON public.events;
DROP POLICY IF EXISTS "Users can view event_songs for their events" ON public.event_songs;
DROP POLICY IF EXISTS "Users can view their own songs" ON public.songs;
DROP POLICY IF EXISTS "Users can view audios from their songs" ON public.song_audios;

-- Garante que as políticas públicas de leitura existem e estão corretas
DROP POLICY IF EXISTS "Public can view shared events" ON public.events;
CREATE POLICY "Public can view all events" 
ON public.events 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Public can view event_songs" ON public.event_songs;
CREATE POLICY "Public can view all event_songs" 
ON public.event_songs 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Public can view songs" ON public.songs;
CREATE POLICY "Public can view all songs" 
ON public.songs 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Public can view song audios" ON public.song_audios;
CREATE POLICY "Public can view all song_audios" 
ON public.song_audios 
FOR SELECT 
USING (true);

-- Profiles: permite que todos vejam todos os perfis (apenas leitura)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Public can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Mantém as políticas de INSERT/UPDATE/DELETE apenas para usuários autenticados que possuem os recursos
-- (essas políticas já existem e estão corretas, não precisa alterar)