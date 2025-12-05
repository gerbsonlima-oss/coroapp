-- Add column to store original PDF URL
ALTER TABLE songs 
ADD COLUMN sheet_music_pdf_url TEXT;

COMMENT ON COLUMN songs.sheet_music_pdf_url IS 'URL do PDF original da partitura, usado para exportação';