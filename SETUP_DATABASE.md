# Configuração do Banco de Dados para Gestão de Ensaios e Inscrições

Este guia descreve como criar as tabelas necessárias no Supabase para as novas funcionalidades de gestão de ensaios e inscrições de eventos.

## Tabelas Necessárias

### 1. Tabela `event_registrations`

Esta tabela armazena as inscrições de pessoas (perfis) em eventos específicos.

```sql
CREATE TABLE public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(event_id, user_id)
);

-- Criar índices para melhor desempenho
CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);

-- Configurar RLS (Row Level Security)
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir leitura para usuários autenticados
CREATE POLICY "Allow authenticated users to read registrations"
ON event_registrations
FOR SELECT
USING (auth.role() = 'authenticated_user');

-- Policy: Permitir inserção e deleção para admins
CREATE POLICY "Allow admins to manage registrations"
ON event_registrations
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);
```

## Atualizar Tipos do TypeScript (types.ts)

Se você quiser tipos TypeScript gerados automaticamente, execute:

```bash
npx supabase gen types typescript --project-id=YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

## Estrutura das Funcionalidades Implementadas

### Gestão de Inscrições de Eventos
- **Página**: `/events/:eventId/registrations`
- **Funcionalidades**:
  - Visualizar lista de inscritos
  - Adicionar participantes ao evento (admin)
  - Remover participantes (admin)
  - Exportar lista de inscritos em CSV

### Gestão de Ensaios
- **Página**: `/events/:eventId/rehearsals` ou `/rehearsals`
- **Funcionalidades**:
  - Criar novos ensaios (admin)
  - Editar ensaios (admin)
  - Deletar ensaios (admin)
  - Marcar lista de presença
  - Visualizar estatísticas de presença
  - Exportar lista de presença em CSV
  - Enviar mensagens via WhatsApp

## Como Usar

### 1. Inscrever pessoas em um evento
1. Acesse um evento
2. Clique no menu (⋯) → "Gerenciar Inscrições"
3. Clique no botão (+) para adicionar participantes
4. Selecione os participantes desejados
5. Clique em "Inscrever"

### 2. Marcar presença em ensaios
1. Acesse um evento
2. Clique no menu (⋯) → "Ensaios"
3. Clique em "X participantes" no ensaio desejado
4. Marque a presença dos participantes (checkbox)
5. Exporte a lista se necessário (botão Baixar)

### 3. Criar um novo ensaio
1. Acesse a página de ensaios de um evento
2. Clique no botão (+) para criar novo ensaio
3. Preencha os dados:
   - Data *
   - Local (opcional)
   - Observações (opcional)
4. Clique em "Criar Ensaio"

## Notas Importantes

- Os usuários precisam ter um perfil cadastrado (nome completo, email, naipe, telefone)
- A funcionalidade de WhatsApp requer que os usuários tenham um número de telefone cadastrado
- A exportação em CSV inclui presentes, ausentes e estatísticas básicas
- Todos os dados são sincronizados em tempo real com o Supabase
