
ALTER TABLE public.songs ADD COLUMN is_public BOOLEAN DEFAULT false;

-- Update SELECT policy to include public songs
DROP POLICY "Users can view songs in their tenant" ON public.songs;
CREATE POLICY "Users can view songs in their tenant or public"
  ON public.songs FOR SELECT
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()))
    OR is_public = true
    OR (auth.uid() IS NULL)
  );

-- Also update song_audios SELECT to allow viewing audios of public songs
DROP POLICY "Users can view song audios in their tenant" ON public.song_audios;
CREATE POLICY "Users can view song audios in their tenant or public songs"
  ON public.song_audios FOR SELECT
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()))
    OR (auth.uid() IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.songs s
      WHERE s.id = song_audios.song_id AND s.is_public = true
    )
  );
