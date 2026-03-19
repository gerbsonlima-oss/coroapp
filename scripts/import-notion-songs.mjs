#!/usr/bin/env node
import process from 'node:process';

const requiredEnv = [
  'NOTION_TOKEN',
  'NOTION_DATABASE_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_TENANT_ID',
];

const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(`Missing env vars: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const config = {
  notionToken: process.env.NOTION_TOKEN,
  notionDatabaseId: extractNotionDatabaseId(process.env.NOTION_DATABASE_ID),
  notionVersion: process.env.NOTION_VERSION || '2022-06-28',
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  tenantId: process.env.SUPABASE_TENANT_ID,
  dryRun: process.argv.includes('--dry-run'),
  updateExisting: process.argv.includes('--update-existing'),
  includePageContent: process.argv.includes('--include-page-content'),
  notionProps: {
    title: process.env.NOTION_TITLE_PROP || 'Nome',
    type: process.env.NOTION_TYPE_PROP || 'Tipo',
    lyrics: process.env.NOTION_LYRICS_PROP || 'Letra',
    chords: process.env.NOTION_CHORDS_PROP || 'Cifra',
    notes: process.env.NOTION_NOTES_PROP || 'Observacoes',
    public: process.env.NOTION_PUBLIC_PROP || 'Publica',
    audios: process.env.NOTION_AUDIO_PROP || 'Audios',
  },
  defaultSongType: process.env.DEFAULT_SONG_TYPE_SLUG || 'outro',
};

const notionHeaders = {
  Authorization: `Bearer ${config.notionToken}`,
  'Notion-Version': config.notionVersion,
  'Content-Type': 'application/json',
};

const supabaseHeaders = {
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

function richTextToPlain(richText = []) {
  return richText.map((item) => item.plain_text || '').join('');
}

function propertyToText(property) {
  if (!property) return '';
  switch (property.type) {
    case 'title':
      return richTextToPlain(property.title);
    case 'rich_text':
      return richTextToPlain(property.rich_text);
    case 'select':
      return property.select?.name || '';
    case 'multi_select':
      return (property.multi_select || []).map((x) => x.name).join(', ');
    case 'status':
      return property.status?.name || '';
    case 'url':
      return property.url || '';
    case 'email':
      return property.email || '';
    case 'phone_number':
      return property.phone_number || '';
    case 'number':
      return property.number != null ? String(property.number) : '';
    case 'checkbox':
      return property.checkbox ? 'true' : 'false';
    default:
      return '';
  }
}

function propertyToBoolean(property) {
  if (!property) return null;
  if (property.type === 'checkbox') return !!property.checkbox;
  const text = propertyToText(property).toLowerCase().trim();
  if (['1', 'true', 'sim', 'yes'].includes(text)) return true;
  if (['0', 'false', 'nao', 'não', 'no'].includes(text)) return false;
  return null;
}

function normalizeTypeSlug(raw) {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFileName(fileName) {
  return (fileName || 'audio.mp3')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractNotionDatabaseId(value) {
  if (!value) return value;
  const clean = value.trim();
  if (clean.includes('notion.so')) {
    const noQuery = clean.split('?')[0];
    const id = noQuery.split('/').pop() || '';
    return id.replace(/-/g, '');
  }
  return clean.replace(/-/g, '');
}

function inferNaipe(text) {
  const base = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/(^|[^a-z])(soprano|sopranos)([^a-z]|$)/.test(base)) return 'soprano';
  if (/(^|[^a-z])(contralto|contraltos|alto)([^a-z]|$)/.test(base)) return 'contralto';
  if (/(^|[^a-z])(tenor|tenores)([^a-z]|$)/.test(base)) return 'tenor';
  if (/(^|[^a-z])(baixo|bass)([^a-z]|$)/.test(base)) return 'baixo';
  if (/(^|[^a-z])(unissono|unisono|original|todos|coro)([^a-z]|$)/.test(base)) return 'unissono';
  return 'unissono';
}

async function notionFetch(path, body) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'POST',
    headers: notionHeaders,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Notion ${path} failed: ${response.status} ${message}`);
  }
  return response.json();
}

async function notionFetchGet(path) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method: 'GET',
    headers: notionHeaders,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Notion ${path} failed: ${response.status} ${message}`);
  }
  return response.json();
}

async function fetchNotionPages() {
  const pages = [];
  let cursor = undefined;

  while (true) {
    const payload = {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };

    const data = await notionFetch(`/databases/${config.notionDatabaseId}/query`, payload);
    pages.push(...(data.results || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  return pages;
}

function blockToLine(block) {
  switch (block.type) {
    case 'paragraph':
      return richTextToPlain(block.paragraph.rich_text);
    case 'heading_1':
      return `# ${richTextToPlain(block.heading_1.rich_text)}`;
    case 'heading_2':
      return `## ${richTextToPlain(block.heading_2.rich_text)}`;
    case 'heading_3':
      return `### ${richTextToPlain(block.heading_3.rich_text)}`;
    case 'bulleted_list_item':
      return `- ${richTextToPlain(block.bulleted_list_item.rich_text)}`;
    case 'numbered_list_item':
      return `1. ${richTextToPlain(block.numbered_list_item.rich_text)}`;
    case 'quote':
      return `> ${richTextToPlain(block.quote.rich_text)}`;
    case 'code':
      return richTextToPlain(block.code.rich_text);
    case 'to_do':
      return `${block.to_do.checked ? '[x]' : '[ ]'} ${richTextToPlain(block.to_do.rich_text)}`;
    case 'divider':
      return '---';
    default:
      return '';
  }
}

async function fetchBlockChildren(blockId) {
  const rows = [];
  let cursor = undefined;
  while (true) {
    const query = new URLSearchParams({
      page_size: '100',
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const data = await notionFetchGet(`/blocks/${blockId}/children?${query.toString()}`);
    const blocks = data.results || [];
    for (const block of blocks) {
      const line = blockToLine(block);
      if (line) rows.push(line);
      if (block.has_children) {
        const nested = await fetchBlockChildren(block.id);
        if (nested) rows.push(nested);
      }
    }
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return rows.join('\n').trim();
}

async function fetchPageAudioFiles(blockId) {
  const files = [];
  let cursor = undefined;
  while (true) {
    const query = new URLSearchParams({
      page_size: '100',
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const data = await notionFetchGet(`/blocks/${blockId}/children?${query.toString()}`);
    const blocks = data.results || [];
    for (const block of blocks) {
      if (block.type === 'audio') {
        const info = block.audio;
        const url =
          info?.type === 'file' ? info.file?.url : info?.type === 'external' ? info.external?.url : null;
        if (url) {
          files.push({
            url,
            name: info?.caption?.length ? richTextToPlain(info.caption) : `audio-${block.id}.mp3`,
          });
        }
      }
      if (block.type === 'file') {
        const info = block.file;
        const url =
          info?.type === 'file' ? info.file?.url : info?.type === 'external' ? info.external?.url : null;
        if (url) {
          files.push({
            url,
            name: info?.caption?.length ? richTextToPlain(info.caption) : `arquivo-${block.id}`,
          });
        }
      }
      if (block.has_children) {
        const nested = await fetchPageAudioFiles(block.id);
        files.push(...nested);
      }
    }
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return files;
}

async function fetchSongTypes() {
  const url = new URL('/rest/v1/song_types', config.supabaseUrl);
  url.searchParams.set('tenant_id', `eq.${config.tenantId}`);
  url.searchParams.set('select', 'slug');
  url.searchParams.set('limit', '1000');

  const response = await fetch(url, {
    headers: supabaseHeaders,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase song_types fetch failed: ${response.status} ${message}`);
  }
  const rows = await response.json();
  return new Set(rows.map((x) => x.slug));
}

async function findSongByName(name) {
  const url = new URL('/rest/v1/songs', config.supabaseUrl);
  url.searchParams.set('tenant_id', `eq.${config.tenantId}`);
  url.searchParams.set('name', `eq.${name}`);
  url.searchParams.set('select', 'id,name');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { headers: supabaseHeaders });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase songs lookup failed: ${response.status} ${message}`);
  }
  const rows = await response.json();
  return rows[0] || null;
}

async function getSongAudios(songId) {
  const url = new URL('/rest/v1/song_audios', config.supabaseUrl);
  url.searchParams.set('song_id', `eq.${songId}`);
  url.searchParams.set('select', 'id,name,naipe,audio_url');
  url.searchParams.set('limit', '1000');

  const response = await fetch(url, { headers: supabaseHeaders });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase song_audios lookup failed: ${response.status} ${message}`);
  }
  return response.json();
}

async function insertSong(song) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/songs`, {
    method: 'POST',
    headers: { ...supabaseHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(song),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase insert failed: ${response.status} ${message}`);
  }
  const data = await response.json();
  return data[0];
}

async function updateSong(id, song) {
  const url = new URL('/rest/v1/songs', config.supabaseUrl);
  url.searchParams.set('id', `eq.${id}`);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { ...supabaseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(song),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase update failed: ${response.status} ${message}`);
  }
}

async function insertSongAudio(audio) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/song_audios`, {
    method: 'POST',
    headers: { ...supabaseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(audio),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase song_audios insert failed: ${response.status} ${message}`);
  }
}

function getPublicStorageUrl(bucket, path) {
  const base = config.supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

async function uploadToAudioBucket(buffer, path, contentType) {
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/audio-files/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      'Content-Type': contentType || 'audio/mpeg',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Storage upload failed: ${response.status} ${message}`);
  }
}

async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`File download failed: ${response.status} ${message}`);
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

function getPropertyFiles(page) {
  const files = [];
  const props = page.properties || {};
  const direct = props[config.notionProps.audios];
  if (direct?.type === 'files') {
    files.push(...(direct.files || []));
  }

  if (files.length > 0) return files;

  for (const prop of Object.values(props)) {
    if (prop?.type === 'files') {
      files.push(...(prop.files || []));
    }
  }
  return files;
}

function toNotionFileRef(file) {
  const url =
    file?.type === 'file'
      ? file.file?.url
      : file?.type === 'external'
        ? file.external?.url
        : null;
  if (!url) return null;

  const name = file.name || `audio-${Date.now()}.mp3`;
  return { url, name };
}

async function upsertSongAudios(songRow, page) {
  const propertyFiles = getPropertyFiles(page)
    .map(toNotionFileRef)
    .filter(Boolean);
  const blockFiles = await fetchPageAudioFiles(page.id);
  const allFiles = [...propertyFiles, ...blockFiles];

  if (allFiles.length === 0) return { uploaded: 0, skipped: 0 };

  const existing = await getSongAudios(songRow.id);
  const existingByName = new Set(existing.map((x) => `${x.name}|${x.naipe}`));

  let uploaded = 0;
  let skipped = 0;

  for (const file of allFiles) {
    const cleanName = sanitizeFileName(file.name);
    const naipe = inferNaipe(cleanName);
    const label = cleanName.replace(/\.[^/.]+$/, '');
    const key = `${label}|${naipe}`;

    if (existingByName.has(key) && !config.updateExisting) {
      skipped++;
      continue;
    }

    const { buffer, contentType } = await downloadFile(file.url);
    const storagePath = `${config.tenantId}/${songRow.id}/${Date.now()}_${cleanName}`;
    await uploadToAudioBucket(buffer, storagePath, contentType);
    const audioUrl = getPublicStorageUrl('audio-files', storagePath);

    if (!config.dryRun) {
      await insertSongAudio({
        song_id: songRow.id,
        tenant_id: config.tenantId,
        name: label,
        naipe,
        audio_url: audioUrl,
      });
    }

    uploaded++;
  }

  return { uploaded, skipped };
}

function toSongPayload(page, validTypeSlugs, fallbackLyrics = '') {
  const props = page.properties || {};
  const name = propertyToText(props[config.notionProps.title]).trim();
  const typeRaw = propertyToText(props[config.notionProps.type]).trim();
  const lyrics = propertyToText(props[config.notionProps.lyrics]).trim() || fallbackLyrics || null;
  const chords = propertyToText(props[config.notionProps.chords]).trim() || null;
  const notes = propertyToText(props[config.notionProps.notes]).trim() || null;
  const isPublic = propertyToBoolean(props[config.notionProps.public]);

  if (!name) return null;

  let type = normalizeTypeSlug(typeRaw);
  if (!type || !validTypeSlugs.has(type)) {
    type = config.defaultSongType;
  }

  return {
    name,
    type,
    lyrics,
    chords,
    notes,
    is_public: isPublic ?? true,
    tenant_id: config.tenantId,
  };
}

async function main() {
  console.log('Fetching song_types...');
  const validTypeSlugs = await fetchSongTypes();
  if (!validTypeSlugs.has(config.defaultSongType)) {
    throw new Error(
      `Default type '${config.defaultSongType}' not found in song_types for tenant ${config.tenantId}`,
    );
  }

  console.log('Fetching pages from Notion...');
  const pages = await fetchNotionPages();
  console.log(`Found ${pages.length} page(s).`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let audioUploaded = 0;
  let audioSkipped = 0;
  const errors = [];

  for (const page of pages) {
    try {
      const fallbackLyrics = config.includePageContent ? await fetchBlockChildren(page.id) : '';
      const song = toSongPayload(page, validTypeSlugs, fallbackLyrics);
      if (!song) {
        skipped++;
        continue;
      }

      const existing = await findSongByName(song.name);
      let songRow = existing;

      if (config.dryRun) {
        console.log(`[DRY-RUN] ${existing ? 'EXISTS' : 'NEW'}: ${song.name} (${song.type})`);
      }

      if (!config.dryRun && existing && config.updateExisting) {
        await updateSong(existing.id, {
          type: song.type,
          lyrics: song.lyrics,
          chords: song.chords,
          notes: song.notes,
          is_public: song.is_public,
          updated_at: new Date().toISOString(),
        });
        updated++;
      } else if (!config.dryRun && existing) {
        skipped++;
      } else if (!config.dryRun) {
        songRow = await insertSong(song);
        inserted++;
      }

      if (songRow) {
        const audioResult = await upsertSongAudios(songRow, page);
        audioUploaded += audioResult.uploaded;
        audioSkipped += audioResult.skipped;
      }
    } catch (error) {
      errors.push({ pageId: page.id, error: error.message || String(error) });
    }
  }

  console.log('---');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Audio uploaded: ${audioUploaded}`);
  console.log(`Audio skipped: ${audioSkipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`- ${e.pageId}: ${e.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
