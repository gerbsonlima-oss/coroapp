CREATE OR REPLACE FUNCTION public.list_public_tenants()
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.slug, t.name, t.logo_url
  FROM public.tenants t
  ORDER BY t.name;
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_tenants() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_tenants() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(text) TO anon, authenticated;