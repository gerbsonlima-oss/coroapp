-- Allow per-tenant chat feature flag (disabled by default)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN NOT NULL DEFAULT FALSE;
