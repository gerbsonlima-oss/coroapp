DROP POLICY "Users can view song types in their tenant" ON public.song_types;
CREATE POLICY "Users can view all song types"
  ON public.song_types FOR SELECT
  USING (true);