-- Adicionar coluna cover_image_url na tabela events
ALTER TABLE public.events
ADD COLUMN cover_image_url TEXT;

-- Criar bucket para capas de eventos
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true);

-- Policies para o bucket event-covers
-- Todos podem visualizar as capas
CREATE POLICY "Event covers are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-covers');

-- Usuários autenticados podem fazer upload
CREATE POLICY "Users can upload event covers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'event-covers' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuários podem atualizar suas próprias capas
CREATE POLICY "Users can update their event covers"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'event-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Usuários podem deletar suas próprias capas
CREATE POLICY "Users can delete their event covers"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'event-covers'
  AND auth.uid()::text = (storage.foldername(name))[1]
);