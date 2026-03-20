-- Ensure signup tenant resolution precedence: tenant_id -> tenant_slug -> default fallback
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _tenant_slug text;
BEGIN
  -- 1) Try tenant_id from signup metadata
  BEGIN
    _tenant_id := NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid;
  EXCEPTION
    WHEN others THEN
      _tenant_id := NULL;
  END;

  -- Validate tenant_id exists
  IF _tenant_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = _tenant_id) THEN
      _tenant_id := NULL;
    END IF;
  END IF;

  -- 2) If needed, resolve by tenant_slug
  IF _tenant_id IS NULL THEN
    _tenant_slug := NULLIF(NEW.raw_user_meta_data->>'tenant_slug', '');
    IF _tenant_slug IS NOT NULL THEN
      SELECT t.id INTO _tenant_id
      FROM public.tenants t
      WHERE t.slug = _tenant_slug
      LIMIT 1;
    END IF;
  END IF;

  -- 3) Fallback for backward compatibility
  IF _tenant_id IS NULL THEN
    SELECT t.id INTO _tenant_id
    FROM public.tenants t
    WHERE t.slug = 'quixada'
    LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, tenant_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', _tenant_id);

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'user', _tenant_id);

  RETURN NEW;
END;
$$;
