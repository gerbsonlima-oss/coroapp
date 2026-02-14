

## Musicas Publicas (Compartilhadas entre Tenants)

### Objetivo
Permitir que admins marquem uma musica como "publica", tornando-a visivel para todos os tenants (somente leitura). Apenas o tenant dono pode editar/excluir.

### Alteracoes

#### 1. Banco de Dados
- Adicionar coluna `is_public BOOLEAN DEFAULT false` na tabela `songs`
- Atualizar a politica RLS de SELECT para incluir musicas onde `is_public = true` (alem das do proprio tenant)
- Manter as politicas de UPDATE/DELETE inalteradas (apenas o tenant dono gerencia)

#### 2. Formulario de Musica (`SongForm.tsx`)
- Adicionar um toggle/switch "Musica publica" visivel apenas para admins
- Salvar o campo `is_public` no insert/update

#### 3. Listagem de Musicas (`Songs.tsx`)
- Alterar a query para buscar musicas do tenant **OU** musicas publicas de outros tenants
- Adicionar um indicador visual (badge/icone) para musicas publicas de outros tenants
- Musicas publicas de outros tenants serao somente leitura (sem opcoes de editar/excluir)

#### 4. Detalhes da Musica (`SongDetails.tsx`)
- Mostrar badge "Publica" quando `is_public = true`
- Esconder opcoes de edicao/exclusao para musicas de outros tenants

---

### Detalhes Tecnicos

**Migracao SQL:**
```sql
ALTER TABLE public.songs ADD COLUMN is_public BOOLEAN DEFAULT false;

-- Atualizar politica SELECT para incluir publicas
DROP POLICY "Users can view songs in their tenant" ON public.songs;
CREATE POLICY "Users can view songs in their tenant or public"
  ON public.songs FOR SELECT
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()))
    OR is_public = true
    OR (auth.uid() IS NULL)
  );
```

**Logica de query na listagem:**
```typescript
// Antes: .eq('tenant_id', tenantId)
// Depois: .or(`tenant_id.eq.${tenantId},is_public.eq.true`)
```

**Identificacao de musica externa:**
- Comparar `song.tenant_id !== tenantId` para saber se e de outro tenant
- Nesse caso, exibir badge "Publica" e bloquear edicao/exclusao

