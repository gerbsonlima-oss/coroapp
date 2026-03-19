#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.ogg', '.wav', '.aac', '.flac', '.wma']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const PDF_EXTENSIONS = new Set(['.pdf']);

function argValue(name, fallback = '') {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] || fallback;
}

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function stripNotionIdSuffix(name) {
  return (name || '').replace(/\s[0-9a-f]{32}$/i, '').trim();
}

function normalizeTypeSlug(raw) {
  return normalizeText(raw)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeFileName(fileName) {
  return (fileName || 'file.bin')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function inferNaipe(text) {
  const base = normalizeText(text);
  if (/(^|[^a-z])(soprano|sopranos)([^a-z]|$)/.test(base)) return 'soprano';
  if (/(^|[^a-z])(contralto|contraltos|alto)([^a-z]|$)/.test(base)) return 'contralto';
  if (/(^|[^a-z])(tenor|tenores)([^a-z]|$)/.test(base)) return 'tenor';
  if (/(^|[^a-z])(baixo|baixos|bass)([^a-z]|$)/.test(base)) return 'baixo';
  if (/(^|[^a-z])(unissono|unisono|original|coro)([^a-z]|$)/.test(base)) return 'unissono';
  if (/(^|[^a-z])(outros|outro|misc|varios|varios)([^a-z]|$)/.test(base)) return 'todos';
  return 'todos';
}

function inferNaipeFromFileAndLabel(fileName, label) {
  const byFile = inferNaipe(fileName);
  if (byFile !== 'unissono') return byFile;
  return inferNaipe(label || '');
}

function decodeLinkTarget(target) {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
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

async function readUtf8(filePath) {
  const buf = await fs.readFile(filePath);
  return buf.toString('utf8');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => path.join(dirPath, e.name));
}

function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const titleLine = lines.find((l) => l.trim().startsWith('# ')) || '';
  const title = titleLine.replace(/^#\s+/, '').trim();

  const tipoLine = lines.find((l) => /^tipo:/i.test(l.trim())) || '';
  const tipoRaw = tipoLine.replace(/^tipo:\s*/i, '').trim();

  const letrasStart = lines.findIndex((l) => /^##\s+letras/i.test(l.trim()));
  const lyrics =
    letrasStart >= 0
      ? lines
          .slice(letrasStart + 1)
          .join('\n')
          .trim() || null
      : null;

  const links = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m = re.exec(md);
  while (m) {
    links.push({
      label: m[1].trim(),
      target: decodeLinkTarget(m[2].trim()),
    });
    m = re.exec(md);
  }

  return { title, tipoRaw, lyrics, links };
}

async function fetchSongTypes({ supabaseUrl, apiKey, authToken, tenantId }) {
  const url = new URL('/rest/v1/song_types', supabaseUrl);
  url.searchParams.set('tenant_id', `eq.${tenantId}`);
  url.searchParams.set('select', 'slug,name,order_index');
  url.searchParams.set('order', 'order_index');
  url.searchParams.set('limit', '1000');

  const res = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!res.ok) throw new Error(`song_types failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows;
}

async function findSongByName({ supabaseUrl, apiKey, authToken, tenantId, name }) {
  const url = new URL('/rest/v1/songs', supabaseUrl);
  url.searchParams.set('tenant_id', `eq.${tenantId}`);
  url.searchParams.set('name', `eq.${name}`);
  url.searchParams.set('select', 'id,name');
  url.searchParams.set('limit', '1');
  const res = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!res.ok) throw new Error(`songs lookup failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
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

async function updateSong({ supabaseUrl, apiKey, authToken, id, payload }) {
  const url = new URL('/rest/v1/songs', supabaseUrl);
  url.searchParams.set('id', `eq.${id}`);
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

async function getSongAudios({ supabaseUrl, apiKey, authToken, songId }) {
  const url = new URL('/rest/v1/song_audios', supabaseUrl);
  url.searchParams.set('song_id', `eq.${songId}`);
  url.searchParams.set('select', 'id,name,naipe,audio_url');
  url.searchParams.set('limit', '1000');
  const res = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!res.ok) throw new Error(`song_audios lookup failed: ${res.status} ${await res.text()}`);
  return res.json();
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
      : ext === '.m4a'
        ? 'audio/mp4'
        : ext === '.ogg'
          ? 'audio/ogg'
          : ext === '.wav'
            ? 'audio/wav'
            : ext === '.pdf'
              ? 'application/pdf'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.png'
                  ? 'image/png'
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

function mapTypeSlug(tipoRaw, title, songTypes, defaultSlug) {
  const slugSet = new Set(songTypes.map((x) => x.slug));
  const nameToSlug = new Map(songTypes.map((x) => [normalizeTypeSlug(x.name), x.slug]));

  const alias = new Map([
    ['entrada', slugSet.has('canto_entrada') ? 'canto_entrada' : 'antifona_entrada'],
    ['antifona-entrada', 'antifona_entrada'],
    ['ofertorio', 'oferendas'],
    ['oferendas', 'oferendas'],
    ['aclamacao', 'aclamacao'],
    ['salmo', 'salmo'],
    ['gloria', 'gloria'],
    ['comunhao', 'comunhao'],
    ['cordeiro', 'cordeiro'],
    ['santo', 'santo'],
    ['amem', 'amem'],
    ['final', 'final'],
    ['ato-penitencial', 'ato_penitencial'],
    ['kyrie', 'ato_penitencial'],
    ['outros', 'final'],
    ['pai-nosso', 'acao_gracas'],
    ['pai-nosso-pai-nosso', 'acao_gracas'],
  ]);

  const candidates = [];
  if (tipoRaw) candidates.push(tipoRaw);
  const titlePrefix = (title || '').split('—')[0]?.trim();
  if (titlePrefix) candidates.push(titlePrefix);

  for (const raw of candidates) {
    const normalized = normalizeTypeSlug(raw);
    if (!normalized) continue;
    if (slugSet.has(normalized)) return normalized;
    if (nameToSlug.has(normalized)) return nameToSlug.get(normalized);
    if (alias.has(normalized)) {
      const mapped = alias.get(normalized);
      if (slugSet.has(mapped)) return mapped;
    }
  }

  const fullText = normalizeTypeSlug(`${tipoRaw || ''} ${title || ''}`);
  for (const [k, v] of alias.entries()) {
    if (fullText.includes(k) && slugSet.has(v)) return v;
  }

  if (slugSet.has(defaultSlug)) return defaultSlug;
  return songTypes[0]?.slug || defaultSlug;
}

async function collectSongItems(cantosDir) {
  const rootFiles = await fs.readdir(cantosDir, { withFileTypes: true });
  const mdFiles = rootFiles.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'));
  const items = [];

  for (const mdEntry of mdFiles) {
    const mdPath = path.join(cantosDir, mdEntry.name);
    const parsed = parseMarkdown(await readUtf8(mdPath));
    const songFolderName = mdEntry.name.replace(/\.md$/i, '');
    const normalizedBase = normalizeTypeSlug(stripNotionIdSuffix(songFolderName));

    const referencedFiles = [];
    for (const link of parsed.links) {
      const rel = link.target.replace(/\//g, path.sep);
      const abs = path.resolve(cantosDir, rel);
      if (await fileExists(abs)) {
        referencedFiles.push({ path: abs, label: link.label });
      }
    }

    const byPath = new Map();
    for (const f of referencedFiles) {
      byPath.set(f.path, f);
    }

    items.push({
      mdPath,
      title: parsed.title || songFolderName,
      normalizedBase,
      tipoRaw: parsed.tipoRaw,
      lyrics: parsed.lyrics,
      filesMap: byPath,
    });
  }

  const dirEntries = await fs.readdir(cantosDir, { withFileTypes: true });
  const dirs = [];
  for (const d of dirEntries) {
    if (!d.isDirectory()) continue;
    const dirPath = path.join(cantosDir, d.name);
    const files = (await listFiles(dirPath)).map((p) => ({ path: p, label: path.basename(p) }));
    if (files.length === 0) continue;
    dirs.push({
      name: d.name,
      normalized: normalizeTypeSlug(stripNotionIdSuffix(d.name)),
      files,
    });
  }

  function score(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.startsWith(b) || b.startsWith(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
    const ta = new Set(a.split('-').filter(Boolean));
    const tb = new Set(b.split('-').filter(Boolean));
    const inter = [...ta].filter((x) => tb.has(x)).length;
    const union = new Set([...ta, ...tb]).size;
    return union ? inter / union : 0;
  }

  const usedDirs = new Set();
  for (const item of items) {
    let best = null;
    let bestScore = 0;
    for (const dir of dirs) {
      if (usedDirs.has(dir.name)) continue;
      const s = score(item.normalizedBase, dir.normalized);
      if (s > bestScore) {
        bestScore = s;
        best = dir;
      }
    }
    if (best && bestScore >= 0.45) {
      usedDirs.add(best.name);
      for (const f of best.files) {
        item.filesMap.set(f.path, f);
      }
    }
  }

  for (const dir of dirs) {
    if (usedDirs.has(dir.name)) continue;
    let best = null;
    let bestScore = 0;
    for (const item of items) {
      const s = score(item.normalizedBase, dir.normalized);
      if (s > bestScore) {
        bestScore = s;
        best = item;
      }
    }
    if (best && bestScore >= 0.25) {
      for (const f of dir.files) {
        best.filesMap.set(f.path, f);
      }
      usedDirs.add(dir.name);
    }
  }

  return items.map((i) => ({
    mdPath: i.mdPath,
    title: i.title,
    tipoRaw: i.tipoRaw,
    lyrics: i.lyrics,
    files: [...i.filesMap.values()],
  }));
}

async function main() {
  const sourceDir =
    argValue('--source-dir') || process.env.LOCAL_CANTOS_DIR || 'C:\\Users\\gerbsonlima\\Downloads\\Cantos';
  const dryRun = process.argv.includes('--dry-run');
  const updateExisting = process.argv.includes('--update-existing');
  const defaultType = process.env.DEFAULT_SONG_TYPE_SLUG || 'comunhao';

  const supabaseUrl = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const authToken = process.env.SUPABASE_AUTH_TOKEN || apiKey;
  const tenantId = process.env.SUPABASE_TENANT_ID;
  const hasSupabaseCreds = !!(supabaseUrl && apiKey && authToken && tenantId);
  const authUserId = parseJwtSub(authToken);
  const storageOwnerId = process.env.SUPABASE_STORAGE_OWNER_ID || authUserId || tenantId;

  if (!(await fileExists(sourceDir))) {
    throw new Error(`Source folder not found: ${sourceDir}`);
  }

  const items = await collectSongItems(sourceDir);
  let songTypes = [{ slug: defaultType, name: defaultType, order_index: 0 }];
  if (hasSupabaseCreds) {
    songTypes = await fetchSongTypes({ supabaseUrl, apiKey, authToken, tenantId });
  } else if (!dryRun) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_TENANT_ID');
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let audiosInserted = 0;
  let docsUploaded = 0;
  const errors = [];

  for (const item of items) {
    try {
      const name = item.title.trim();
      if (!name) {
        skipped++;
        continue;
      }

      const typeSlug = mapTypeSlug(item.tipoRaw, item.title, songTypes, defaultType);
      const payload = {
        name,
        type: typeSlug,
        lyrics: item.lyrics,
        is_public: true,
        tenant_id: tenantId,
      };

      const audioFiles = item.files.filter((f) => AUDIO_EXTENSIONS.has(path.extname(f.path).toLowerCase()));
      const imageFiles = item.files.filter((f) => IMAGE_EXTENSIONS.has(path.extname(f.path).toLowerCase()));
      const pdfFiles = item.files.filter((f) => PDF_EXTENSIONS.has(path.extname(f.path).toLowerCase()));

      let song = hasSupabaseCreds
        ? await findSongByName({ supabaseUrl, apiKey, authToken, tenantId, name })
        : null;

      if (dryRun) {
        const sampleNaipe = audioFiles.slice(0, 4).map((af) => {
          const fn = path.basename(af.path);
          return `${fn}=>${inferNaipeFromFileAndLabel(fn, af.label)}`;
        });
        console.log(
          `[DRY-RUN] ${song ? 'EXISTS' : 'NEW'}: ${name} | type=${typeSlug} | audios=${audioFiles.length} | pdf=${pdfFiles.length} | img=${imageFiles.length}`,
        );
        if (sampleNaipe.length) {
          console.log(`  naipes: ${sampleNaipe.join(' | ')}`);
        }
      } else if (!song) {
        song = await insertSong({ supabaseUrl, apiKey, authToken, payload });
        inserted++;
      } else if (updateExisting) {
        await updateSong({
          supabaseUrl,
          apiKey,
          authToken,
          id: song.id,
          payload: {
            type: typeSlug,
            lyrics: item.lyrics,
            updated_at: new Date().toISOString(),
          },
        });
        updated++;
      } else {
        skipped++;
      }

      if (!song) continue;

      if (!dryRun && (imageFiles.length || pdfFiles.length) && (updateExisting || inserted > 0)) {
        let sheetMusicUrl = null;
        let sheetMusicPdfUrl = null;

        if (imageFiles[0]) {
          const base = sanitizeFileName(path.basename(imageFiles[0].path));
          const storagePath = `${tenantId}/${song.id}/sheet_${Date.now()}_${base}`;
            sheetMusicUrl = await uploadToBucket({
              supabaseUrl,
              apiKey,
              authToken,
              bucket: 'sheet-music',
              storagePath,
              filePath: imageFiles[0].path,
          });
          docsUploaded++;
        }
        if (pdfFiles[0]) {
          const base = sanitizeFileName(path.basename(pdfFiles[0].path));
          const storagePath = `${tenantId}/${song.id}/pdf_${Date.now()}_${base}`;
            sheetMusicPdfUrl = await uploadToBucket({
              supabaseUrl,
              apiKey,
              authToken,
              bucket: 'sheet-music',
              storagePath,
              filePath: pdfFiles[0].path,
          });
          docsUploaded++;
        }
        if (sheetMusicUrl || sheetMusicPdfUrl) {
          await updateSong({
            supabaseUrl,
            apiKey,
            authToken,
            id: song.id,
            payload: {
              sheet_music_url: sheetMusicUrl,
              sheet_music_pdf_url: sheetMusicPdfUrl,
              updated_at: new Date().toISOString(),
            },
          });
        }
      }

      if (dryRun) continue;

      const existingAudios = await getSongAudios({ supabaseUrl, apiKey, authToken, songId: song.id });
      const existingKeys = new Set(existingAudios.map((a) => `${a.name}|${a.naipe}`));
      const existingNames = new Set(existingAudios.map((a) => (a.name || '').toLowerCase()));

      for (const af of audioFiles) {
        const fileBase = sanitizeFileName(path.basename(af.path));
        const label = sanitizeFileName(path.basename(af.path, path.extname(af.path)));
        const naipe = inferNaipeFromFileAndLabel(fileBase, af.label);
        const key = `${label}|${naipe}`;
        if (existingKeys.has(key)) continue;
        if (existingNames.has(label.toLowerCase())) continue;

        const storagePath = `${storageOwnerId}/${song.id}/${Date.now()}_${fileBase}`;
        const audioUrl = await uploadToBucket({
          supabaseUrl,
          apiKey,
          authToken,
          bucket: 'audio-files',
          storagePath,
          filePath: af.path,
        });

        await insertSongAudio({
          supabaseUrl,
          apiKey,
          authToken,
          payload: {
            song_id: song.id,
            tenant_id: tenantId,
            name: label,
            naipe,
            audio_url: audioUrl,
          },
        });
        audiosInserted++;
      }
    } catch (error) {
      errors.push(`${item.mdPath}: ${error.message || String(error)}`);
    }
  }

  console.log('---');
  console.log(`Songs parsed: ${items.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Audios inserted: ${audiosInserted}`);
  console.log(`Docs uploaded: ${docsUploaded}`);
  console.log(`Errors: ${errors.length}`);
  for (const e of errors.slice(0, 50)) console.log(`- ${e}`);

  if (errors.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
