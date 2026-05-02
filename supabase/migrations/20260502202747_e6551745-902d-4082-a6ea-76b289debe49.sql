-- 1. Tenants: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view tenants" ON public.tenants;

CREATE POLICY "Authenticated users can view tenants"
ON public.tenants FOR SELECT
TO authenticated
USING (true);

-- Public RPC for resolving a single tenant by slug (needed for public event share pages)
CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  logo_url text,
  chat_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.slug, t.name, t.logo_url, t.chat_enabled
  FROM public.tenants t
  WHERE t.slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(text) TO anon, authenticated;

-- 2. Audit logs: remove permissive INSERT policy (service role bypasses RLS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Only system can insert audit logs" ON public.audit_logs';
  END IF;
END $$;

-- 3. Short URLs: restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "Authenticated users can create short URLs" ON public.short_urls;

CREATE POLICY "Authenticated users can create short URLs"
ON public.short_urls FOR INSERT
TO authenticated
WITH CHECK (true);