-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Tenant admins can create events" ON public.events;

CREATE POLICY "Tenant admins can create events" 
ON public.events 
FOR INSERT 
TO authenticated
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- Also fix the UPDATE and DELETE policies to be permissive
DROP POLICY IF EXISTS "Tenant admins can update events" ON public.events;
DROP POLICY IF EXISTS "Tenant admins can delete events" ON public.events;

CREATE POLICY "Tenant admins can update events" 
ON public.events 
FOR UPDATE 
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete events" 
ON public.events 
FOR DELETE 
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id));