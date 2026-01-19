-- Add choir-specific fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS parish TEXT,
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Migrate data from choir_members to profiles where email matches
UPDATE public.profiles p
SET 
  photo_url = COALESCE(p.photo_url, cm.photo_url),
  parish = COALESCE(p.parish, cm.parish),
  active = COALESCE(cm.active, true),
  full_name = COALESCE(p.full_name, cm.name),
  naipe = COALESCE(p.naipe, cm.naipe),
  birth_date = COALESCE(p.birth_date, cm.birth_date),
  phone = COALESCE(p.phone, cm.phone)
FROM public.choir_members cm
WHERE LOWER(p.email) = LOWER(cm.email)
AND p.tenant_id = cm.tenant_id;

-- Update storage policy for profile photos bucket (reuse choir-member-photos)
-- No changes needed as it's already public