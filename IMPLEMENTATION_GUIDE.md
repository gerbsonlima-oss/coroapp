# Guia de Implementação - Multi-Tenant Improvements

## 1. SQL Migrations

### 1.1 Adicionar tenant_id a Junction Tables

**File: `supabase/migrations/001_add_tenant_id_to_junctions.sql`**

```sql
-- Add tenant_id to event_songs
ALTER TABLE event_songs 
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill existing data
UPDATE event_songs SET tenant_id = (
  SELECT tenant_id FROM events WHERE events.id = event_songs.event_id
);

-- Make it NOT NULL after backfill
ALTER TABLE event_songs ALTER COLUMN tenant_id SET NOT NULL;

-- Add index
CREATE INDEX idx_event_songs_tenant ON event_songs(tenant_id);

---

-- Add tenant_id to event_song_types
ALTER TABLE event_song_types 
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE event_song_types SET tenant_id = (
  SELECT tenant_id FROM events WHERE events.id = event_song_types.event_id
);

ALTER TABLE event_song_types ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX idx_event_song_types_tenant ON event_song_types(tenant_id);

---

-- Add tenant_id to rehearsal_attendance
ALTER TABLE rehearsal_attendance 
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE rehearsal_attendance SET tenant_id = (
  SELECT tenant_id FROM rehearsals WHERE rehearsals.id = rehearsal_attendance.rehearsal_id
);

ALTER TABLE rehearsal_attendance ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX idx_rehearsal_attendance_tenant ON rehearsal_attendance(tenant_id);
```

### 1.2 Criar Tabela de Auditoria

**File: `supabase/migrations/002_create_audit_logs.sql`**

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id UUID,
  description TEXT,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- RLS for audit logs (users can only see their tenant's logs)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their tenant"
ON audit_logs FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);
```

### 1.3 Implementar RLS Policies

**File: `supabase/migrations/003_implement_rls_policies.sql`**

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- EVENTS POLICIES
CREATE POLICY "Users can view events in their tenant"
ON events FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can insert events in their tenant"
ON events FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR tenant_id = events.tenant_id)
  )
);

CREATE POLICY "Admins can update events in their tenant"
ON events FOR UPDATE
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR tenant_id = events.tenant_id)
  )
);

CREATE POLICY "Admins can delete events in their tenant"
ON events FOR DELETE
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR tenant_id = events.tenant_id)
  )
);

-- Similar policies for SONGS, SONG_TYPES, SONG_AUDIOS, REHEARSALS
-- (Pattern is the same - check tenant_id and role)

-- EVENT_SONGS POLICIES
CREATE POLICY "Users can view event_songs in their tenant"
ON event_songs FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can manage event_songs in their tenant"
ON event_songs FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND (role = 'super_admin' OR tenant_id = event_songs.tenant_id)
  )
);

-- Similar for EVENT_SONG_TYPES and REHEARSAL_ATTENDANCE
```

---

## 2. Edge Function para Copiar Dados

### 2.1 Setup

```bash
# Criar nova Edge Function
supabase functions new copy-tenant-data

# Instalar dependências em supabase/functions/copy-tenant-data/deno.json
```

### 2.2 Implementação

**File: `supabase/functions/copy-tenant-data/index.ts`**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface CopyRequest {
  sourceTenantId: string;
  targetTenantId: string;
  dataType: "songTypes" | "songs" | "events";
  itemIds: string[];
}

interface CopyResponse {
  success: boolean;
  copied: number;
  mapping: Record<string, string>; // old_id -> new_id
  error?: string;
}

// Helper to create new ID
const generateId = () => crypto.randomUUID();

// Copy song type
async function copySongType(
  sourceTenantId: string,
  targetTenantId: string,
  songTypeId: string,
  mapping: Record<string, string>
): Promise<string> {
  const { data: sourceType, error: fetchError } = await supabase
    .from("song_types")
    .select("*")
    .eq("id", songTypeId)
    .eq("tenant_id", sourceTenantId)
    .single();

  if (fetchError || !sourceType) {
    throw new Error(`Failed to fetch song type: ${songTypeId}`);
  }

  const newId = generateId();

  const { error: insertError } = await supabase
    .from("song_types")
    .insert({
      id: newId,
      tenant_id: targetTenantId,
      name: sourceType.name,
      slug: sourceType.slug,
      description: sourceType.description,
      order_index: sourceType.order_index,
    });

  if (insertError) {
    throw new Error(`Failed to insert song type: ${insertError.message}`);
  }

  mapping[songTypeId] = newId;
  return newId;
}

// Copy song with audios
async function copySong(
  sourceTenantId: string,
  targetTenantId: string,
  songId: string,
  songTypeMapping: Record<string, string>,
  songMapping: Record<string, string>
): Promise<string> {
  const { data: sourceSong, error: fetchError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .eq("tenant_id", sourceTenantId)
    .single();

  if (fetchError || !sourceSong) {
    throw new Error(`Failed to fetch song: ${songId}`);
  }

  const newSongId = generateId();
  const newTypeId = songTypeMapping[sourceSong.type] || sourceSong.type;

  const { error: insertError } = await supabase
    .from("songs")
    .insert({
      id: newSongId,
      tenant_id: targetTenantId,
      name: sourceSong.name,
      type: newTypeId,
      notes: sourceSong.notes,
      sheet_music_url: sourceSong.sheet_music_url,
      sheet_music_pdf_url: sourceSong.sheet_music_pdf_url,
    });

  if (insertError) {
    throw new Error(`Failed to insert song: ${insertError.message}`);
  }

  // Copy audios
  const { data: audios } = await supabase
    .from("song_audios")
    .select("*")
    .eq("song_id", songId)
    .eq("tenant_id", sourceTenantId);

  if (audios && audios.length > 0) {
    const audioInserts = audios.map(audio => ({
      id: generateId(),
      song_id: newSongId,
      tenant_id: targetTenantId,
      naipe: audio.naipe,
      name: audio.name,
      audio_url: audio.audio_url,
    }));

    const { error: audioError } = await supabase
      .from("song_audios")
      .insert(audioInserts);

    if (audioError) {
      console.error("Warning: Failed to copy some audios", audioError);
      // Continue anyway
    }
  }

  songMapping[songId] = newSongId;
  return newSongId;
}

// Copy event
async function copyEvent(
  sourceTenantId: string,
  targetTenantId: string,
  eventId: string,
  eventMapping: Record<string, string>
): Promise<string> {
  const { data: sourceEvent, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("tenant_id", sourceTenantId)
    .single();

  if (fetchError || !sourceEvent) {
    throw new Error(`Failed to fetch event: ${eventId}`);
  }

  const newEventId = generateId();

  const { error: insertError } = await supabase
    .from("events")
    .insert({
      id: newEventId,
      tenant_id: targetTenantId,
      name: sourceEvent.name,
      date: sourceEvent.date,
      location: sourceEvent.location,
      notes: sourceEvent.notes,
      pdf_theme: sourceEvent.pdf_theme,
      cover_image_url: sourceEvent.cover_image_url,
    });

  if (insertError) {
    throw new Error(`Failed to insert event: ${insertError.message}`);
  }

  eventMapping[eventId] = newEventId;
  return newEventId;
}

// Main handler
Deno.serve(async (req) => {
  // Validate request method
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Get auth user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Check if super admin
    const { data: isSuperAdmin, error: roleError } = await supabase
      .rpc("is_super_admin", { _user_id: user.id });

    if (roleError || !isSuperAdmin) {
      return new Response("Forbidden: Must be super admin", { status: 403 });
    }

    // Parse request
    const body: CopyRequest = await req.json();
    const { sourceTenantId, targetTenantId, dataType, itemIds } = body;

    if (!sourceTenantId || !targetTenantId || !dataType || !itemIds?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    const songTypeMapping: Record<string, string> = {};
    const songMapping: Record<string, string> = {};
    const eventMapping: Record<string, string> = {};
    let copiedCount = 0;

    // Copy data based on type
    if (dataType === "songTypes") {
      for (const typeId of itemIds) {
        await copySongType(sourceTenantId, targetTenantId, typeId, songTypeMapping);
        copiedCount++;
      }
    } else if (dataType === "songs") {
      // First get song types needed
      const { data: sourceTypes } = await supabase
        .from("song_types")
        .select("*")
        .eq("tenant_id", sourceTenantId);

      if (sourceTypes) {
        for (const type of sourceTypes) {
          const { data: existingType } = await supabase
            .from("song_types")
            .select("id")
            .eq("tenant_id", targetTenantId)
            .eq("slug", type.slug)
            .single();

          if (existingType) {
            songTypeMapping[type.id] = existingType.id;
          } else {
            await copySongType(sourceTenantId, targetTenantId, type.id, songTypeMapping);
          }
        }
      }

      // Copy songs
      for (const songId of itemIds) {
        await copySong(
          sourceTenantId,
          targetTenantId,
          songId,
          songTypeMapping,
          songMapping
        );
        copiedCount++;
      }
    } else if (dataType === "events") {
      for (const eventId of itemIds) {
        await copyEvent(sourceTenantId, targetTenantId, eventId, eventMapping);
        copiedCount++;
      }
    }

    // Log the operation
    await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        tenant_id: sourceTenantId,
        action: "copy_to_tenant",
        entity_type: dataType,
        description: `Copied ${copiedCount} ${dataType} to tenant ${targetTenantId}`,
        ip_address: req.headers.get("x-forwarded-for") || undefined,
        user_agent: req.headers.get("user-agent") || undefined,
      });

    const response: CopyResponse = {
      success: true,
      copied: copiedCount,
      mapping: { ...songTypeMapping, ...songMapping, ...eventMapping },
    };

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const response: CopyResponse = {
      success: false,
      copied: 0,
      mapping: {},
      error: error.message,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

### 2.3 Deploy

```bash
# Deploy function
supabase functions deploy copy-tenant-data

# Test locally
supabase functions serve
```

---

## 3. Frontend - Hook para Copy Data

**File: `src/hooks/useCopyTenantData.tsx`**

```typescript
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CopyProgress {
  status: "idle" | "loading" | "success" | "error";
  copied: number;
  total: number;
  error?: string;
}

export function useCopyTenantData() {
  const [progress, setProgress] = useState<CopyProgress>({
    status: "idle",
    copied: 0,
    total: 0,
  });

  const copyData = async (
    sourceTenantId: string,
    targetTenantId: string,
    dataType: "songTypes" | "songs" | "events",
    itemIds: string[]
  ) => {
    setProgress({
      status: "loading",
      copied: 0,
      total: itemIds.length,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copy-tenant-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            sourceTenantId,
            targetTenantId,
            dataType,
            itemIds,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to copy data");
      }

      const result = await response.json();

      setProgress({
        status: "success",
        copied: result.copied,
        total: itemIds.length,
      });

      toast.success(`${result.copied} itens copiados com sucesso!`);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || "Erro ao copiar dados";
      setProgress({
        status: "error",
        copied: 0,
        total: itemIds.length,
        error: errorMessage,
      });
      toast.error(errorMessage);
      throw error;
    }
  };

  const reset = () => {
    setProgress({ status: "idle", copied: 0, total: 0 });
  };

  return { copyData, progress, reset };
}
```

---

## 4. Testes Recomendados

### 4.1 Teste de Isolamento

```typescript
// tests/tenant-isolation.test.ts
import { createClient } from "@supabase/supabase-js";

describe("Tenant Isolation", () => {
  it("User from tenant A should not see tenant B data", async () => {
    // User A em tenant "quixada"
    const userA = await signIn("user-a@quixada.com", "password");
    
    // Tenta acessar song do tenant "fortaleza"
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .eq("id", "fortaleza-song-id");
    
    // Deve retornar vazio ou erro de RLS
    expect(data).toBeNull();
    expect(error?.code).toBe("PGRST116"); // RLS policy violation
  });

  it("Admin should be able to copy data with correct permissions", async () => {
    const superAdmin = await signIn("super@admin.com", "password");
    
    const response = await fetch("/functions/v1/copy-tenant-data", {
      method: "POST",
      body: JSON.stringify({
        sourceTenantId: "quixada-id",
        targetTenantId: "fortaleza-id",
        dataType: "songTypes",
        itemIds: ["type-1"],
      }),
      headers: {
        Authorization: `Bearer ${superAdmin.session.access_token}`,
      },
    });

    expect(response.ok).toBe(true);
    const result = await response.json();
    expect(result.success).toBe(true);
  });
});
```

### 4.2 Teste de RLS

```bash
# Usar Supabase CLI para testar RLS
psql $DATABASE_URL -c "
  SET ROLE anon;
  SELECT * FROM events WHERE tenant_id = 'other-tenant';
  -- Deve retornar 0 rows
"
```

---

## 5. Checklist de Deployment

- [ ] Rodar migrations (junction tables + audit + RLS)
- [ ] Deploy Edge Function (copy-tenant-data)
- [ ] Testar RLS policies localmente
- [ ] Atualizar AdminTenants UI com copy feature
- [ ] Testes de isolamento de tenant
- [ ] Documentar para equipe
- [ ] Monitorar logs pós-deploy
- [ ] Backup antes de aplicar RLS (pode quebrar queries)

