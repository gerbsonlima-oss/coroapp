DROP POLICY IF EXISTS "Users can view song audios in their tenants or public songs" ON public.song_audios;

CREATE POLICY "Users can view song audios in their tenants or public songs"
ON public.song_audios
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.songs s
    WHERE s.id = song_audios.song_id AND s.is_public = true
  )
  OR (auth.uid() IS NOT NULL AND tenant_id = ANY (get_user_tenant_ids(auth.uid())))
  OR EXISTS (
    SELECT 1 FROM public.event_songs es
    WHERE es.song_id = song_audios.song_id
  )
);