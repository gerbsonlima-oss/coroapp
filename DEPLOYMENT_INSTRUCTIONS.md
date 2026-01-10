# 🚀 Guia de Deployment - Multi-Tenant Architecture

## ✅ Arquivos Implementados

### 1. Migrações SQL (3 arquivos)
```
supabase/migrations/
├── 20260110_001_add_tenant_id_to_junctions.sql
├── 20260110_002_create_audit_logs.sql
└── 20260110_003_implement_rls_policies.sql
```

### 2. Edge Function
```
supabase/functions/copy-tenant-data/
├── index.ts (Lógica de cópia de dados)
└── deno.json (Dependências)
```

### 3. Frontend
```
src/
├── hooks/useCopyTenantData.tsx (Hook para copiar dados)
└── pages/AdminTenants.tsx (UI atualizada com funcionalidade de cópia)
```

---

## 📋 Passos de Deployment

### **PASSO 1: Backup do Banco de Dados** 🔒

1. Acesse: https://app.supabase.com/
2. Selecione seu projeto
3. Menu **Settings** → **Backups**
4. Clique **Create backup**
5. Aguarde conclusão (2-5 minutos)

### **PASSO 2: Deploy das Migrações SQL**

Opção A: Via CLI Supabase
```bash
supabase db push
```

Opção B: Via Supabase Dashboard
1. Acesse https://app.supabase.com/project/YOUR_PROJECT/sql/new
2. Copie o conteúdo de `20260110_001_add_tenant_id_to_junctions.sql`
3. Clique **RUN**
4. Aguarde conclusão
5. Repita para os 2 arquivos restantes (002 e 003)

⚠️ **Ordem importante:** 001 → 002 → 003

### **PASSO 3: Deploy da Edge Function**

```bash
supabase functions deploy copy-tenant-data
```

Ou via CLI interativa:
```bash
supabase functions deploy
```

### **PASSO 4: Build do Frontend**

```bash
npm run build
```

### **PASSO 5: Deploy no Vercel/Netlify (se usado)**

```bash
# Se usar Vercel
vercel

# Se usar Netlify
netlify deploy --prod
```

---

## 🧪 Testes Após Deployment

### **Teste 1: Verificar RLS está ativado**

No SQL Editor do Supabase:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('events', 'songs', 'song_types', 'rehearsals')
ORDER BY tablename;
```

**Esperado:** Todas as linhas com `rowsecurity = true`

### **Teste 2: Verificar tenant_id em junction tables**

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name IN ('event_songs', 'event_song_types', 'rehearsal_attendance')
AND column_name = 'tenant_id';
```

**Esperado:** 3 linhas (uma para cada tabela)

### **Teste 3: Testar isolamento de dados**

1. User A (Quixadá): Acesse `/(quixada)/songs`
   - Deve ver suas próprias músicas ✓
2. User A (Quixadá): Tente acessar `/(fortaleza)/songs`
   - Deve ver lista vazia ou erro ✗

### **Teste 4: Testar cópia de dados**

1. Faça login como Super Admin
2. Acesse `/admin/tenants`
3. Clique **"Copiar Dados"**
4. Selecione:
   - Origem: Quixadá
   - Tipo: Tipos de Música
   - Itens: Selecione alguns
   - Destino: Fortaleza
5. Clique **"Copiar X itens"**
6. Aguarde conclusão

**Esperado:**
- Toast de sucesso "X itens copiados com sucesso!"
- Fortaleza agora tem os tipos de música copiados
- IDs são diferentes (nova cópia, não referência)

### **Teste 5: Verificar Audit Logs**

```sql
SELECT action, entity_type, description, created_at 
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

**Esperado:** Logs da operação de cópia

---

## 🔐 Checklist de Segurança Pós-Deploy

- [ ] RLS ativado em todas as 9 tabelas
- [ ] tenant_id adicionado a 3 junction tables
- [ ] Audit logs criada com RLS
- [ ] Edge Function deployada
- [ ] User A não consegue acessar dados de User B
- [ ] Admin pode copiar dados
- [ ] Super Admin pode copiar entre tenants
- [ ] Logs de cópia são registrados
- [ ] Índices foram criados (performance)

---

## 🐛 Troubleshooting

### Erro: "Permission denied for schema public"

**Causa:** RLS está muito restritivo  
**Solução:**
```sql
-- Remover e recriar política
DROP POLICY IF EXISTS "Users can view events in their tenant" ON events;

CREATE POLICY "Users can view events in their tenant"
ON events FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
);
```

### Erro: "Column tenant_id does not exist"

**Causa:** Migração 001 não foi executada  
**Solução:**
1. Verifique migrations rodadas: https://app.supabase.com/project/YOUR_PROJECT/sql/migrations
2. Se não estiver, execute manualmente

### Erro: "Function not found" na cópia

**Causa:** Edge Function não foi deployada  
**Solução:**
```bash
supabase functions deploy copy-tenant-data
```

### Teste RLS falha

**Verificar:**
```sql
-- Ver todas as políticas
SELECT * FROM pg_policies WHERE tablename = 'events';

-- Ver se RLS está ativado
SELECT * FROM pg_tables WHERE tablename = 'events';
```

---

## 📊 Monitoramento Pós-Deploy

### Verificar logs de erro
```bash
supabase functions logs copy-tenant-data
```

### Monitorar performance
```sql
-- Índices criados?
SELECT * FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'events', 'songs', 'event_songs', 
  'rehearsals', 'rehearsal_attendance'
)
ORDER BY tablename;

-- Verificar tamanho das tabelas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔄 Rollback (se necessário)

### Se RLS quebrou queries:

```sql
-- Desativar RLS temporariamente
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- Corrigir política
DROP POLICY IF EXISTS "problematic_policy" ON events;

-- Reativar com política corrigida
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
```

### Se migração falhou:

1. Via Supabase Dashboard: SQL Editor
2. Execute em reversa (drop columns, policies)
3. Reverta backup se necessário

---

## ✨ Próximos Passos

1. ✅ **Implementado:** RLS, tenant_id, copy feature, audit logs
2. 📋 **TODO:** Testes de carga (1000+ registros)
3. 📋 **TODO:** Testes de penetração (isolamento)
4. 📋 **TODO:** Documentação para usuários
5. 📋 **TODO:** Monitoramento contínuo em produção

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs: `supabase functions logs copy-tenant-data`
2. Revise o arquivo SQL no SQL Editor
3. Verifique permissões do usuário
4. Consulte SECURITY_BEST_PRACTICES.md

**Data de Deployment:** 2026-01-10  
**Versão:** 1.0  
**Status:** Pronto para Deploy ✅
