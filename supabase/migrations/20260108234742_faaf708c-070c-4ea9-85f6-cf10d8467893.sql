-- Grant full access to all data tables for super_admin users
-- This keeps tenant isolation for normal users/admins, but allows true platform-wide admin.

-- EVENTS
DROP POLICY IF EXISTS "Super admins full access" ON public.events;
CREATE POLICY "Super admins full access"
ON public.events
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- EVENT SONG TYPES
DROP POLICY IF EXISTS "Super admins full access" ON public.event_song_types;
CREATE POLICY "Super admins full access"
ON public.event_song_types
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- EVENT SONGS
DROP POLICY IF EXISTS "Super admins full access" ON public.event_songs;
CREATE POLICY "Super admins full access"
ON public.event_songs
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- SONGS
DROP POLICY IF EXISTS "Super admins full access" ON public.songs;
CREATE POLICY "Super admins full access"
ON public.songs
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- SONG TYPES
DROP POLICY IF EXISTS "Super admins full access" ON public.song_types;
CREATE POLICY "Super admins full access"
ON public.song_types
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- SONG AUDIOS
DROP POLICY IF EXISTS "Super admins full access" ON public.song_audios;
CREATE POLICY "Super admins full access"
ON public.song_audios
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- REHEARSALS
DROP POLICY IF EXISTS "Super admins full access" ON public.rehearsals;
CREATE POLICY "Super admins full access"
ON public.rehearsals
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- REHEARSAL ATTENDANCE
DROP POLICY IF EXISTS "Super admins full access" ON public.rehearsal_attendance;
CREATE POLICY "Super admins full access"
ON public.rehearsal_attendance
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- PROFILES (needed for true full access)
DROP POLICY IF EXISTS "Super admins full access" ON public.profiles;
CREATE POLICY "Super admins full access"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- USER ROLES (already protected, but ensure full access)
DROP POLICY IF EXISTS "Super admins full access" ON public.user_roles;
CREATE POLICY "Super admins full access"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- TENANTS (already protected, but ensure full access)
DROP POLICY IF EXISTS "Super admins full access" ON public.tenants;
CREATE POLICY "Super admins full access"
ON public.tenants
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));
