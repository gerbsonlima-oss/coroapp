-- Allow public read access to events
CREATE POLICY "Public can view shared events"
ON public.events
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow public read access to songs through event_songs
CREATE POLICY "Public can view songs"
ON public.songs
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow public read access to event_songs
CREATE POLICY "Public can view event_songs"
ON public.event_songs
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow public read access to song_audios
CREATE POLICY "Public can view song audios"
ON public.song_audios
FOR SELECT
TO anon, authenticated
USING (true);