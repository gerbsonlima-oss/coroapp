-- 1. songs: tighten anon access to is_public only
DROP POLICY IF EXISTS "Users can view songs in their tenants or public" ON public.songs;

CREATE POLICY "Users can view songs in their tenants or public"
ON public.songs FOR SELECT
USING (
  is_public = true
  OR (auth.uid() IS NOT NULL AND tenant_id = ANY (get_user_tenant_ids(auth.uid())))
);

-- 2. song_audios: anon only sees audios for public songs
DROP POLICY IF EXISTS "Users can view song audios in their tenants or public songs" ON public.song_audios;

CREATE POLICY "Users can view song audios in their tenants or public songs"
ON public.song_audios FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.songs s
    WHERE s.id = song_audios.song_id AND s.is_public = true
  )
  OR (auth.uid() IS NOT NULL AND tenant_id = ANY (get_user_tenant_ids(auth.uid())))
);

-- 3. user_roles: don't expose super_admin user_ids to all authenticated users
DROP POLICY IF EXISTS "Users can view roles in their tenants" ON public.user_roles;

CREATE POLICY "Users can view roles in their tenants"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR (tenant_id IS NOT NULL AND tenant_id = ANY (get_user_tenant_ids(auth.uid())))
  OR is_super_admin(auth.uid())
);

-- 4. Storage upload policies: enforce first-folder-segment matches a tenant the user belongs to
DROP POLICY IF EXISTS "Authenticated users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload event covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload sheet music" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload sheet music" ON storage.objects;

CREATE POLICY "Tenant members can upload audio files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-files'
  AND (
    (storage.foldername(name))[1]::uuid = ANY (get_user_tenant_ids(auth.uid()))
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Tenant members can upload event covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-covers'
  AND (
    (storage.foldername(name))[1]::uuid = ANY (get_user_tenant_ids(auth.uid()))
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Tenant members can upload sheet music"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sheet-music'
  AND (
    (storage.foldername(name))[1]::uuid = ANY (get_user_tenant_ids(auth.uid()))
    OR is_super_admin(auth.uid())
  )
);