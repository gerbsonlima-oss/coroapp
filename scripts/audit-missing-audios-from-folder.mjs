#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.aac', '.flac', '.wma']);

function argValue(name, fallback = '') {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] || fallback;
}

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(text) {
  return normalizeText(text).replace(/\s+/g, '');
}

function stripNotionIdSuffix(name) {
  return (name || '').replace(/\s[0-9a-f]{32}$/i, '').trim();
}

function inferNaipe(text) {
  const base = normalizeText(text);
  if (/(^|[^a-z])(soprano|sopranos)([^a-z]|$)/.test(base)) return 'soprano';
  if (/(^|[^a-z])(contralto|contraltos|alto)([^a-z]|$)/.test(base)) return 'contralto';
  if (/(^|[^a-z])(tenor|tenores)([^a-z]|$)/.test(base)) return 'tenor';
  if (/(^|[^a-z])(baixo|baixos|bass)([^a-z]|$)/.test(base)) return 'baixo';
  if (/(^|[^a-z])(unissono|unisono|original|coro)([^a-z]|$)/.test(base)) return 'unissono';
  if (/(^|[^a-z])(outros|outro|misc|varios|vocal)([^a-z]|$)/.test(base)) return 'todos';
  return 'todos';
}

function fileCoreFromName(fileName) {
  return compact(path.basename(fileName, path.extname(fileName)).replace(/^\d{10,}_/, ''));
}

function fileCoreFromUrl(url) {
  const raw = (url || '').split('/').pop() || '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {}
  return fileCoreFromName(decoded);
}

async function fetchAll({ supabaseUrl, apiKey, tenantId, table, select }) {
  const out = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const url = new URL(`/rest/v1/${table}`, supabaseUrl);
    url.searchParams.set('select', select);
    url.searchParams.set('tenant_id', `eq.${tenantId}`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    const res = await fetch(url, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`${table} fetch failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return out;
}

async function main() {
  const sourceDir = argValue('--source-dir');
  const supabaseUrl = argValue('--supabase-url', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '');
  const apiKey = argValue('--anon-key', process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  const tenantId = argValue('--tenant-id', process.env.SUPABASE_TENANT_ID || process.env.TENANT_ID || '');

  if (!sourceDir) throw new Error('Missing --source-dir');
  if (!supabaseUrl) throw new Error('Missing --supabase-url');
  if (!apiKey) throw new Error('Missing --anon-key');
  if (!tenantId) throw new Error('Missing --tenant-id');

  const [songs, audios] = await Promise.all([
    fetchAll({ supabaseUrl, apiKey, tenantId, table: 'songs', select: 'id,name' }),
    fetchAll({ supabaseUrl, apiKey, tenantId, table: 'song_audios', select: 'id,song_id,name,naipe,audio_url' }),
  ]);

  const songByName = new Map(songs.map((s) => [compact(s.name), s]));
  const audiosBySong = new Map();
  for (const a of audios) {
    if (!audiosBySong.has(a.song_id)) audiosBySong.set(a.song_id, []);
    audiosBySong.get(a.song_id).push(a);
  }

  const dirEntries = await fs.readdir(sourceDir, { withFileTypes: true });
  const songDirs = dirEntries.filter((d) => d.isDirectory());

  let localAudioFiles = 0;
  let matchedSongDirs = 0;
  let unmatchedSongDirs = 0;
  let missingAudios = 0;

  const missingExamples = [];

  for (const d of songDirs) {
    const localSongName = stripNotionIdSuffix(d.name);
    const dbSong = songByName.get(compact(localSongName));
    if (!dbSong) {
      unmatchedSongDirs += 1;
      continue;
    }
    matchedSongDirs += 1;

    const files = await fs.readdir(path.join(sourceDir, d.name), { withFileTypes: true });
    const audioFiles = files
      .filter((f) => f.isFile() && AUDIO_EXTENSIONS.has(path.extname(f.name).toLowerCase()))
      .map((f) => f.name);
    localAudioFiles += audioFiles.length;

    const db = audiosBySong.get(dbSong.id) || [];
    for (const af of audioFiles) {
      const localNaipe = inferNaipe(af);
      const localCore = fileCoreFromName(af);
      const exists = db.some((x) => {
        const sameNaipe = normalizeText(x.naipe) === normalizeText(localNaipe);
        const sameCore = fileCoreFromUrl(x.audio_url) === localCore || compact(x.name) === localCore;
        return sameNaipe && sameCore;
      });
      if (!exists) {
        missingAudios += 1;
        if (missingExamples.length < 25) {
          missingExamples.push(`${localSongName} | ${af} | naipe=${localNaipe}`);
        }
      }
    }
  }

  console.log(`SONG_DIRS=${songDirs.length}`);
  console.log(`MATCHED_SONG_DIRS=${matchedSongDirs}`);
  console.log(`UNMATCHED_SONG_DIRS=${unmatchedSongDirs}`);
  console.log(`LOCAL_AUDIO_FILES=${localAudioFiles}`);
  console.log(`MISSING_AUDIO_FILES=${missingAudios}`);
  if (missingExamples.length) {
    console.log('MISSING_EXAMPLES:');
    for (const ex of missingExamples) console.log(`- ${ex}`);
  }
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

