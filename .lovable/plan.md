# Plano de Melhorias UX — Liturgia+

> Plano anterior (Backup/Restore) já implementado. Este plano foca na refatoração de UX.

---

## Fase 1 — Header Admin e Painel Centralizado (Prioridade Alta)

### 1.1 Criar Painel Admin (`/:tenant/admin`)
- [ ] Nova página `src/pages/AdminDashboard.tsx` com cards para cada feature admin
- [ ] Cards Admin: Coralistas, Aprovações Pendentes (badge de contagem), Tipos de Música, Ensaios
- [ ] Cards Super Admin: Gerenciar Tenants, Backup, Restaurar
- [ ] Adicionar rota `/:tenantSlug/admin` no App.tsx
- [ ] Adicionar link no header da Home (único botão "Admin")

### 1.2 Simplificar Header da Home
- [ ] Remover botões individuais (Coralistas, Aprovações, Admin, Backup, Restaurar) do header
- [ ] Substituir por um único botão/ícone "⚙️ Admin" que navega para `/:tenant/admin`
- [ ] Manter apenas: TenantSwitcher, OfflineEvents, Login/Logout, PWA

---

## Fase 2 — Refatoração de Componentes Monolíticos (Prioridade Alta)

### 2.1 Refatorar EventDetails.tsx (1673 linhas)
- [ ] Extrair `EventHeader` — capa, título, data, local, ações de compartilhar
- [ ] Extrair `EventSongList` — lista de músicas com filtros e agrupamento
- [ ] Extrair `EventFilterControls` — filtro de naipe, agrupamento, busca
- [ ] Extrair `EventExportActions` — PDF, ZIP, booklet, cifras
- [ ] Extrair `EventAdminActions` — adicionar/remover música, editar, reordenar
- [ ] Manter EventDetails como orquestrador de estado

### 2.2 Refatorar SimpleEventAudios.tsx (1812 linhas)
- [ ] Extrair `SimpleEventHeader` — nome do evento, data, ações admin
- [ ] Extrair `AudioTrackList` — lista de áudios com filtro
- [ ] Extrair `AddSongToEventModal` — modal de adicionar música
- [ ] Extrair `SimpleEventFilters` — busca e filtro de naipe
- [ ] Extrair `SimpleEventAdminMenu` — menu dropdown admin (editar, reordenar, exportar)

---

## Fase 3 — Consistência Visual e Design System (Prioridade Média)

### 3.1 Eliminar Cores Hardcoded
- [ ] `Home.tsx` — mover cores litúrgicas (`from-purple-600`, etc.) para CSS variables
- [ ] `Songs.tsx` — mover `typeGradients` para design tokens
- [ ] `ChoirMembers.tsx` — mover `naipeColors` e `naipeGradients` para tokens compartilhados
- [ ] `EventDetails.tsx` — mover `naipeColors` para arquivo centralizado
- [ ] Criar `src/utils/themeColors.ts` com todas as cores semânticas

### 3.2 Padronizar Componentes de Confirmação
- [ ] Substituir `window.confirm()` em `Songs.tsx` por AlertDialog
- [ ] Adicionar confirmação ao botão "Sair" na Home
- [ ] Garantir que todas as ações destrutivas usam AlertDialog

### 3.3 Adicionar Indicador Visual de Admin
- [ ] Badge ou ícone discreto no header indicando "Modo Admin" quando o usuário é admin
- [ ] Diferenciar visualmente ações admin de ações comuns

---

## Fase 4 — Limpeza de Rotas e Código (Prioridade Média)

### 4.1 Simplificar App.tsx
- [ ] Eliminar duplicação de rotas (cada rota aparece 2-3x)
- [ ] Criar helper para gerar rotas com/sem prefixo tenant automaticamente
- [ ] Remover `AppRoutes` que não é utilizado

### 4.2 Limpeza Geral
- [ ] Remover imports não utilizados em páginas grandes
- [ ] Consolidar tipos duplicados (EventSong, SongAudio aparecem em 3+ arquivos)
- [ ] Criar arquivo `src/types/index.ts` com tipos compartilhados

---

## Fase 5 — Melhorias de UX Menores (Prioridade Baixa)

### 5.1 Feedback Visual
- [ ] Skeleton loading na tela de aprovação ao aprovar/rejeitar
- [ ] Mostrar data do último backup na página de Backup
- [ ] Breadcrumbs nas páginas admin internas
- [ ] Loading state no botão "Copiar membro" entre tenants

### 5.2 Acessibilidade
- [ ] Touch targets mínimos de 48px em todos os botões mobile
- [ ] `aria-label` em botões icon-only
- [ ] Melhorar contraste de badges de naipe no tema escuro

### 5.3 Performance
- [ ] Virtualização na lista de músicas quando > 50 itens
- [ ] Lazy load de imagens de capa nas listas de eventos
- [ ] Memoizar componentes pesados com React.memo

---

## Ordem de Execução Recomendada

1. **Fase 1** — Impacto imediato na usabilidade admin (~2 mensagens)
2. **Fase 3.2** — Fix rápido: window.confirm → AlertDialog (~1 mensagem)
3. **Fase 2** — Refatoração estrutural (~3-4 mensagens)
4. **Fase 3.1** — Consistência do design system (~2 mensagens)
5. **Fase 4** — Limpeza técnica (~1-2 mensagens)
6. **Fase 5** — Polish final (~2-3 mensagens)

---

## Notas Técnicas

- O preview está funcionando normalmente (todas as requests retornam 200)
- O app é uma PWA com suporte offline robusto
- Multi-tenancy via URL slug (ex: `/seminario-quixada/events`)
- Roles: user, admin, super_admin — verificados via RPC server-side
- EventDetails e SimpleEventAudios são as duas views do mesmo evento (completa vs simplificada)
