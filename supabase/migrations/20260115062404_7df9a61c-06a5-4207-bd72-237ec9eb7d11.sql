-- Create table for short URLs
CREATE TABLE public.short_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_code TEXT NOT NULL UNIQUE,
  full_url TEXT NOT NULL,
  url_type TEXT NOT NULL CHECK (url_type IN ('audio', 'sheet')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_short_urls_short_code ON public.short_urls (short_code);
CREATE INDEX idx_short_urls_full_url ON public.short_urls (full_url);

-- Enable RLS but allow public read access (needed for redirect)
ALTER TABLE public.short_urls ENABLE ROW LEVEL SECURITY;

-- Anyone can read short URLs (needed for redirect to work)
CREATE POLICY "Short URLs are publicly readable" 
ON public.short_urls 
FOR SELECT 
USING (true);

-- Authenticated users can create short URLs
CREATE POLICY "Authenticated users can create short URLs" 
ON public.short_urls 
FOR INSERT 
WITH CHECK (true);