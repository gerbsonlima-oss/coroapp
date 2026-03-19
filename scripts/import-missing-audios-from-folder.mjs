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

function similarity(a, b) {
  const sa = new Set(normalizeText(a).split(' ').filter(Boolean));
  const sb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
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
  return 'todos';
}

function sanitizeFileName(fileName) {
  return (fileName || 'file.bin')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseJwtSub(token) {
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return p?.sub || '';
  } catch {
    return '';
  }
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

async function fetchAll({ supabaseUrl, apiKey, authToken, tenantId, table, select }) {
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
      headers: { apikey: apiKey, Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`${table} fetch failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return out;
}

async function createSong({ supabaseUrl, apiKey, authToken, payload }) {
  const res = await fetch(`${supabaseUrl}/rest/v1/songs`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`song create failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function insertAudio({ supabaseUrl, apiKey, authToken, payload }) {
  const res = await fetch(`${supabaseUrl}/rest/v1/song_audios`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`audio insert failed: ${res.status} ${await res.text()}`);
}

async function uploadAudio({ supabaseUrl, apiKey, authToken, storagePath, filePath }) {
  const bytes = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp3'
      ? 'audio/mpeg'
      : ext === '.m4a'
        ? 'audio/mp4'
        : ext === '.ogg'
          ? 'audio/ogg'
          : ext === '.wav'
            ? 'audio/wav'
            : 'application/octet-stream';
  const res = await fetch(`${supabaseUrl}/storage/v1/object/audio-files/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status} ${await res.text()}`);
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/audio-files/${storagePath}`;
}

function resolveSong(name, songs) {
  const exact = songs.find((s) => compact(s.name) === compact(name));
  if (exact) return exact;
  let best = null;
  let score = 0;
  for (const s of songs) {
    const sc = similarity(name, s.name);
    if (sc > score) {
      score = sc;
      best = s;
    }
  }
  return score >= 0.55 ? best : null;
}

async function main() {
  const sourceDir = argValue('--source-dir');
  const supabaseUrl = argValue('--supabase-url', process.env.SUPABASE_URL || '');
  const apiKey = argValue('--anon-key', process.env.SUPABASE_ANON_KEY || '');
  const authToken = argValue('--auth-token', process.env.SUPABASE_AUTH_TOKEN || '');
  const tenantId = argValue('--tenant-id', process.env.SUPABASE_TENANT_ID || '');
  const dryRun = process.argv.includes('--dry-run');
  const createMissingSongs = process.argv.includes('--create-missing-songs');

  if (!sourceDir) throw new Error('Missing --source-dir');
  if (!supabaseUrl) throw new Error('Missing --supabase-url');
  if (!apiKey) throw new Error('Missing --anon-key');
  if (!authToken) throw new Error('Missing --auth-token');
  if (!tenantId) throw new Error('Missing --tenant-id');

  const ownerId = parseJwtSub(authToken);
  const songs = await fetchAll({ supabaseUrl, apiKey, authToken, tenantId, table: 'songs', select: 'id,name,type' });
  const audios = await fetchAll({
    supabaseUrl,
    apiKey,
    authToken,
    tenantId,
    table: 'song_audios',
    select: 'id,song_id,name,naipe,audio_url',
  });

  const audiosBySong = new Map();
  for (const a of audios) {
    if (!audiosBySong.has(a.song_id)) audiosBySong.set(a.song_id, []);
    audiosBySong.get(a.song_id).push(a);
  }

  const dirs = (await fs.readdir(sourceDir, { withFileTypes: true })).filter((d) => d.isDirectory());

  let createdSongs = 0;
  let insertedAudios = 0;
  let unresolvedDirs = 0;

  for (const d of dirs) {
    const folderSongName = stripNotionIdSuffix(d.name);
    let song = resolveSong(folderSongName, songs);
    if (!song && createMissingSongs) {
      if (!dryRun) {
        song = await createSong({
          supabaseUrl,
          apiKey,
          authToken,
          payload: {
            name: folderSongName,
            type: 'outro',
            tenant_id: tenantId,
            user_id: ownerId || null,
          },
        });
        songs.push(song);
        audiosBySong.set(song.id, []);
      } else {
        song = { id: `DRY-${d.name}`, name: folderSongName, type: 'outro' };
      }
      createdSongs += 1;
    }
    if (!song) {
      unresolvedDirs += 1;
      continue;
    }

    const files = await fs.readdir(path.join(sourceDir, d.name), { withFileTypes: true });
    const audioFiles = files.filter((f) => f.isFile() && AUDIO_EXTENSIONS.has(path.extname(f.name).toLowerCase()));
    for (const af of audioFiles) {
      const naipe = inferNaipe(af.name);
      const core = fileCoreFromName(af.name);
      const existing = (audiosBySong.get(song.id) || []).some(
        (x) => normalizeText(x.naipe) === normalizeText(naipe) && fileCoreFromUrl(x.audio_url) === core,
      );
      if (existing) continue;

      if (!dryRun) {
        const safe = sanitizeFileName(af.name);
        const storagePath = `${ownerId || tenantId}/${song.id}/${Date.now()}_${safe}`;
        const audioUrl = await uploadAudio({
          supabaseUrl,
          apiKey,
          authToken,
          storagePath,
          filePath: path.join(sourceDir, d.name, af.name),
        });
        await insertAudio({
          supabaseUrl,
          apiKey,
          authToken,
          payload: {
            song_id: song.id,
            tenant_id: tenantId,
            naipe,
            name: path.basename(af.name, path.extname(af.name)),
            audio_url: audioUrl,
          },
        });
        const arr = audiosBySong.get(song.id) || [];
        arr.push({ song_id: song.id, naipe, audio_url: audioUrl, name: af.name });
        audiosBySong.set(song.id, arr);
      }
      insertedAudios += 1;
    }
  }

  console.log(`CREATED_SONGS=${createdSongs}`);
  console.log(`INSERTED_AUDIOS=${insertedAudios}`);
  console.log(`UNRESOLVED_DIRS=${unresolvedDirs}`);
  console.log(`MODE=${dryRun ? 'dry-run' : 'execute'}`);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

