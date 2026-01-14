-- Create table for user chord preferences
CREATE TABLE public.user_chord_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE,
  transpose INTEGER NOT NULL DEFAULT 0,
  font_size INTEGER NOT NULL DEFAULT 16,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, song_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_chord_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own preferences" 
ON public.user_chord_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences" 
ON public.user_chord_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
ON public.user_chord_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" 
ON public.user_chord_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_chord_preferences_updated_at
BEFORE UPDATE ON public.user_chord_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();