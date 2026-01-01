-- Create tenants table
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Insert default tenant for existing data
INSERT INTO public.tenants (id, slug, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'quixada', 'Coro Diocese Quixadá');

-- Add tenant_id to profiles (user belongs to one tenant)
ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Add tenant_id to events
ALTER TABLE public.events ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add tenant_id to songs
ALTER TABLE public.songs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add tenant_id to song_types (per tenant)
ALTER TABLE public.song_types ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add tenant_id to song_audios
ALTER TABLE public.song_audios ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add tenant_id to rehearsals
ALTER TABLE public.rehearsals ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add tenant_id to user_roles (for tenant-specific admins)
ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_events_tenant ON public.events(tenant_id);
CREATE INDEX idx_songs_tenant ON public.songs(tenant_id);
CREATE INDEX idx_song_types_tenant ON public.song_types(tenant_id);
CREATE INDEX idx_song_audios_tenant ON public.song_audios(tenant_id);
CREATE INDEX idx_rehearsals_tenant ON public.rehearsals(tenant_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);

-- Migrate existing data to default tenant
UPDATE public.profiles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.events SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.songs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.song_types SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.song_audios SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.rehearsals SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.user_roles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

-- Function to check if user is super_admin (using text comparison to avoid enum issues)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND role::text = 'super_admin'
    AND tenant_id IS NULL
  )
$$;

-- Function to check if user is admin of a specific tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND role::text = 'admin'
    AND tenant_id = _tenant_id
  ) OR public.is_super_admin(_user_id)
$$;

-- RLS Policies for tenants table
CREATE POLICY "Anyone can view tenants" ON public.tenants
FOR SELECT USING (true);

CREATE POLICY "Super admins can manage tenants" ON public.tenants
FOR ALL USING (public.is_super_admin(auth.uid()));