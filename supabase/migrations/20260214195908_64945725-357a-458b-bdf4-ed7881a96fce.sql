
-- Function to get ALL tenant IDs a user belongs to (from user_roles)
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT tenant_id) FILTER (WHERE tenant_id IS NOT NULL),
    ARRAY[]::uuid[]
  )
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Update RLS policies for events to support multi-tenant viewing
DROP POLICY IF EXISTS "Users can view events in their tenant" ON public.events;
CREATE POLICY "Users can view events in their tenants"
ON public.events
FOR SELECT
USING (
  (tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  OR (auth.uid() IS NULL)
);

-- Update RLS for songs
DROP POLICY IF EXISTS "Users can view songs in their tenant or public" ON public.songs;
CREATE POLICY "Users can view songs in their tenants or public"
ON public.songs
FOR SELECT
USING (
  (tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  OR (is_public = true)
  OR (auth.uid() IS NULL)
);

-- Update RLS for song_audios
DROP POLICY IF EXISTS "Users can view song audios in their tenant or public songs" ON public.song_audios;
CREATE POLICY "Users can view song audios in their tenants or public songs"
ON public.song_audios
FOR SELECT
USING (
  (tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  OR (auth.uid() IS NULL)
  OR (EXISTS (
    SELECT 1 FROM songs s WHERE s.id = song_audios.song_id AND s.is_public = true
  ))
);

-- Update RLS for event_songs
DROP POLICY IF EXISTS "Users can view event songs in their tenant" ON public.event_songs;
CREATE POLICY "Users can view event songs in their tenants"
ON public.event_songs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_songs.event_id
    AND (
      e.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
      OR auth.uid() IS NULL
    )
  )
);

-- Update RLS for event_song_types
DROP POLICY IF EXISTS "Users can view event song types in their tenant" ON public.event_song_types;
CREATE POLICY "Users can view event song types in their tenants"
ON public.event_song_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_song_types.event_id
    AND (
      e.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
      OR auth.uid() IS NULL
    )
  )
);

-- Update RLS for rehearsals
DROP POLICY IF EXISTS "Users can view rehearsals in their tenant" ON public.rehearsals;
CREATE POLICY "Users can view rehearsals in their tenants"
ON public.rehearsals
FOR SELECT
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

-- Update RLS for rehearsal_attendance
DROP POLICY IF EXISTS "Users can view rehearsal attendance in their tenant" ON public.rehearsal_attendance;
CREATE POLICY "Users can view rehearsal attendance in their tenants"
ON public.rehearsal_attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM rehearsals r
    WHERE r.id = rehearsal_attendance.rehearsal_id
    AND r.tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  )
);

-- Update RLS for profiles to allow viewing profiles from all user tenants
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their tenants"
ON public.profiles
FOR SELECT
USING (
  (tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  OR (auth.uid() = id)
  OR is_super_admin(auth.uid())
);

-- Update RLS for user_roles
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON public.user_roles;
CREATE POLICY "Users can view roles in their tenants"
ON public.user_roles
FOR SELECT
USING (
  (tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  OR (tenant_id IS NULL)
  OR is_super_admin(auth.uid())
);

-- Update RLS for choir_members (view)
DROP POLICY IF EXISTS "Admins can view choir_members of their tenant" ON public.choir_members;
CREATE POLICY "Users can view choir_members of their tenants"
ON public.choir_members
FOR SELECT
USING (
  tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  OR is_super_admin(auth.uid())
);
