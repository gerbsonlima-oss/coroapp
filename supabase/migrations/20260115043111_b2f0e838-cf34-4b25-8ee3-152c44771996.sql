-- Add approval status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending' 
CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Create index for faster queries on pending approvals
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_approval ON public.profiles(tenant_id, approval_status);

-- Update RLS policy to allow tenant admins to view pending profiles for their tenant
DROP POLICY IF EXISTS "Tenant admins can view pending profiles" ON public.profiles;
CREATE POLICY "Tenant admins can view pending profiles"
ON public.profiles
FOR SELECT
USING (
  is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
);

-- Allow tenant admins to update approval status
DROP POLICY IF EXISTS "Tenant admins can approve users" ON public.profiles;
CREATE POLICY "Tenant admins can approve users"
ON public.profiles
FOR UPDATE
USING (
  is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
)
WITH CHECK (
  is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid())
);