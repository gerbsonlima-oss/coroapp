-- Update handle_new_user to associate users with tenant from signup metadata
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
  -- Get tenant slug from user metadata (passed during signup)
  _tenant_slug := NEW.raw_user_meta_data->>'tenant_slug';
  
  -- Look up tenant_id from slug
  IF _tenant_slug IS NOT NULL AND _tenant_slug <> '' THEN
    SELECT id INTO _tenant_id FROM public.tenants WHERE slug = _tenant_slug;
  END IF;
  
  -- If no tenant found, use default tenant (quixada)
  IF _tenant_id IS NULL THEN
    SELECT id INTO _tenant_id FROM public.tenants WHERE slug = 'quixada';
  END IF;
  
  -- Insert profile with tenant_id
  INSERT INTO public.profiles (id, email, full_name, tenant_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', _tenant_id);
  
  -- Insert user role with tenant_id
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'user', _tenant_id);
  
  RETURN NEW;
END;
$$;