-- Chat sessions and messages for conversational assistant flow
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  current_flow TEXT NOT NULL DEFAULT 'idle',
  current_step TEXT NOT NULL DEFAULT 'idle',
  flow_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'bot', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant_user_status
  ON public.chat_sessions (tenant_id, user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON public.chat_messages (session_id, created_at ASC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can view their own chat sessions"
ON public.chat_sessions
FOR SELECT
USING (
  user_id = auth.uid()
  AND (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can insert their own chat sessions"
ON public.chat_sessions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can update their own chat sessions"
ON public.chat_sessions
FOR UPDATE
USING (
  user_id = auth.uid()
  AND (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    OR public.is_super_admin(auth.uid())
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    OR public.is_super_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view their own chat messages"
ON public.chat_messages
FOR SELECT
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_sessions cs
    WHERE cs.id = chat_messages.session_id
      AND cs.user_id = auth.uid()
      AND (
        cs.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
        OR public.is_super_admin(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.chat_sessions cs
    WHERE cs.id = chat_messages.session_id
      AND cs.user_id = auth.uid()
      AND (
        cs.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
        OR public.is_super_admin(auth.uid())
      )
  )
);

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
