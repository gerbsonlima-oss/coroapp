-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view tenant logos (public bucket)
CREATE POLICY "Anyone can view tenant logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'tenant-logos');

-- Only super admins can upload/update/delete tenant logos
CREATE POLICY "Super admins can upload tenant logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tenant-logos' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update tenant logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'tenant-logos' AND public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete tenant logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'tenant-logos' AND public.is_super_admin(auth.uid()));