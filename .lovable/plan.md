

# Plano: Sistema de Exportação/Importação Completa para Remix

## Contexto do Problema

Ao fazer um **remix de um projeto Lovable**, apenas o **código fonte** é copiado. O banco de dados e os arquivos de storage (áudios, partituras, imagens) ficam no projeto original e não são transferidos.

### Arquivos que precisam ser copiados (storage buckets):
- **audio-files**: Áudios das músicas por naipe
- **sheet-music**: Partituras (imagens e PDFs)
- **event-covers**: Imagens de capa dos eventos

### Dados do banco que precisam ser copiados:
- **tenants**: Informações dos coros
- **song_types**: Categorias litúrgicas
- **songs**: Músicas (com referências a arquivos)
- **song_audios**: Áudios associados às músicas
- **events**: Eventos/missas
- **event_songs**: Músicas vinculadas a eventos
- **event_song_types**: Tipos de música por evento
- **choir_members**: Membros do coral
- **profiles**: Perfis de usuários
- **rehearsals**: Ensaios

---

## Solução Proposta

Criar duas funcionalidades:

### 1. **Exportar Backup Completo** (no projeto original)
Uma edge function + página de admin que:
- Exporta todos os dados do banco em formato JSON
- Baixa todos os arquivos dos buckets
- Gera um arquivo ZIP completo para download

### 2. **Importar Backup** (no projeto remix/novo)
Uma edge function + página de admin que:
- Recebe o arquivo ZIP exportado
- Faz upload dos arquivos para os buckets do novo projeto
- Recria os registros no banco com os novos URLs
- Mantém as relações entre entidades (IDs mapeados)

---

## Arquitetura Técnica

```text
┌─────────────────────────────────────────────────────────────┐
│                    PROJETO ORIGINAL                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Admin Page (/admin/backup)                                │
│   └─> Botão "Exportar Backup Completo"                      │
│       └─> Edge Function: export-full-backup                 │
│           ├─> Busca dados do banco (tenants, songs, etc)    │
│           ├─> Lista arquivos dos buckets                    │
│           ├─> Gera manifest.json com metadados              │
│           └─> Retorna lista de URLs para download           │
│                                                              │
│   Frontend:                                                  │
│   └─> Baixa arquivos + cria ZIP no browser                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    [backup.zip]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROJETO NOVO (REMIX)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Admin Page (/admin/restore)                               │
│   └─> Upload do backup.zip                                  │
│       └─> Frontend processa ZIP                             │
│           ├─> Lê manifest.json                              │
│           ├─> Upload arquivos para novos buckets            │
│           ├─> Chama Edge Function: import-backup            │
│           │   └─> Insere dados no banco                     │
│           │       com URLs atualizados                      │
│           └─> Exibe progresso e resultado                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/export-full-backup/index.ts` | Edge function que coleta dados e gera manifest |
| `supabase/functions/import-backup/index.ts` | Edge function que insere dados no banco |
| `src/pages/AdminBackup.tsx` | Página de exportação de backup |
| `src/pages/AdminRestore.tsx` | Página de importação de backup |
| `src/utils/backupExport.ts` | Utilitário para criar ZIP de backup |
| `src/utils/backupImport.ts` | Utilitário para processar ZIP e restaurar |
| `src/hooks/useBackupExport.tsx` | Hook para gerenciar exportação |
| `src/hooks/useBackupImport.tsx` | Hook para gerenciar importação |

### Modificações

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar rotas /admin/backup e /admin/restore |

---

## Estrutura do Backup ZIP

```text
backup-{tenant-slug}-{timestamp}.zip
├── manifest.json          # Metadados e mapeamento
├── data/
│   ├── tenants.json
│   ├── song_types.json
│   ├── songs.json
│   ├── song_audios.json
│   ├── events.json
│   ├── event_songs.json
│   ├── event_song_types.json
│   ├── choir_members.json
│   └── rehearsals.json
├── audio-files/
│   └── {original-path}.mp3
├── sheet-music/
│   ├── {original-path}.png
│   └── {original-path}.pdf
└── event-covers/
    └── {original-path}.jpg
```

---

## Detalhes Técnicos

### Manifest.json
```json
{
  "version": "1.0",
  "exportedAt": "2025-01-29T12:00:00Z",
  "sourceTenantId": "uuid",
  "sourceTenantSlug": "coral-exemplo",
  "stats": {
    "songs": 50,
    "songAudios": 200,
    "events": 20,
    "files": 250
  },
  "fileMapping": {
    "audio-files/abc123.mp3": "song_audios.id:xyz789",
    "sheet-music/def456.png": "songs.id:uvw123"
  }
}
```

### Edge Function: export-full-backup
1. Valida autenticação (super_admin)
2. Busca todos os registros das tabelas relevantes
3. Extrai URLs de arquivos dos registros
4. Retorna JSON com dados e lista de arquivos

### Frontend Export
1. Chama edge function para obter dados
2. Usa `fetch` para baixar cada arquivo
3. Usa `JSZip` (já instalado) para criar o ZIP
4. Oferece download ao usuário

### Edge Function: import-backup
1. Valida autenticação (super_admin)
2. Recebe dados com mapeamento de novos URLs
3. Insere registros mantendo relações (usa mapping de IDs)
4. Retorna estatísticas de importação

### Frontend Import
1. Usuário faz upload do ZIP
2. Extrai e processa manifest.json
3. Upload de arquivos para buckets (com novos paths)
4. Chama edge function com dados atualizados
5. Exibe resultado

---

## Considerações de Segurança

- Apenas **super_admin** pode exportar/importar
- Validação de tamanho máximo do ZIP (ex: 500MB)
- Arquivos são validados por tipo MIME
- IDs originais são preservados no manifest mas novos UUIDs são gerados na importação
- Transação atômica na importação (rollback em caso de erro)

---

## Limitações

1. **Usuários/Auth**: Contas de usuário NÃO são copiadas (auth.users é gerenciado pelo Supabase)
2. **Perfis**: profiles são copiados mas precisam ser reassociados a novos usuários
3. **Tamanho**: Para backups muito grandes, pode ser necessário exportar por tenant
4. **Tempo**: Exportação/importação de muitos arquivos pode demorar

---

## Fluxo de Uso

### Para fazer o remix com dados:

1. **No projeto original**:
   - Acesse `/admin/backup`
   - Clique em "Exportar Backup Completo"
   - Aguarde o download do ZIP

2. **Faça o remix normalmente no Lovable**

3. **No projeto novo (remix)**:
   - Configure as credenciais do Lovable Cloud
   - Acesse `/admin/restore`
   - Faça upload do arquivo ZIP
   - Aguarde a importação
   - Pronto! Todos os dados e arquivos estão no novo projeto

