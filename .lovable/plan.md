
# Musicas publicas no evento - Plano de correcao

## Problema identificado

O tenant "Seminario Diocesano" nao consegue ver os tipos de musica (song_types) porque todos os tipos pertencem ao tenant "Coro Diocese Quixada" e a politica de seguranca (RLS) da tabela `song_types` so permite visualizar tipos do proprio tenant.

Isso impacta:
- Criacao de eventos (o formulario de tipos fica vazio)
- Adicao de musicas ao evento (o seletor de tipo fica vazio)
- Labels dos tipos nao aparecem na interface

Alem disso, as musicas publicas ja estao sendo buscadas corretamente nas queries (usando `is_public.eq.true`), entao o problema nao esta na busca de musicas, mas sim nos tipos de musica.

## Solucao

### 1. Atualizar a politica RLS da tabela `song_types` (SELECT)

Tornar os song_types visiveis para todos os usuarios autenticados (ja que sao categorias liturgicas globais, nao dados sensiveis).

```sql
DROP POLICY "Users can view song types in their tenant" ON public.song_types;
CREATE POLICY "Users can view all song types"
  ON public.song_types FOR SELECT
  USING (true);
```

### 2. Sem alteracoes de codigo necessarias

As queries no frontend ja buscam song_types sem filtro de tenant (ex: `NewEvent.tsx`, `EventQuickEdit.tsx`), confiando na RLS. Uma vez que a RLS permita visualizar todos os tipos, tudo funcionara automaticamente.

## Detalhes tecnicos

- Tabela afetada: `song_types`
- Politica atual de SELECT: `(tenant_id = get_user_tenant_id(auth.uid())) OR (auth.uid() IS NULL)`
- Nova politica de SELECT: `true` (todos podem visualizar)
- Politicas de escrita (INSERT/UPDATE/DELETE) permanecem inalteradas - apenas admins do tenant dono podem gerenciar
- Impacto: todos os tenants poderao ver os mesmos tipos liturgicos e usar nos seus eventos
