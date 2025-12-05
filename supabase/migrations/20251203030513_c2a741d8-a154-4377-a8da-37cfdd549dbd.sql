-- Create table for reusable song types
CREATE TABLE IF NOT EXISTS public.song_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create table linking song types to specific events
CREATE TABLE IF NOT EXISTS public.event_song_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  song_type_id uuid NOT NULL REFERENCES public.song_types(id) ON DELETE RESTRICT,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, song_type_id)
);

-- Enable Row Level Security
ALTER TABLE public.song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_song_types ENABLE ROW LEVEL SECURITY;

-- RLS policies for song_types
CREATE POLICY "Public can view song types"
ON public.song_types
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage song types"
ON public.song_types
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS policies for event_song_types
CREATE POLICY "Public can view event song types"
ON public.event_song_types
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage event song types"
ON public.event_song_types
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed default liturgical song types
INSERT INTO public.song_types (slug, name, description, order_index)
VALUES
  ('canto_entrada', 'Canto de Entrada', 'Canto de entrada da missa', 1),
  ('ato_penitencial', 'Ato Penitencial (Kyrie)', 'Momento de pedido de perdão', 2),
  ('gloria', 'Glória', 'Hino de louvor (Glória)', 3),
  ('salmo', 'Salmo Responsorial', 'Salmo entre as leituras', 4),
  ('aclamacao', 'Aclamação ao Evangelho (Aleluia)', 'Aclamação antes do Evangelho', 5),
  ('oferendas', 'Canto das Oferendas (Ofertório)', 'Canto das oferendas', 6),
  ('santo', 'Santo', 'Aclamação do Santo', 7),
  ('cordeiro', 'Cordeiro de Deus', 'Canto Cordeiro de Deus', 8),
  ('comunhao', 'Canto da Comunhão', 'Canto durante a comunhão', 9),
  ('acao_gracas', 'Canto de Ação de Graças', 'Canto após comunhão', 10),
  ('final', 'Canto Final (ou de Envio)', 'Canto de envio/final', 11)
ON CONFLICT (slug) DO NOTHING;