#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import JSZip from 'jszip';

function argValue(name, fallback = '') {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] || fallback;
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

function stripTags(html) {
  return (html || '').replace(/<[^>]+>/g, '').trim();
}

function decodeHtmlEntities(text) {
  return (text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(text) {
  return normalizeText(text).replace(/[^a-z0-9]+/g, '');
}

function sanitizeFileName(fileName) {
  return (fileName || 'file.bin')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function fixMojibake(text) {
  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
}

function parseDatePtBR(raw) {
  const base = (raw || '').replace(/^@/, '').trim();
  const months = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  const m = base.match(/(\d{1,2})\s+de\s+([a-zçãéêôóíú]+)\s+de\s+(\d{4})/i);
  if (!m) return '';
  const day = Number(m[1]);
  const monthName = normalizeText(m[2]);
  const month = months[monthName];
  const year = Number(m[3]);
  if (!month || !day || !year) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractFieldByLabel(html, label) {
  const re = new RegExp(`<tr[^>]*>\\s*<th[^>]*>[\\s\\S]*?${label}[\\s\\S]*?<\\/th>\\s*<td>([\\s\\S]*?)<\\/td>\\s*<\\/tr>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  return decodeHtmlEntities(stripTags(m[1]));
}

function extractCoverSrc(html) {
  const m = html.match(/<img[^>]*class="page-cover-image"[^>]*src="([^"]+)"/i);
  return m ? m[1].trim() : '';
}

function extractTitle(html) {
  const m = html.match(/<h1[^>]*class="page-title"[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  return decodeHtmlEntities(stripTags(m[1]));
}

function inferContentTypeByExt(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function uploadToBucket({ supabaseUrl, apiKey, authToken, bucket, storagePath, bytes, contentType }) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`, {
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
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${storagePath}`;
}

async function fetchEvents({ supabaseUrl, apiKey, authToken, tenantId }) {
  const url = new URL('/rest/v1/events', supabaseUrl);
  url.searchParams.set('select', 'id,name,date,tenant_id,cover_image_url,location');
  url.searchParams.set('tenant_id', `eq.${tenantId}`);
  url.searchParams.set('limit', '5000');
  const res = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!res.ok) throw new Error(`events fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function insertEvent({ supabaseUrl, apiKey, authToken, payload }) {
  const res = await fetch(`${supabaseUrl}/rest/v1/events`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`events insert failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function updateEvent({ supabaseUrl, apiKey, authToken, eventId, payload }) {
  const url = new URL('/rest/v1/events', supabaseUrl);
  url.searchParams.set('id', `eq.${eventId}`);
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
  if (!res.ok) throw new Error(`events update failed: ${res.status} ${await res.text()}`);
}

function buildZipEntryIndexes(zip) {
  const exact = new Map();
  const normalized = new Map();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const candidates = new Set([name, fixMojibake(name)]);
    for (const c of candidates) {
      exact.set(c, entry);
      normalized.set(normalizeKey(c), entry);
    }
  }
  return { exact, normalized };
}

function resolveZipEntry({ indexes, desiredPath }) {
  const candidates = new Set([
    desiredPath,
    fixMojibake(desiredPath),
    desiredPath.replace(/\\/g, '/'),
    fixMojibake(desiredPath.replace(/\\/g, '/')),
  ]);
  for (const c of candidates) {
    const byExact = indexes.exact.get(c);
    if (byExact) return byExact;
  }
  for (const c of candidates) {
    const byNormalized = indexes.normalized.get(normalizeKey(c));
    if (byNormalized) return byNormalized;
  }
  return null;
}

async function main() {
  const zipPath = argValue('--zip-path');
  const dryRun = process.argv.includes('--dry-run');
  const updateExisting = process.argv.includes('--update-existing');

  const supabaseUrl = argValue('--supabase-url', process.env.SUPABASE_URL || '');
  const apiKey = argValue('--anon-key', process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  const authToken = argValue('--auth-token', process.env.SUPABASE_AUTH_TOKEN || '');
  const tenantId = argValue('--tenant-id', process.env.SUPABASE_TENANT_ID || process.env.TENANT_ID || '');
  const userId = parseJwtSub(authToken);

  if (!zipPath) throw new Error('Missing --zip-path');
  if (!supabaseUrl) throw new Error('Missing --supabase-url (or SUPABASE_URL)');
  if (!apiKey) throw new Error('Missing --anon-key (or SUPABASE_ANON_KEY)');
  if (!authToken) throw new Error('Missing --auth-token (or SUPABASE_AUTH_TOKEN)');
  if (!tenantId) throw new Error('Missing --tenant-id (or SUPABASE_TENANT_ID)');
  if (!userId) throw new Error('Could not extract user id from auth token');

  const zipBytes = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBytes);
  const indexes = buildZipEntryIndexes(zip);

  const htmlEntries = Object.entries(zip.files)
    .filter(([name, entry]) => !entry.dir && name.startsWith('Eventos/') && name.toLowerCase().endsWith('.html'))
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  const parsedEvents = [];
  for (const name of htmlEntries) {
    const html = await zip.file(name)?.async('string');
    if (!html) continue;
    const title = extractTitle(html);
    const rawDate = extractFieldByLabel(html, 'Data');
    const date = parseDatePtBR(rawDate);
    const location = extractFieldByLabel(html, 'Local') || null;
    const coverSrc = extractCoverSrc(html);
    if (!title || !date) continue;
    parsedEvents.push({
      sourceHtml: name,
      name: title.trim(),
      date,
      location,
      coverSrc,
    });
  }

  const existing = await fetchEvents({ supabaseUrl, apiKey, authToken, tenantId });
  const byNameDate = new Map();
  for (const ev of existing) {
    const key = `${normalizeKey(ev.name)}|${ev.date}`;
    byNameDate.set(key, ev);
  }

  let created = 0;
  let updated = 0;
  let uploadedCovers = 0;
  let coverMisses = 0;
  let errors = 0;

  console.log(`Parsed events: ${parsedEvents.length}`);
  console.log(`Existing tenant events: ${existing.length}`);

  for (const ev of parsedEvents) {
    try {
      let coverImageUrl = null;
      if (ev.coverSrc) {
        const decoded = decodeURIComponent(ev.coverSrc);
        const desired = `Eventos/${decoded}`;
        const entry = resolveZipEntry({ indexes, desiredPath: desired });
        if (entry) {
          const bytes = await entry.async('nodebuffer');
          const ext = path.extname(entry.name) || '.png';
          const safeBase = sanitizeFileName(ev.name);
          const storagePath = `events/${tenantId}/${ev.date}_${safeBase}${ext.toLowerCase()}`;
          if (!dryRun) {
            coverImageUrl = await uploadToBucket({
              supabaseUrl,
              apiKey,
              authToken,
              bucket: 'event-covers',
              storagePath,
              bytes,
              contentType: inferContentTypeByExt(entry.name),
            });
          } else {
            coverImageUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/event-covers/${storagePath}`;
          }
          uploadedCovers += 1;
        } else {
          coverMisses += 1;
        }
      }

      const payload = {
        user_id: userId,
        tenant_id: tenantId,
        name: ev.name,
        date: ev.date,
        location: ev.location,
        notes: null,
        ...(coverImageUrl ? { cover_image_url: coverImageUrl } : {}),
      };

      const key = `${normalizeKey(ev.name)}|${ev.date}`;
      const found = byNameDate.get(key);
      if (found) {
        if (updateExisting) {
          if (!dryRun) {
            await updateEvent({
              supabaseUrl,
              apiKey,
              authToken,
              eventId: found.id,
              payload,
            });
          }
          updated += 1;
          console.log(`[UPDATED] ${ev.date} | ${ev.name}`);
        } else {
          console.log(`[SKIP_EXISTS] ${ev.date} | ${ev.name}`);
        }
      } else {
        if (!dryRun) {
          const inserted = await insertEvent({ supabaseUrl, apiKey, authToken, payload });
          byNameDate.set(key, inserted);
        }
        created += 1;
        console.log(`[CREATED] ${ev.date} | ${ev.name}`);
      }
    } catch (err) {
      errors += 1;
      console.error(`[ERROR] ${ev.name}: ${err?.message || err}`);
    }
  }

  console.log(`DONE parsed=${parsedEvents.length} created=${created} updated=${updated} uploaded_covers=${uploadedCovers} cover_misses=${coverMisses} errors=${errors}`);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

