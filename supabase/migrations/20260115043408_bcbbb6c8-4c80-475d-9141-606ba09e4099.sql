-- Add unique constraint for user_id and tenant_id to prevent duplicate role assignments per tenant
-- First drop the old constraint if it conflicts
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_tenant_id_key;

-- Create unique constraint for user_id + tenant_id combination
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_tenant_id_key ON public.user_roles (user_id, tenant_id);