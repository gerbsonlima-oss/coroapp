# Análise de Arquitetura Multi-Tenant - Coro Quixadá

**Data:** 2026-01-10  
**Versão:** 1.0  
**Status:** Análise Atual + Recomendações

---

## 📋 Executive Summary

O aplicativo Coro Quixadá é uma plataforma multi-tenant onde múltiplos coros/organizações (tenants) podem gerenciar eventos, músicas, ensaios e conteúdo litúrgico de forma isolada. A arquitetura atual implementa isolamento de dados com `tenant_id` nas tabelas, suporta multi-path com slug de tenant na URL, e possui sistema de papéis (admin, user, super_admin).

**Recomendações-chave:**
- ✅ Atual isolamento por `tenant_id` é sólido
- ⚠️ Implementar "copy data between tenants" para superadmin
- ⚠️ Melhorar RLS (Row Level Security) com políticas mais explícitas
- ✅ Schema atual é bem modelado para multi-tenancy

---

## 🏗️ 1. Arquitetura Atual Implementada

### 1.1 Modelo de Tenant

**Tabela: `tenants`**
```sql
- id: UUID (PK)
- slug: VARCHAR (unique) - URL slug (ex: "quixada", "fortaleza")
- name: VARCHAR - Nome da organização
- logo_url: VARCHAR (nullable) - Logo da org
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**Características:**
- Cada tenant é uma entidade isolada
- Slug usa na URL (ex: `/(quixada)/events`)
- Logo customizável por tenant
- Suporta múltiplos subdomínios (tenant.example.com)

### 1.2 Modelos de Dados com Isolamento

**Tabelas com `tenant_id` (Isoladas por Tenant):**

| Tabela | tenant_id | Descrição |
|--------|-----------|-----------|
| **events** | ✅ | Eventos/celebrações do coro |
| **songs** | ✅ | Músicas da biblioteca |
| **song_types** | ✅ | Categorias de músicas (Introito, Gradual, etc) |
| **song_audios** | ✅ | Áudios de ensaio por voz |
| **rehearsals** | ✅ | Ensaios agendados |
| **profiles** | ✅ | Perfis de usuários |
| **user_roles** | ✅ | Papéis por tenant (admin, user) |
| **event_songs** | ❌ | **PROBLEMA**: Sem tenant_id direto |
| **event_song_types** | ❌ | **PROBLEMA**: Sem tenant_id direto |
| **rehearsal_attendance** | ❌ | **PROBLEMA**: Sem tenant_id direto |

**Tabelas Globais (Sem Isolamento):**
- `auth.users` - Usuários Supabase Auth (compartilhados)

### 1.3 Sistema de Papéis (RBAC)

**Tabela: `user_roles`**
```
- id: UUID (PK)
- user_id: UUID (FK -> auth.users)
- tenant_id: UUID (FK -> tenants) - POR TENANT
- role: ENUM ('admin', 'user', 'super_admin')
- created_at: TIMESTAMP
```

**Hierarquia de Papéis:**
```
┌─────────────────────────────┐
│      SUPER_ADMIN            │  - Acesso a /admin/tenants
│    (Global)                 │  - Copiar dados entre tenants
└─────────────────────────────┘
         ↓↓↓
┌─────────────────────────────┐
│   ADMIN (por Tenant)        │  - Gerenciar tipos de música
│  (Tenant-scoped)            │  - Editar eventos/ensaios
└─────────────────────────────┘
         ↓↓↓
┌─────────────────────────────┐
│   USER (por Tenant)         │  - Visualizar conteúdo
│  (Tenant-scoped)            │  - Participar ensaios
└─────────────────────────────┘
```

### 1.4 Detecção de Tenant

**Precedência (em `TenantContext.tsx`):**

```
1. URL PATH: /(slug)/events  → getTenantFromPath()
2. SUBDOMAIN: tenant.example.com → getTenantSlugFromHostname()
3. LOCALSTORAGE: selected_tenant_slug
4. DEFAULT: 'quixada'
```

**Rotas Protegidas:**
```
- /auth - PUBLIC (sem tenant)
- /admin/tenants - GLOBAL (superadmin)
- /(tenantSlug)/* - TENANT-SCOPED
- /* - FALLBACK sem tenant
```

---

## 📊 2. Análise de Isolamento de Dados

### 2.1 Estado Atual ✅

**Isolamento FORTE:**
- ✅ Events, Songs, Song Types isoladas por tenant_id
- ✅ Profiles isolados por tenant_id
- ✅ User Roles por tenant_id (admin/user/tenant)
- ✅ RPC Functions: `is_super_admin()`, `is_tenant_admin()`
- ✅ TenantContext fornece tenantId em toda app
- ✅ Queries sempre filtram por `tenant_id` no frontend

**Problemas Identificados:**

#### 🔴 Problema 1: Tabelas Junction sem tenant_id

```
event_songs: event_id → events (tem tenant_id)
             song_id → songs (tem tenant_id)
             ❌ MAS SEM tenant_id DIRETO

event_song_types: event_id → events
                  song_type_id → song_types
                  ❌ MAS SEM tenant_id DIRETO

rehearsal_attendance: rehearsal_id → rehearsals (tem tenant_id)
                      user_id → profiles (tem tenant_id)
                      ❌ MAS SEM tenant_id DIRETO
```

**Risco:** Um usuário de tenant A poderia tecnicamente acessar referências de tenant B se conseguisse o ID.

#### 🟡 Problema 2: RLS (Row-Level Security) não configurado

Supabase RLS não foi ativado. Dependência 100% de lógica frontend:
- Sem validação de segurança no servidor
- Qualquer usuário autenticado pode fazer queries brutas
- Necessário implementar RLS policies

---

## 🎯 3. Fluxo de Autenticação por Tenant

### 3.1 Sign Up

```
1. User entra em /auth (sem tenant)
2. getTenantSlugFromHostname() determina tenant
3. signUp() inclui tenant_slug em auth.user.user_metadata.tenant_slug
4. Profile criado com tenant_id
5. User_roles criado com papel 'user'
6. Redireciona para /(tenant)/
```

### 3.2 Sign In

```
1. User faz login
2. TenantContext determina tenant (URL/storage/default)
3. useAuth/useIsAdmin verifica papéis via RPC
4. ProtectedRoute bloqueia rotas não autorizadas
```

---

## 🔐 4. Segurança - Issues & Recomendações

### 4.1 Row-Level Security (RLS)

**Status: ❌ NÃO IMPLEMENTADO**

**Recomendação:**

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Exemplo de política para eventos
CREATE POLICY "Users can see events in their tenant"
ON events FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Exemplo para edição (apenas admins)
CREATE POLICY "Admins can edit events in their tenant"
ON events FOR UPDATE
USING (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
    AND tenant_id = events.tenant_id
  )
);
```

### 4.2 Adição de tenant_id a Junction Tables

**Schema Migration:**

```sql
-- 1. event_songs
ALTER TABLE event_songs 
ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Backfill existing data
UPDATE event_songs SET tenant_id = (
  SELECT tenant_id FROM events WHERE events.id = event_songs.event_id
);

-- 2. event_song_types
ALTER TABLE event_song_types 
ADD COLUMN tenant_id UUID REFERENCES tenants(id);

UPDATE event_song_types SET tenant_id = (
  SELECT tenant_id FROM events WHERE events.id = event_song_types.event_id
);

-- 3. rehearsal_attendance
ALTER TABLE rehearsal_attendance 
ADD COLUMN tenant_id UUID REFERENCES tenants(id);

UPDATE rehearsal_attendance SET tenant_id = (
  SELECT tenant_id FROM rehearsals WHERE rehearsals.id = rehearsal_attendance.rehearsal_id
);
```

---

## 🔄 5. Copy Data Between Tenants (Superadmin Feature)

**Status: ❌ NÃO IMPLEMENTADO**

### 5.1 Fluxo Conceitual

```
SUPERADMIN
   ↓
Seleciona SOURCE_TENANT + TARGET_TENANT
   ↓
Escolhe o que copiar:
   - Song Types
   - Songs + Song Audios
   - Event Templates
   ↓
Validação:
   - Source existe?
   - Target existe?
   - Conflitos de nomes?
   ↓
Executa COPY (transação)
   ↓
Confirmação com auditoria
```

### 5.2 Implementação Recomendada

#### **Backend (Supabase Edge Function)**

```typescript
// supabase/functions/copy-tenant-data/index.ts
export const copySongType = async (
  sourceTenantId: string,
  targetTenantId: string,
  songTypeId: string
): Promise<string> => {
  // 1. Fetch source song_type
  const { data: sourceType } = await supabase
    .from('song_types')
    .select('*')
    .eq('id', songTypeId)
    .eq('tenant_id', sourceTenantId)
    .single();

  if (!sourceType) throw new Error('Source not found');

  // 2. Create new in target (new UUID)
  const { data: newType, error } = await supabase
    .from('song_types')
    .insert({
      ...sourceType,
      id: crypto.randomUUID(), // NEW ID
      tenant_id: targetTenantId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return newType.id;
};

export const copySongWithAudios = async (
  sourceTenantId: string,
  targetTenantId: string,
  songId: string,
  songTypeMapping: Record<string, string> // old_id -> new_id
): Promise<string> => {
  // 1. Fetch song
  const { data: sourceSong } = await supabase
    .from('songs')
    .select('*')
    .eq('id', songId)
    .eq('tenant_id', sourceTenantId)
    .single();

  // 2. Map song_type using mapping
  const newType = songTypeMapping[sourceSong.type] || sourceSong.type;

  // 3. Create new song
  const { data: newSong } = await supabase
    .from('songs')
    .insert({
      ...sourceSong,
      id: crypto.randomUUID(),
      tenant_id: targetTenantId,
      type: newType,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // 4. Copy audios
  const { data: audios } = await supabase
    .from('song_audios')
    .select('*')
    .eq('song_id', songId)
    .eq('tenant_id', sourceTenantId);

  if (audios && audios.length > 0) {
    await supabase
      .from('song_audios')
      .insert(
        audios.map(audio => ({
          ...audio,
          id: crypto.randomUUID(),
          song_id: newSong.id,
          tenant_id: targetTenantId,
          created_at: new Date().toISOString(),
        }))
      );
  }

  return newSong.id;
};

// Main function
export const copySongs = async (
  req: Request
): Promise<Response> => {
  const { sourceTenantId, targetTenantId, songTypeIds, songIds } = await req.json();

  try {
    // 1. Validate access (superadmin only)
    const { data: { user } } = await supabase.auth.getUser();
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { 
      _user_id: user.id 
    });

    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
    }

    // 2. Copy song types first
    const songTypeMapping: Record<string, string> = {};
    for (const typeId of songTypeIds) {
      const newTypeId = await copySongType(sourceTenantId, targetTenantId, typeId);
      songTypeMapping[typeId] = newTypeId;
    }

    // 3. Copy songs
    const newSongIds: string[] = [];
    for (const songId of songIds) {
      const newSongId = await copySongWithAudios(
        sourceTenantId,
        targetTenantId,
        songId,
        songTypeMapping
      );
      newSongIds.push(newSongId);
    }

    return new Response(
      JSON.stringify({ success: true, newSongIds }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
};
```

#### **Frontend UI (AdminTenants.tsx extensão)**

```typescript
interface CopyDataDialog {
  isOpen: boolean;
  sourceTenant: Tenant | null;
  targetTenant: Tenant | null;
  dataType: 'songs' | 'events' | 'songTypes' | null;
  selectedItems: string[];
}

// Adicionar ao AdminTenants:
<Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
  <DialogTrigger asChild>
    <Button variant="outline">
      <Copy className="h-4 w-4 mr-2" />
      Copiar Dados Entre Tenants
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Copiar Dados Entre Organizações</DialogTitle>
    </DialogHeader>
    
    {/* Tenant Source Selector */}
    <Select value={sourceTenant?.id || ''} onValueChange={setSourceTenant}>
      <SelectTrigger>
        <SelectValue placeholder="Origem..." />
      </SelectTrigger>
      <SelectContent>
        {tenants.map(t => (
          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* Data Type Selector */}
    <Select value={dataType || ''} onValueChange={setDataType}>
      <SelectTrigger>
        <SelectValue placeholder="Tipo de dado..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="songTypes">Tipos de Música</SelectItem>
        <SelectItem value="songs">Músicas + Áudios</SelectItem>
        <SelectItem value="events">Eventos</SelectItem>
      </SelectContent>
    </Select>

    {/* Target Tenant Selector */}
    <Select value={targetTenant?.id || ''} onValueChange={setTargetTenant}>
      <SelectTrigger>
        <SelectValue placeholder="Destino..." />
      </SelectTrigger>
      <SelectContent>
        {tenants.filter(t => t.id !== sourceTenant?.id).map(t => (
          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* Items to Copy (if songs/events selected) */}
    {dataType && sourceTenant && (
      <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
        {/* Checkboxes for each item */}
      </div>
    )}

    <Button 
      onClick={handleCopyData}
      disabled={!sourceTenant || !targetTenant || selectedItems.length === 0}
    >
      Copiar {selectedItems.length} itens
    </Button>
  </DialogContent>
</Dialog>
```

---

## 📦 6. Modelo Atual de Dados - Diagrama ER

```
┌──────────────┐
│   tenants    │ ← Root (1)
│──────────────│
│ id (PK)      │
│ slug (U)     │
│ name         │
│ logo_url     │
└──────────────┘
       │
       ├─────────────────────────────────┐
       │                                 │
   (1:N)                             (1:N)
       │                                 │
       ▼                                 ▼
┌──────────────────┐           ┌─────────────────┐
│  user_roles      │           │   profiles      │
│──────────────────│           │─────────────────│
│ id (PK)          │           │ id (PK)         │
│ user_id (FK)     │           │ id (auth.users) │
│ tenant_id (FK) ──┼───┐       │ tenant_id ──────┼───┐
│ role (ENUM)      │   │       │ full_name       │   │
└──────────────────┘   │       │ email           │   │
                       │       │ naipe           │   │
                       │       │ birth_date      │   │
                       │       │ parish          │   │
                       │       └─────────────────┘   │
                       │                             │
                       └─────────────┬───────────────┘
                                     │
                           (1:N tenant_id)
                                     │
       ┌─────────────────────────────┼──────────────────────────┐
       │                             │                          │
       ▼                             ▼                          ▼
┌────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│    events      │    │      songs           │    │   song_types     │
│────────────────│    │──────────────────────│    │──────────────────│
│ id (PK)        │    │ id (PK)              │    │ id (PK)          │
│ tenant_id (FK) │    │ tenant_id (FK)       │    │ tenant_id (FK)   │
│ name           │    │ name                 │    │ name             │
│ date           │    │ type (FK)            │    │ slug             │
│ location       │    │ notes                │    │ order_index      │
│ pdf_theme      │    │ sheet_music_url      │    └──────────────────┘
│ notes          │    │ user_id              │              ▲
└────────────────┘    └──────────────────────┘              │
       │                       │                      (1:N type)
       │                       ▼                            │
       │            ┌──────────────────────┐               │
       │            │   song_audios        │               │
       │            │──────────────────────│               │
       │            │ id (PK)              │               │
       │            │ song_id (FK)         │               │
       │            │ tenant_id (FK)       │               │
       │            │ naipe                │               │
       │            │ audio_url            │               │
       │            └──────────────────────┘               │
       │                                                   │
       ├──────────────────────────────┬────────────────────┤
       │                              │                    │
       ▼                              ▼                    ▼
┌──────────────────┐   ┌────────────────────┐  ┌────────────────────┐
│   rehearsals     │   │  event_songs       │  │ event_song_types   │
│──────────────────│   │────────────────────│  │────────────────────│
│ id (PK)          │   │ id (PK)            │  │ id (PK)            │
│ event_id (FK)    │   │ event_id (FK)      │  │ event_id (FK)      │
│ tenant_id (FK)   │   │ song_id (FK)       │  │ song_type_id (FK)  │
│ date             │   │ order_index        │  │ order_index        │
│ location         │   │ ❌ NO tenant_id    │  │ ❌ NO tenant_id    │
│ notes            │   └────────────────────┘  └────────────────────┘
└──────────────────┘              ▲
       │                          │
       │          ┌───────────────┘
       │          │
       ▼          ▼
┌──────────────────────────┐
│  rehearsal_attendance    │
│──────────────────────────│
│ id (PK)                  │
│ rehearsal_id (FK)        │
│ user_id (FK)             │
│ attended (boolean)       │
│ ❌ NO tenant_id          │
└──────────────────────────┘
```

---

## 🔧 7. Recomendações de Implementação

### **PRIORIDADE 1: SEGURANÇA (Semana 1-2)**

1. **Adicionar tenant_id a junction tables**
   - `event_songs.tenant_id`
   - `event_song_types.tenant_id`
   - `rehearsal_attendance.tenant_id`
   
2. **Implementar RLS no Supabase**
   - Enable RLS em todas as tabelas tenant-scoped
   - Criar policies para SELECT, INSERT, UPDATE, DELETE
   - Testar que usuário de tenant A não vê dados de tenant B

3. **Adicionar validações no backend**
   - Edge Functions para operações críticas (copy data)
   - Validar tenant_id em todas as mutações

### **PRIORIDADE 2: FEATURE (Semana 2-3)**

4. **Implementar "Copy Data Between Tenants"**
   - Edge Function com lógica de cópia
   - UI no AdminTenants com wizard
   - Suporte para: Song Types, Songs (+ audios), Events
   - Auditoria (log das cópias realizadas)

5. **Adicionar tabela de auditoria**
   ```sql
   CREATE TABLE audit_logs (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id),
     tenant_id UUID REFERENCES tenants(id),
     action VARCHAR,
     entity_type VARCHAR,
     entity_id UUID,
     changes JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

### **PRIORIDADE 3: OBSERVABILIDADE (Semana 3-4)**

6. **Admin Dashboard Melhorado**
   - Ver estatísticas por tenant (# eventos, músicas, usuários)
   - Ver histórico de cópias/operações
   - Alertas de limites de dados

---

## 📋 8. Checklist de Segurança Multi-Tenant

- [ ] RLS habilitado em todas as tabelas
- [ ] tenant_id presente em todas as tabelas tenant-scoped
- [ ] Queries sempre filtram por tenant_id
- [ ] SuperAdmin validado antes de copiar dados
- [ ] Edge Functions validam autenticação
- [ ] Logs de auditoria para operações sensíveis
- [ ] Senhas hasheadas (Supabase Auth)
- [ ] Rate limiting em endpoints críticos
- [ ] CORS configurado corretamente
- [ ] Segredos (chaves) em `.env` (não commitados)

---

## 🔍 9. Fluxos de Caso de Uso

### 9.1 Novo Tenant - Diocese Fortaleza

```
1. Superadmin acessa /admin/tenants
2. Clica "Nova Organização"
3. Preenche:
   - Nome: "Coro Diocese Fortaleza"
   - Slug: "fortaleza"
   - Logo: (upload)
4. Sistema cria:
   - tenants row
   - user_roles para superadmin como admin
5. Resultado: /(fortaleza)/* disponível

Dados iniciais:
- SEM song_types
- SEM songs
- SEM events
```

### 9.2 Copiar Estrutura de Quixadá para Fortaleza

```
1. Superadmin em /admin/tenants clica "Copiar Dados"
2. Seleciona:
   - Origem: "Quixadá"
   - Tipo: "Tipos de Música"
   - Itens: [Introito, Gradual, Ofertório, Comunhão, Recessional]
3. Clica "Copiar"
4. Sistema:
   - Valida que Quixadá tem esses tipos
   - Cria NOVOs tipos em Fortaleza (new UUIDs)
   - Mantém ordem (order_index)
5. Resultado: Fortaleza tem estrutura de song_types igual Quixadá

6. Segunda rodada - Seleciona:
   - Origem: "Quixadá"
   - Tipo: "Músicas"
   - Itens: [todas as músicas]
7. Sistema:
   - Cria novas songs em Fortaleza (referencia novas song_types)
   - Copia audios de ensaio (song_audios)
   - Preserva nomes, notas, PDFs
8. Resultado: Fortaleza tem biblioteca igual Quixadá, pronto para usar
```

### 9.3 Isolamento de Dados - Validação

```
Usuário em Quixadá tenta acessar dados de Fortaleza:

1. Query: SELECT * FROM songs WHERE tenant_id = 'fortaleza-id'
   - Frontend: Bloqueado (TenantContext != 'fortaleza')
   - Backend (com RLS): DENIED (user's tenant != 'fortaleza')

2. Query direta: SELECT * FROM songs WHERE id = 'fortaleza-song-id'
   - Frontend: Não faria (contexto errado)
   - Backend (com RLS): DENIED (row's tenant_id != user's tenant)
```

---

## 📈 10. Escalabilidade & Performance

### 10.1 Índices Recomendados

```sql
-- Índices essenciais para multi-tenancy
CREATE INDEX idx_events_tenant_id ON events(tenant_id);
CREATE INDEX idx_events_tenant_date ON events(tenant_id, date);
CREATE INDEX idx_songs_tenant_type ON songs(tenant_id, type);
CREATE INDEX idx_song_audios_tenant_song ON song_audios(tenant_id, song_id);
CREATE INDEX idx_rehearsals_tenant_date ON rehearsals(tenant_id, date);
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_user_roles_tenant_user ON user_roles(tenant_id, user_id);
```

### 10.2 Particionamento Futuro

Se o sistema crescer para 1000+ tenants:
```sql
-- Particionar por tenant_id (future optimization)
CREATE TABLE events_partitioned (
  LIKE events
) PARTITION BY HASH (tenant_id);

-- Cada tenant em sua partição
```

---

## 📚 11. Referências & Recursos

1. **Supabase RLS Docs:** https://supabase.com/docs/guides/auth/row-level-security
2. **Multi-Tenancy Patterns:** https://en.wikipedia.org/wiki/Multitenancy
3. **PostgreSQL Security:** https://www.postgresql.org/docs/current/sql-syntax.html

---

## ✅ 12. Conclusão

**Arquitetura Atual: 7.5/10**

✅ **Pontos Fortes:**
- Schema bem modelado com tenant_id
- TenantContext controla contexto corretamente
- RPC functions para validação de papéis
- Suporta múltiplas estratégias de tenant detection

⚠️ **Pontos a Melhorar:**
- RLS não implementado (segurança)
- Junction tables sem tenant_id (integridade)
- Feature de copy data não existe (usabilidade)
- Sem auditoria (compliance)

**Próximos Passos:**
1. Implementar RLS (semana 1)
2. Adicionar tenant_id a junction tables (semana 1)
3. Criar Edge Function de copy data (semana 2)
4. Adicionar UI no AdminTenants (semana 2-3)
5. Testes de isolamento de tenant (ongoing)