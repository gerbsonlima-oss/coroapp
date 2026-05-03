DROP POLICY IF EXISTS "Users can view songs in their tenants or public" ON public.songs;

CREATE POLICY "Users can view songs in their tenants or public"
ON public.songs
FOR SELECT
USING (
  is_public = true
  OR (auth.uid() IS NOT NULL AND tenant_id = ANY (get_user_tenant_ids(auth.uid())))
  OR EXISTS (
    SELECT 1 FROM public.event_songs es WHERE es.song_id = songs.id
  )
);