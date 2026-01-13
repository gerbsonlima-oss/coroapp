-- Create choir_members table for managing choir members
CREATE TABLE public.choir_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    birth_date date,
    photo_url text,
    parish text,
    naipe text CHECK (naipe IN ('soprano', 'contralto', 'tenor', 'baixo')),
    phone text,
    email text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create event_members table to associate members with events
CREATE TABLE public.event_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES public.choir_members(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(event_id, member_id)
);

-- Add member_id to rehearsal_attendance (keeping user_id for backward compatibility)
ALTER TABLE public.rehearsal_attendance 
ADD COLUMN member_id uuid REFERENCES public.choir_members(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.choir_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for choir_members
CREATE POLICY "Super admins can do everything with choir_members"
ON public.choir_members
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage their choir_members"
ON public.choir_members
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Users can view choir_members of their tenant"
ON public.choir_members
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid()
    )
);

-- RLS Policies for event_members
CREATE POLICY "Super admins can do everything with event_members"
ON public.event_members
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage event_members"
ON public.event_members
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.user_roles ur ON ur.tenant_id = e.tenant_id
        WHERE e.id = event_members.event_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.user_roles ur ON ur.tenant_id = e.tenant_id
        WHERE e.id = event_members.event_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Users can view event_members of their tenant events"
ON public.event_members
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.user_roles ur ON ur.tenant_id = e.tenant_id
        WHERE e.id = event_members.event_id
        AND ur.user_id = auth.uid()
    )
);

-- Update RLS for rehearsal_attendance to include member_id
CREATE POLICY "Admins can manage attendance by member_id"
ON public.rehearsal_attendance
FOR ALL
TO authenticated
USING (
    member_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.choir_members cm
        JOIN public.user_roles ur ON ur.tenant_id = cm.tenant_id
        WHERE cm.id = rehearsal_attendance.member_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
)
WITH CHECK (
    member_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.choir_members cm
        JOIN public.user_roles ur ON ur.tenant_id = cm.tenant_id
        WHERE cm.id = rehearsal_attendance.member_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
);

-- Create storage bucket for choir member photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('choir-member-photos', 'choir-member-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for choir member photos
CREATE POLICY "Anyone can view choir member photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'choir-member-photos');

CREATE POLICY "Admins can upload choir member photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'choir-member-photos' AND
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Admins can update choir member photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'choir-member-photos' AND
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Admins can delete choir member photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'choir-member-photos' AND
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
);

-- Trigger for updated_at on choir_members
CREATE TRIGGER update_choir_members_updated_at
BEFORE UPDATE ON public.choir_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();