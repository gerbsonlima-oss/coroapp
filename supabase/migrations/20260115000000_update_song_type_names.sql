-- Update song type names to be more concise and liturgical
UPDATE public.song_types SET name = 'Entrada' WHERE slug = 'canto_entrada';
UPDATE public.song_types SET name = 'Ato Penitencial' WHERE slug = 'ato_penitencial';
UPDATE public.song_types SET name = 'Glória' WHERE slug = 'gloria';
UPDATE public.song_types SET name = 'Salmo' WHERE slug = 'salmo';
UPDATE public.song_types SET name = 'Aclamação' WHERE slug = 'aclamacao';
UPDATE public.song_types SET name = 'Ofertório' WHERE slug = 'oferendas';
UPDATE public.song_types SET name = 'Cordeiro' WHERE slug = 'cordeiro';
UPDATE public.song_types SET name = 'Santo' WHERE slug = 'santo';
UPDATE public.song_types SET name = 'Final' WHERE slug = 'final';

-- Also update legacy slugs if they exist
UPDATE public.song_types SET name = 'Entrada' WHERE slug = 'entrada';
UPDATE public.song_types SET name = 'Ato Penitencial' WHERE slug = 'perdao';
UPDATE public.song_types SET name = 'Ofertório' WHERE slug = 'ofertorio';