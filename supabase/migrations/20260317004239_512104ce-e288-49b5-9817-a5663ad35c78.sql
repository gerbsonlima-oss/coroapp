INSERT INTO song_types (slug, name, order_index, tenant_id)
VALUES ('canto_processional', 'Canto Processional', 12, NULL)
ON CONFLICT DO NOTHING;