-- Add new columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS naipe text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS parish text;

-- Create rehearsals table
CREATE TABLE public.rehearsals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  date date NOT NULL,
  location text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rehearsals
ALTER TABLE public.rehearsals ENABLE ROW LEVEL SECURITY;

-- RLS policies for rehearsals
CREATE POLICY "Public can view rehearsals" ON public.rehearsals
FOR SELECT USING (true);

CREATE POLICY "Admins can manage rehearsals" ON public.rehearsals
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create rehearsal_attendance table
CREATE TABLE public.rehearsal_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rehearsal_id uuid NOT NULL REFERENCES public.rehearsals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attended boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(rehearsal_id, user_id)
);

-- Enable RLS on rehearsal_attendance
ALTER TABLE public.rehearsal_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for rehearsal_attendance
CREATE POLICY "Public can view rehearsal attendance" ON public.rehearsal_attendance
FOR SELECT USING (true);

CREATE POLICY "Admins can manage rehearsal attendance" ON public.rehearsal_attendance
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on rehearsals
CREATE TRIGGER update_rehearsals_updated_at
BEFORE UPDATE ON public.rehearsals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();