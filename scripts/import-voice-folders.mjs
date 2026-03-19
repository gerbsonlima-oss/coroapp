#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.mpeg', '.ogg', '.m4a', '.wav', '.aac', '.flac', '.wma']);
const VOICE_DIR_TO_NAIPE = {
  SOPRANOS: 'soprano',
  CONTRALTOS: 'contralto',
  TENORES: 'tenor',
  BAIXOS: 'baixo',
};

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
    .trim();
}

function slugify(text) {
  return normalizeText(text).replace(/\s+/g, '-');
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
    const parts = (token || '').split('.');
    if (parts.length < 2) return '';
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload?.sub || '';
  } catch {
    return '';
  }
}

function titleCase(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function canonicalSongName(name) {
  const n = normalizeText(name);
  if (n.startsWith('gloria')) return 'Glória';
  if (n.includes('hino') && n.includes('jubileu')) return 'Hino do Jubileu';
  if (n.includes('ecce') || n.includes('eccesacerdos') || n.includes('sacerdos')) return 'Ecce Sacerdos';
  if (n.startsWith('amem')) return 'Amém';
  if (n.startsWith('salmo')) return 'Salmo';
  return name;
}

function cleanupSongNameFromFile(stem) {
  let s = stem;
  s = s.replace(/[_-]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\b(ESTROFES?|REFRAO|REFR[AÃ]O|FINAL|TODOS|COMPLETO|SOLO|RESPOSTA|PRONUNCIA)\b/gi, '');
  s = s.replace(
    /\b(SOPRANOS?|SOPANO|CONTRALTOS?|TENOR(?:ES)?|BAIXOS?|SOPR[_\s-]*TENOR|CONT[_\s-]*BAIXO|CONTRALTOS?[_\s-]*BAIXOS?|BAIXOE?TENOR)\b/gi,
    '',
  );
  s = s.replace(/\bPRECEORD\b/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  return canonicalSongName(titleCase(s || stem));
}

function inferNaipe(fileName, folderNaipe) {
  const t = normalizeText(fileName);
  if (/\b(soprano|sopranos)\b/.test(t)) return 'soprano';
  if (/\b(contralto|contraltos|alto)\b/.test(t)) return 'contralto';
  if (/\b(tenor|tenores)\b/.test(t)) return 'tenor';
  if (/\b(baixo|baixos|bass)\b/.test(t)) return 'baixo';
  if (/\b(todos|completo|pronuncia|solo|resposta)\b/.test(t)) return 'todos';
  return folderNaipe || 'todos';
}

function mapTypeSlug(name, allowed) {
  const n = normalizeText(name);
  const pick = (slug, fallback = 'final') => (allowed.has(slug) ? slug : allowed.has(fallback) ? fallback : [...allowed][0]);
  if (n.includes('aleluia')) return pick('aclamacao');
  if (n.includes('kyrie')) return pick('ato_penitencial');
  if (n.includes('gloria')) return pick('gloria');
  if (n.includes('santo')) return pick('santo');
  if (n.includes('cordeiro')) return pick('cordeiro');
  if (n.includes('salmo')) return pick('salmo');
  if (n.includes('amem')) return pick('amem', 'final');
  if (n.includes('ofert')) return pick('oferendas');
  if (n.includes('comunh')) return pick('comunhao');
  if (n.includes('entrada')) return pick('antifona_entrada', 'canto_entrada');
  return pick('final');
}

function similarity(a, b) {
  const sa = new Set(normalizeText(a).split(' ').filter(Boolean));
  const sb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

async function listFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => path.join(dirPath, e.name));
}

async function readVoiceDataset(sourceDir) {
  const songs = new Map();
  const partituraDir = path.join(sourceDir, 'PARTITURAS');
  const partituraFiles = (await fs.readdir(partituraDir, { withFileTypes: true }).catch(() => []))
    .filter((e) => e.isFile() && path.extname(e.name).toLowerCase() === '.pdf')
    .map((e) => path.join(partituraDir, e.name));

  for (const [folderName, naipe] of Object.entries(VOICE_DIR_TO_NAIPE)) {
    const folder = path.join(sourceDir, folderName);
    const files = (await listFiles(folder).catch(() => [])).filter((f) =>
      AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()),
    );

    for (const file of files) {
      const base = path.basename(file);
      const stem = path.basename(file, path.extname(file));
      const songName = cleanupSongNameFromFile(stem);
      const key = slugify(songName);
      if (!songs.has(key)) {
        songs.set(key, { key, name: songName, audios: [], partitura: null });
      }
      songs.get(key).audios.push({
        filePath: file,
        name: sanitizeFileName(stem),
        naipe: inferNaipe(base, naipe),
      });
    }
  }

  for (const song of songs.values()) {
    let best = null;
    let score = 0;
    for (const pdf of partituraFiles) {
      const pdfStem = path.basename(pdf, '.pdf').replace(/^\d+(\.\d+)?\s*/, '');
      const s = similarity(song.name, pdfStem);
      if (s > score) {
        score = s;
        best = pdf;
      }
    }
    if (best && score >= 0.25) song.partitura = best;
  }

  return [...songs.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchSongTypes({ supabaseUrl, apiKey, authToken, tenantId }) {
  const url = new URL('/rest/v1/song_types', supabaseUrl);
  url.searchParams.set('select', 'slug,name,order_index,tenant_id');
  url.searchParams.set('or', `(tenant_id.is.null,tenant_id.eq.${tenantId})`);
  url.searchParams.set('order', 'order_index');
  return fetchJson(url, { apikey: apiKey, Authorization: `Bearer ${authToken}` });
}

async function fetchSongs({ supabaseUrl, apiKey, authToken, tenantId }) {
  const url = new URL('/rest/v1/songs', supabaseUrl);
  url.searchParams.set('select', 'id,name,type');
  url.searchParams.set('tenant_id', `eq.${tenantId}`);
  url.searchParams.set('limit', '10000');
  return fetchJson(url, { apikey: apiKey, Authorization: `Bearer ${authToken}` });
}

async function fetchSongAudios({ supabaseUrl, apiKey, authToken, songId }) {
  const url = new URL('/rest/v1/song_audios', supabaseUrl);
  url.searchParams.set('select', 'id,name,naipe');
  url.searchParams.set('song_id', `eq.${songId}`);
  url.searchParams.set('limit', '10000');
  return fetchJson(url, { apikey: apiKey, Authorization: `Bearer ${authToken}` });
}

async function insertSong({ supabaseUrl, apiKey, authToken, payload }) {
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
  if (!res.ok) throw new Error(`songs insert failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function updateSong({ supabaseUrl, apiKey, authToken, songId, payload }) {
  const url = new URL('/rest/v1/songs', supabaseUrl);
  url.searchParams.set('id', `eq.${songId}`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`songs update failed: ${res.status} ${await res.text()}`);
}

async function insertSongAudio({ supabaseUrl, apiKey, authToken, payload }) {
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
  if (!res.ok) throw new Error(`song_audios insert failed: ${res.status} ${await res.text()}`);
}

async function uploadToBucket({ supabaseUrl, apiKey, authToken, bucket, storagePath, filePath }) {
  const content = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp3'
      ? 'audio/mpeg'
      : ext === '.mpeg'
        ? 'audio/mpeg'
        : ext === '.m4a'
          ? 'audio/mp4'
          : ext === '.ogg'
            ? 'audio/ogg'
            : ext === '.pdf'
              ? 'application/pdf'
              : 'application/octet-stream';

  const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: content,
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status} ${await res.text()}`);
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${storagePath}`;
}

async function main() {
  const sourceDir = argValue('--source-dir');
  const dryRun = process.argv.includes('--dry-run');
  const updateExisting = process.argv.includes('--update-existing');
  if (!sourceDir) {
    throw new Error('Use --source-dir "<pasta>"');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const authToken = process.env.SUPABASE_AUTH_TOKEN || apiKey;
  const tenantId = process.env.SUPABASE_TENANT_ID;
  if (!supabaseUrl || !apiKey || !authToken || !tenantId) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY(or service key) / SUPABASE_AUTH_TOKEN / SUPABASE_TENANT_ID');
  }

  const storageOwnerId = process.env.SUPABASE_STORAGE_OWNER_ID || parseJwtSub(authToken) || tenantId;
  const dataset = await readVoiceDataset(sourceDir);
  const datasetAudioTotal = dataset.reduce((sum, s) => sum + s.audios.length, 0);
  console.log(`Detected songs: ${dataset.length} | Detected audios: ${datasetAudioTotal}`);
  const songTypes = await fetchSongTypes({ supabaseUrl, apiKey, authToken, tenantId });
  const allowedTypes = new Set(songTypes.map((x) => x.slug));

  const existingSongs = await fetchSongs({ supabaseUrl, apiKey, authToken, tenantId });
  const songByNorm = new Map(existingSongs.map((s) => [normalizeText(s.name), s]));

  let inserted = 0;
  let updated = 0;
  let audiosInserted = 0;
  let partiturasUploaded = 0;
  const errors = [];

  for (const item of dataset) {
    try {
      const type = mapTypeSlug(item.name, allowedTypes);
      const existing = songByNorm.get(normalizeText(item.name));
      let song = existing || null;

      if (dryRun) {
        console.log(`[DRY-RUN] ${song ? 'EXISTS' : 'NEW'}: ${item.name} | type=${type} | audios=${item.audios.length} | pdf=${item.partitura ? 1 : 0}`);
      } else if (!song) {
        song = await insertSong({
          supabaseUrl,
          apiKey,
          authToken,
          payload: {
            name: item.name,
            type,
            tenant_id: tenantId,
            is_public: true,
          },
        });
        inserted++;
      } else if (updateExisting) {
        await updateSong({
          supabaseUrl,
          apiKey,
          authToken,
          songId: song.id,
          payload: { type, updated_at: new Date().toISOString() },
        });
        updated++;
      }

      if (!song || dryRun) continue;

      if (item.partitura) {
        const pdfName = sanitizeFileName(path.basename(item.partitura));
        const storagePath = `${storageOwnerId}/${song.id}/pdf_${Date.now()}_${pdfName}`;
        const pdfUrl = await uploadToBucket({
          supabaseUrl,
          apiKey,
          authToken,
          bucket: 'sheet-music',
          storagePath,
          filePath: item.partitura,
        });
        await updateSong({
          supabaseUrl,
          apiKey,
          authToken,
          songId: song.id,
          payload: {
            sheet_music_pdf_url: pdfUrl,
            updated_at: new Date().toISOString(),
          },
        });
        partiturasUploaded++;
      }

      const existingAudios = await fetchSongAudios({ supabaseUrl, apiKey, authToken, songId: song.id });
      const existingKeys = new Set(existingAudios.map((a) => `${(a.name || '').toLowerCase()}|${a.naipe}`));
      for (const audio of item.audios) {
        const key = `${audio.name.toLowerCase()}|${audio.naipe}`;
        if (existingKeys.has(key)) continue;
        const fileName = sanitizeFileName(path.basename(audio.filePath));
        const storagePath = `${storageOwnerId}/${song.id}/${Date.now()}_${fileName}`;
        const audioUrl = await uploadToBucket({
          supabaseUrl,
          apiKey,
          authToken,
          bucket: 'audio-files',
          storagePath,
          filePath: audio.filePath,
        });
        await insertSongAudio({
          supabaseUrl,
          apiKey,
          authToken,
          payload: {
            song_id: song.id,
            tenant_id: tenantId,
            name: audio.name,
            naipe: audio.naipe,
            audio_url: audioUrl,
          },
        });
        audiosInserted++;
      }
    } catch (e) {
      errors.push(`${item.name}: ${e.message || String(e)}`);
    }
  }

  console.log('---');
  console.log(`Songs parsed: ${dataset.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Audios inserted: ${audiosInserted}`);
  console.log(`Partituras uploaded: ${partiturasUploaded}`);
  console.log(`Errors: ${errors.length}`);
  for (const err of errors.slice(0, 50)) console.log(`- ${err}`);
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
