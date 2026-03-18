-- Simplify song types to a single global set
-- 1) Make all existing song types global
UPDATE public.song_types
SET tenant_id = NULL;

-- 2) Replace tenant-scoped RLS with global policies
DROP POLICY IF EXISTS "Users can view song types in their tenant" ON public.song_types;
DROP POLICY IF EXISTS "Tenant admins can manage song types" ON public.song_types;
DROP POLICY IF EXISTS "Users can view song_types in their tenant" ON public.song_types;
DROP POLICY IF EXISTS "Admins can manage song_types in their tenant" ON public.song_types;
DROP POLICY IF EXISTS "Public can view song types" ON public.song_types;
DROP POLICY IF EXISTS "Admins can manage song types" ON public.song_types;

CREATE POLICY "Public can view song types" ON public.song_types
FOR SELECT USING (true);

CREATE POLICY "Admins can manage song types" ON public.song_types
FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
