-- Drop and recreate RLS policies for events
DROP POLICY IF EXISTS "Public can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can create events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

CREATE POLICY "Users can view events in their tenant" ON public.events
FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL);

CREATE POLICY "Tenant admins can create events" ON public.events
FOR INSERT WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update events" ON public.events
FOR UPDATE USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete events" ON public.events
FOR DELETE USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Drop and recreate RLS policies for songs
DROP POLICY IF EXISTS "Public can view songs" ON public.songs;
DROP POLICY IF EXISTS "Admins can create songs" ON public.songs;
DROP POLICY IF EXISTS "Admins can update songs" ON public.songs;
DROP POLICY IF EXISTS "Admins can delete songs" ON public.songs;

CREATE POLICY "Users can view songs in their tenant" ON public.songs
FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL);

CREATE POLICY "Tenant admins can create songs" ON public.songs
FOR INSERT WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update songs" ON public.songs
FOR UPDATE USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete songs" ON public.songs
FOR DELETE USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Drop and recreate RLS policies for song_types
DROP POLICY IF EXISTS "Public can view song types" ON public.song_types;
DROP POLICY IF EXISTS "Admins can manage song types" ON public.song_types;

CREATE POLICY "Users can view song types in their tenant" ON public.song_types
FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL);

CREATE POLICY "Tenant admins can manage song types" ON public.song_types
FOR ALL USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Drop and recreate RLS policies for song_audios
DROP POLICY IF EXISTS "Public can view song audios" ON public.song_audios;
DROP POLICY IF EXISTS "Admins can insert audios" ON public.song_audios;
DROP POLICY IF EXISTS "Admins can update audios" ON public.song_audios;
DROP POLICY IF EXISTS "Admins can delete audios" ON public.song_audios;

CREATE POLICY "Users can view song audios in their tenant" ON public.song_audios
FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL);

CREATE POLICY "Tenant admins can manage song audios" ON public.song_audios
FOR ALL USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Drop and recreate RLS policies for rehearsals
DROP POLICY IF EXISTS "Public can view rehearsals" ON public.rehearsals;
DROP POLICY IF EXISTS "Admins can manage rehearsals" ON public.rehearsals;

CREATE POLICY "Users can view rehearsals in their tenant" ON public.rehearsals
FOR SELECT USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL);

CREATE POLICY "Tenant admins can manage rehearsals" ON public.rehearsals
FOR ALL USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Drop and recreate RLS policies for rehearsal_attendance
DROP POLICY IF EXISTS "Public can view rehearsal attendance" ON public.rehearsal_attendance;
DROP POLICY IF EXISTS "Admins can manage rehearsal attendance" ON public.rehearsal_attendance;

CREATE POLICY "Users can view rehearsal attendance in their tenant" ON public.rehearsal_attendance
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.rehearsals r 
    WHERE r.id = rehearsal_id 
    AND (r.tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL)
  )
);

CREATE POLICY "Tenant admins can manage rehearsal attendance" ON public.rehearsal_attendance
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.rehearsals r 
    WHERE r.id = rehearsal_id 
    AND public.is_tenant_admin(auth.uid(), r.tenant_id)
  )
);

-- Drop and recreate RLS policies for event_songs
DROP POLICY IF EXISTS "Public can view event_songs" ON public.event_songs;
DROP POLICY IF EXISTS "Admins can add songs to events" ON public.event_songs;
DROP POLICY IF EXISTS "Admins can remove songs from events" ON public.event_songs;
DROP POLICY IF EXISTS "Admins can update event_songs" ON public.event_songs;

CREATE POLICY "Users can view event songs in their tenant" ON public.event_songs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id 
    AND (e.tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL)
  )
);

CREATE POLICY "Tenant admins can manage event songs" ON public.event_songs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id 
    AND public.is_tenant_admin(auth.uid(), e.tenant_id)
  )
);

-- Drop and recreate RLS policies for event_song_types
DROP POLICY IF EXISTS "Public can view event song types" ON public.event_song_types;
DROP POLICY IF EXISTS "Admins can manage event song types" ON public.event_song_types;

CREATE POLICY "Users can view event song types in their tenant" ON public.event_song_types
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id 
    AND (e.tenant_id = public.get_user_tenant_id(auth.uid()) OR auth.uid() IS NULL)
  )
);

CREATE POLICY "Tenant admins can manage event song types" ON public.event_song_types
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id 
    AND public.is_tenant_admin(auth.uid(), e.tenant_id)
  )
);

-- Update profiles RLS to allow viewing profiles in same tenant
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) 
  OR auth.uid() = id
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- Update user_roles RLS
DROP POLICY IF EXISTS "Anyone can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view roles in their tenant" ON public.user_roles
FOR SELECT USING (
  tenant_id = public.get_user_tenant_id(auth.uid()) 
  OR tenant_id IS NULL
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Super admins can manage all roles" ON public.user_roles
FOR ALL USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant roles" ON public.user_roles
FOR ALL USING (
  tenant_id IS NOT NULL 
  AND public.is_tenant_admin(auth.uid(), tenant_id)
  AND role::text != 'super_admin'
);