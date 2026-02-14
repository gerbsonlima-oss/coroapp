
# Analise Completa de Funcionalidades e Proposta de Melhorias -- CantoSacro

## 1. Mapa de Funcionalidades Atuais

### Modulo Principal (Todos os Usuarios)
| Funcionalidade | Pagina | Status |
|---|---|---|
| Dashboard com eventos proximos/recentes | Home.tsx | Funcional |
| Calendario liturgico com leituras diarias | Liturgy.tsx | Funcional |
| Lista de eventos com busca | Events.tsx | Funcional |
| Player de audio por naipe (Spotify-like) | SimpleEventAudios.tsx | Funcional |
| Repertorio de musicas agrupado por tipo | Songs.tsx | Funcional |
| Visualizador de partituras (PDF) | SheetViewer/SimpleSheetViewer | Funcional |
| Visualizador de cifras com transposicao | ChordViewer/FullscreenChordViewer | Funcional |
| Compartilhamento via WhatsApp | whatsappShare.ts | Funcional |
| Modo offline (PWA) | OfflineStorage/ServiceWorker | Funcional |
| Exportacao de PDF (evento, booklet, cifras) | exportEventPDF/exportSongBookletPDF | Funcional |

### Modulo Admin
| Funcionalidade | Pagina | Status |
|---|---|---|
| Painel Admin centralizado | AdminDashboard.tsx | Recem criado |
| Gerenciar coralistas (CRUD) | ChoirMembers.tsx | Funcional |
| Aprovar/rejeitar cadastros | ChoirMembers.tsx (tab Pendentes) | Funcional |
| Gerenciar tipos de musica | AdminSongTypes.tsx | Funcional |
| Gerenciar ensaios e presenca | Rehearsals.tsx | Funcional |
| Membros por evento | EventMembersManager.tsx | Funcional |
| Criar/editar eventos com capa | NewEvent/EditEvent.tsx | Funcional |
| Criar/editar musicas com audios por naipe | SongForm.tsx | Funcional |
| Reordenar musicas no evento | ReorderSongsSheet.tsx | Funcional |

### Modulo Super Admin
| Funcionalidade | Pagina | Status |
|---|---|---|
| Gerenciar tenants (coros) | AdminTenants.tsx | Funcional |
| Backup completo (ZIP) | AdminBackup.tsx + Edge Function | Funcional |
| Restaurar backup | AdminRestore.tsx + Edge Function | Funcional |
| Copiar musica entre tenants | CopySongToTenantDialog.tsx | Funcional |
| Copiar membro entre tenants | ChoirMembers.tsx | Funcional |

---

## 2. Problemas Identificados

### 2.1 Problemas de UX

**P1 -- Duplicacao massiva de codigo e constantes**
- `naipeColors`, `naipeLabels`, `typeLabels` estao duplicados em **6+ arquivos** (ChoirMembers, ChoirMemberDetails, EventMembersManager, EventDetails, SimpleEventAudios, SongDetails, Rehearsals)
- Qualquer mudanca de cor ou label precisa ser replicada manualmente

**P2 -- `window.confirm()` nativo**
- Songs.tsx (linha 207): `confirm("Tem certeza que deseja excluir...")` -- quebra a consistencia visual
- Rehearsals.tsx (linha 179): `confirm("Deseja excluir este ensaio?")` -- mesmo problema
- Outros arquivos usam corretamente AlertDialog (SongDetails.tsx, ChoirMembers.tsx)

**P3 -- Navegacao inconsistente ao voltar**
- SongDetails.tsx: botao voltar vai para `/songs` fixo (ignora tenant prefix)
- Liturgy.tsx: botao voltar vai para `/events` (deveria ser Home ou usar navigate(-1))
- ChoirMemberDetails: usa navigate(-1) corretamente

**P4 -- Falta de busca na pagina de Eventos**
- Events.tsx nao tem campo de busca -- impossivel filtrar entre muitos eventos
- Songs.tsx tem busca e filtros, mas Events.tsx nao

**P5 -- Ensaios desconectados**
- A pagina de Ensaios so aparece no Admin Dashboard, mas e util para todos os coralistas verem a agenda
- Nao aparece na BottomNavigation nem na Home

**P6 -- Pagina de Liturgia sem vinculo com eventos**
- O usuario le a liturgia do dia mas nao tem como ver rapidamente quais musicas/eventos estao planejados para aquela data

### 2.2 Problemas Tecnicos

**T1 -- Componentes monoliticos**
- SimpleEventAudios.tsx: 1812 linhas
- EventDetails.tsx: 1673 linhas
- SongForm.tsx: 732 linhas
- Songs.tsx: 875 linhas

**T2 -- Rotas duplicadas no App.tsx**
- Cada rota aparece 2x (com e sem tenant prefix) = ~100 linhas desnecessarias
- Pode ser resolvido com um helper de rotas

**T3 -- Queries sem React Query em varias paginas**
- Events.tsx, Rehearsals.tsx, Songs.tsx usam useState + useEffect para fetch manual
- Inconsistente com ChoirMembers.tsx que usa useQuery corretamente

---

## 3. Melhorias Propostas

### Fase A -- Quick Wins de UX (1-2 mensagens)

**A1. Centralizar constantes compartilhadas**
- Criar `src/constants/naipes.ts` com naipeLabels, naipeColors, naipeGradients, NAIPE_ORDER
- Criar `src/constants/songTypes.ts` com typeLabels, typeColors, typeGradients, songTypeOrder
- Atualizar todos os 6+ arquivos que duplicam essas constantes

**A2. Substituir window.confirm por AlertDialog**
- Songs.tsx: excluir musica
- Rehearsals.tsx: excluir ensaio
- Qualquer outro uso remanescente

**A3. Corrigir navegacao inconsistente**
- Padronizar botao "voltar" usando `buildPath()` em todas as paginas
- SongDetails, Liturgy e outras paginas com links fixos

**A4. Adicionar busca na pagina de Eventos**
- Campo de busca simples (nome, local, data) no topo da lista

### Fase B -- Novas Funcionalidades (3-5 mensagens)

**B1. Dashboard de Estatisticas do Coral**
- Card na Home (admin) mostrando: total de musicas, total de eventos, proximo evento, presenca media nos ensaios
- Grafico simples de presenca por ensaio (ja tem recharts instalado)

**B2. Notificacoes de Proximo Evento**
- Banner na Home quando ha evento nas proximas 48h
- Botao "Lembrar via WhatsApp" para admin enviar aviso ao grupo

**B3. Historico de Musicas por Evento**
- Na pagina SongDetails, mostrar "Usada em X eventos" com lista dos eventos onde a musica foi utilizada
- Ajuda o regente a saber quais musicas estao sendo repetidas

**B4. Sugestao de Repertorio por Liturgia**
- Na pagina de Liturgia, sugerir musicas do repertorio do coro que combinam com o tempo liturgico (baseado no tipo/tag)
- Ex: Tempo Pascal -> sugerir musicas do tipo "Gloria" e "Aleluia"

**B5. Auto-checklist de Evento**
- No EventDetails/SimpleEventAudios, mostrar indicadores visuais:
  - Musica sem audio gravado (icone de alerta)
  - Naipe faltando audio (ex: "Falta: Tenor, Baixo")
  - Musica sem partitura
- Ajuda admin a ver o que falta preparar antes do evento

**B6. Modo de Ensaio com Setlist**
- Player sequencial que toca todas as musicas do evento na ordem liturgica
- Opcao de "loop na musica atual" para praticar uma parte especifica
- Timer de ensaio mostrando tempo total

### Fase C -- Melhorias de Admin (2-3 mensagens)

**C1. Relatorio de Presenca Consolidado**
- Tela que mostra presenca de todos os membros em todos os ensaios
- Ranking por frequencia (quem mais participa)
- Exportacao em PDF/CSV

**C2. Duplicar Evento**
- Botao "Duplicar" no evento que cria uma copia com nova data mas mesmo repertorio
- Muito util para missas recorrentes com repertorio similar

**C3. Templates de Evento**
- Salvar um evento como "template" (ex: "Missa Dominical Padrao")
- Ao criar novo evento, opcao de "Usar template" que pre-preenche as musicas

**C4. Configuracoes do Tenant**
- Pagina no Admin para configurar: nome do coro, logo, cor tema, mensagem de boas-vindas
- Atualmente so pode ser feito via banco de dados

### Fase D -- Refatoracao Tecnica (3-4 mensagens)

**D1. Refatorar componentes monoliticos**
- SimpleEventAudios.tsx -> extrair PlayerSection, SongListSection, AdminActionsMenu, FilterControls
- EventDetails.tsx -> extrair EventHeader, EventSongList, EventExportActions

**D2. Simplificar rotas do App.tsx**
- Criar `createTenantRoutes(routes)` que gera automaticamente versoes com/sem prefix
- Reduzir App.tsx de ~300 linhas de rotas para ~60

**D3. Migrar para React Query consistente**
- Events.tsx, Rehearsals.tsx, Songs.tsx: substituir useState+useEffect por useQuery
- Beneficios: cache, refetch automatico, estados de loading/error padronizados

---

## 4. Ordem de Execucao Recomendada

| Prioridade | Item | Esforco | Impacto |
|---|---|---|---|
| 1 | A1. Centralizar constantes | 1 msg | Alto (elimina divida tecnica) |
| 2 | A2. Substituir window.confirm | 1 msg | Medio (consistencia visual) |
| 3 | A4. Busca em Eventos | 1 msg | Alto (usabilidade) |
| 4 | B5. Auto-checklist de Evento | 1 msg | Alto (produtividade admin) |
| 5 | B3. Historico de musicas | 1 msg | Medio (informacao util) |
| 6 | C2. Duplicar evento | 1 msg | Alto (produtividade admin) |
| 7 | B1. Dashboard estatisticas | 2 msgs | Medio (visao geral) |
| 8 | C3. Templates de evento | 2 msgs | Alto (produtividade) |
| 9 | B4. Sugestao de repertorio | 2 msgs | Medio (inteligencia) |
| 10 | D1-D3. Refatoracao tecnica | 3-4 msgs | Alto (manutencao) |

---

## 5. Resumo Tecnico

### Arquivos a criar
- `src/constants/naipes.ts`
- `src/constants/songTypes.ts`
- Componentes extraidos de EventDetails e SimpleEventAudios (Fase D)

### Arquivos a modificar
- Songs.tsx, Rehearsals.tsx (window.confirm -> AlertDialog)
- SongDetails.tsx, Liturgy.tsx (navegacao)
- Events.tsx (adicionar busca)
- 6+ arquivos (importar constantes centralizadas)
- App.tsx (simplificar rotas -- Fase D)

### Dependencias necessarias
- Nenhuma nova -- tudo pode ser feito com as dependencias existentes (recharts, shadcn/ui, etc.)
