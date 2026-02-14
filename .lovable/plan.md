

# Plano de Limpeza do Projeto CantoSacro

## Resumo

Apos analise completa de todos os arquivos, identifiquei **arquivos mortos, artefatos de build, codigo orfao e duplicacoes** que devem ser removidos para manter o projeto limpo e padrao Lovable.

---

## 1. Arquivos de Build que nao deveriam estar no repositorio

Estes arquivos sao gerados automaticamente e ja estao no `.gitignore` (regra `*.tsbuildinfo`), mas estao presentes no projeto:

| Arquivo | Motivo da remocao |
|---|---|
| `tsconfig.app.tsbuildinfo` | Cache de compilacao TypeScript, gerado automaticamente |
| `tsconfig.node.tsbuildinfo` | Cache de compilacao TypeScript, gerado automaticamente |
| `bun.lock` | Lockfile do Bun (projeto usa npm/package-lock.json) |

---

## 2. Arquivo CSS legado do Vite (template padrao)

| Arquivo | Motivo da remocao |
|---|---|
| `src/App.css` | CSS do template inicial do Vite (`.logo`, `.logo-spin`, `.read-the-docs`). Nao e usado pelo app -- todo o estilo vem do Tailwind e `index.css` |

---

## 3. Componentes orfaos (nunca importados por nenhum arquivo)

| Arquivo | Descricao | Importado por |
|---|---|---|
| `src/components/FullscreenPlayer.tsx` | Player fullscreen (256 linhas) | Nenhum arquivo |
| `src/components/NavLink.tsx` | Wrapper de NavLink (28 linhas) | Nenhum arquivo |
| `src/components/EventCard.tsx` | Card de evento (62 linhas) | Nenhum arquivo |
| `src/components/NaipeSelectionDialog.tsx` | Dialog de selecao de naipe (46 linhas) | Nenhum arquivo |
| `src/components/SearchSongMetadataDialog.tsx` | Dialog de busca de metadados (265 linhas) | Nenhum arquivo |
| `src/components/QuickAudioFAB.tsx` | FAB de gravacao rapida | Nenhum arquivo (QuickAudioRecorder so e importado por ele) |
| `src/components/QuickAudioRecorder.tsx` | Gravador rapido de audio | Apenas por QuickAudioFAB (que tambem e orfao) |

---

## 4. Utilitario orfao (nunca importado)

| Arquivo | Descricao | Importado por |
|---|---|---|
| `src/utils/dynamicExports.ts` | Wrapper dinamico para exportPDF/exportZIP (26 linhas) | Nenhum arquivo |

---

## 5. Asset orfao

| Arquivo | Descricao | Importado por |
|---|---|---|
| `src/assets/diocese-brasao.png` | Brasao de diocese | Nenhum arquivo |

---

## 6. Arquivo de toast duplicado (re-export desnecessario)

| Arquivo | Descricao |
|---|---|
| `src/components/ui/use-toast.ts` | Apenas re-exporta `src/hooks/use-toast.ts`. Nenhum arquivo importa dele -- todos ja importam diretamente de `@/hooks/use-toast` |

---

## 7. Manifest duplicado

| Arquivo | Descricao |
|---|---|
| `public/manifest.json` | Duplica o manifest que ja esta definido em `vite.config.ts` via VitePWA plugin. O plugin gera o manifest automaticamente no build |

---

## Resumo da Limpeza

| Categoria | Arquivos | Linhas removidas (aprox.) |
|---|---|---|
| Build artifacts | 3 arquivos | N/A (binarios/json) |
| CSS legado | 1 arquivo | 41 linhas |
| Componentes orfaos | 7 arquivos | ~700 linhas |
| Utilitarios orfaos | 1 arquivo | 26 linhas |
| Assets orfaos | 1 arquivo | N/A (imagem) |
| Re-export desnecessario | 1 arquivo | 3 linhas |
| Manifest duplicado | 1 arquivo | 30 linhas |
| **TOTAL** | **14 arquivos** | **~800 linhas de codigo morto** |

---

## Ordem de Execucao

1. Deletar os 3 arquivos de build (`tsbuildinfo`, `bun.lock`)
2. Deletar `src/App.css`
3. Deletar os 7 componentes orfaos
4. Deletar `src/utils/dynamicExports.ts`
5. Deletar `src/assets/diocese-brasao.png`
6. Deletar `src/components/ui/use-toast.ts`
7. Deletar `public/manifest.json`
8. Verificar que nenhum import quebrou (o App.css pode estar importado no App.tsx -- se sim, remover o import)

### Impacto: Zero funcionalidade perdida. Apenas codigo morto e artefatos removidos.

