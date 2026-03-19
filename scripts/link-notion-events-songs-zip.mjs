#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import JSZip from 'jszip';

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
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(text) {
  return normalizeText(text).replace(/\s+/g, '');
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

function stripTags(html) {
  return (html || '').replace(/<[^>]+>/g, '').trim();
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
  return m[1] || '';
}

function extractTitle(html) {
  const m = html.match(/<h1[^>]*class="page-title"[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  return decodeHtmlEntities(stripTags(m[1]));
}

function parseCantosFromCellHtml(cellHtml) {
  const links = [];
  const re = /<a[^>]*>([\s\S]*?)<\/a>/gi;
  let m = re.exec(cellHtml);
  while (m) {
    const txt = decodeHtmlEntities(stripTags(m[1])).replace(/^🎵\s*/, '').trim();
    if (txt) links.push(txt);
    m = re.exec(cellHtml);
  }
  if (links.length > 0) return links;

  // Fallback for CSV-like plain content
  const plain = decodeHtmlEntities(stripTags(cellHtml));
  return plain
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitTypeAndName(label) {
  const clean = label.replace(/\s+/g, ' ').trim();
  const parts = clean.split(/\s+[—-]\s+/);
  if (parts.length >= 2) {
    return {
      typeLabel: parts[0].trim(),
      songName: parts.slice(1).join(' - ').trim(),
    };
  }
  return { typeLabel: '', songName: clean };
}

function similarity(a, b) {
  const sa = new Set(normalizeText(a).split(' ').filter(Boolean));
  const sb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

function mapTypeSlug(typeLabel, songTypes) {
  const t = normalizeText(typeLabel);
  const slugSet = new Set(songTypes.map((x) => x.slug));
  const byNormName = new Map(songTypes.map((x) => [normalizeText(x.name), x.slug]));

  if (slugSet.has(t)) return t;
  if (byNormName.has(t)) return byNormName.get(t);

  const alias = [
    ['entrada', 'canto_entrada'],
    ['antifona de entrada', 'antifona_entrada'],
    ['kyrie', 'ato_penitencial'],
    ['ato penitencial', 'ato_penitencial'],
    ['gloria', 'gloria'],
    ['salmo', 'salmo'],
    ['aclamacao', 'aclamacao'],
    ['ofertorio', 'oferendas'],
    ['ofertorio', 'ofertorio'],
    ['santo', 'santo'],
    ['cordeiro', 'cordeiro'],
    ['comunhao', 'comunhao'],
    ['final', 'final'],
    ['outros', 'outro'],
    ['outros', 'todos'],
    ['amem', 'amem'],
  ];
  for (const [k, slug] of alias) {
    if (t.includes(k) && slugSet.has(slug)) return slug;
  }

  if (slugSet.has('outro')) return 'outro';
  if (slugSet.has('todos')) return 'todos';
  return songTypes[0]?.slug || 'outro';
}

async function fetchEvents({ supabaseUrl, apiKey, authToken, tenantId }) {
  const url = new URL('/rest/v1/events', supabaseUrl);
  url.searchParams.set('select', 'id,name,date,tenant_id');
  url.searchParams.set('tenant_id', `eq.${tenantId}`);
  url.searchParams.set('limit', '5000');
  const res = await fetch(url, {
    headers: { apikey: apiKey, Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`events fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchSongs({ supabaseUrl, apiKey, authToken, tenantId }) {
  const url = new URL('/rest/v1/songs', supabaseUrl);
  url.searchParams.set('select', 'id,name,type,tenant_id');
  url.searchParams.set('tenant_id', `eq.${tenantId}`);
  url.searchParams.set('limit', '10000');
  const res = await fetch(url, {
    headers: { apikey: apiKey, Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`songs fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchSongTypes({ supabaseUrl, apiKey, authToken, tenantId }) {
  const url = new URL('/rest/v1/song_types', supabaseUrl);
  url.searchParams.set('select', 'id,slug,name,order_index,tenant_id');
  url.searchParams.set('or', `(tenant_id.is.null,tenant_id.eq.${tenantId},tenant_id.eq.00000000-0000-0000-0000-000000000001)`);
  url.searchParams.set('order', 'order_index');
  const res = await fetch(url, {
    headers: { apikey: apiKey, Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`song_types fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
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

async function deleteEventSongs({ supabaseUrl, apiKey, authToken, eventId }) {
  const url = new URL('/rest/v1/event_songs', supabaseUrl);
  url.searchParams.set('event_id', `eq.${eventId}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      Prefer: 'return=minimal',
    },
  });
  if (!res.ok) throw new Error(`event_songs delete failed: ${res.status} ${await res.text()}`);
}

async function insertEventSong({ supabaseUrl, apiKey, authToken, payload }) {
  const res = await fetch(`${supabaseUrl}/rest/v1/event_songs`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`event_song insert failed: ${res.status} ${await res.text()}`);
}

function findBestSong(allSongs, query) {
  const qn = normalizeText(query);
  if (!qn) return null;
  const exact = allSongs.find((s) => normalizeText(s.name) === qn);
  if (exact) return exact;

  const compact = normalizeKey(query);
  const exactCompact = allSongs.find((s) => normalizeKey(s.name) === compact);
  if (exactCompact) return exactCompact;

  let best = null;
  let score = 0;
  for (const s of allSongs) {
    const sc = similarity(query, s.name);
    if (sc > score) {
      score = sc;
      best = s;
    }
  }
  if (best && score >= 0.5) return best;
  return null;
}

async function main() {
  const zipPath = argValue('--zip-path');
  const dryRun = process.argv.includes('--dry-run');
  const createMissing = process.argv.includes('--create-missing');

  const supabaseUrl = argValue('--supabase-url', process.env.SUPABASE_URL || '');
  const apiKey = argValue('--anon-key', process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  const authToken = argValue('--auth-token', process.env.SUPABASE_AUTH_TOKEN || '');
  const tenantId = argValue('--tenant-id', process.env.SUPABASE_TENANT_ID || process.env.TENANT_ID || '');
  const userId = argValue('--user-id', '');

  if (!zipPath) throw new Error('Missing --zip-path');
  if (!supabaseUrl) throw new Error('Missing --supabase-url');
  if (!apiKey) throw new Error('Missing --anon-key');
  if (!authToken) throw new Error('Missing --auth-token');
  if (!tenantId) throw new Error('Missing --tenant-id');

  const zipBytes = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(zipBytes);
  const htmlEntries = Object.entries(zip.files)
    .filter(([name, e]) => !e.dir && name.startsWith('Eventos/') && name.toLowerCase().endsWith('.html'))
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  const parsed = [];
  for (const entryName of htmlEntries) {
    const html = await zip.file(entryName)?.async('string');
    if (!html) continue;
    const title = extractTitle(html).trim();
    const dateRawCell = extractFieldByLabel(html, 'Data');
    const date = parseDatePtBR(decodeHtmlEntities(stripTags(dateRawCell)));
    const cantosCell = extractFieldByLabel(html, 'Cantos');
    const cantos = parseCantosFromCellHtml(cantosCell);
    if (!title || !date || cantos.length === 0) continue;
    parsed.push({ title, date, cantos });
  }

  const [events, songs, songTypes] = await Promise.all([
    fetchEvents({ supabaseUrl, apiKey, authToken, tenantId }),
    fetchSongs({ supabaseUrl, apiKey, authToken, tenantId }),
    fetchSongTypes({ supabaseUrl, apiKey, authToken, tenantId }),
  ]);

  const eventByKey = new Map(events.map((e) => [`${normalizeKey(e.name)}|${e.date}`, e]));
  const songsRef = [...songs];

  let linkedEvents = 0;
  let linkedRows = 0;
  let createdSongs = 0;
  let missingSongs = 0;
  let errors = 0;

  for (const ev of parsed) {
    try {
      const key = `${normalizeKey(ev.title)}|${ev.date}`;
      const dbEvent = eventByKey.get(key);
      if (!dbEvent) {
        console.log(`[SKIP_EVENT_NOT_FOUND] ${ev.date} | ${ev.title}`);
        continue;
      }

      const rows = [];
      for (const [idx, canto] of ev.cantos.entries()) {
        const { typeLabel, songName } = splitTypeAndName(canto);
        const typeSlug = mapTypeSlug(typeLabel, songTypes);

        let song = findBestSong(songsRef, songName) || findBestSong(songsRef, canto);
        if (!song && createMissing) {
          if (!dryRun) {
            const created = await createSong({
              supabaseUrl,
              apiKey,
              authToken,
              payload: {
                user_id: userId || null,
                tenant_id: tenantId,
                name: songName || canto,
                type: typeSlug || 'outro',
                notes: null,
              },
            });
            song = created;
            songsRef.push(created);
          } else {
            song = { id: `DRY-${idx}`, name: songName || canto, type: typeSlug };
          }
          createdSongs += 1;
          console.log(`[CREATE_SONG] ${songName || canto}`);
        }

        if (!song) {
          missingSongs += 1;
          console.log(`[MISS_SONG] ${ev.title} | ${canto}`);
          continue;
        }

        rows.push({
          event_id: dbEvent.id,
          song_id: song.id,
          type: typeSlug || song.type || null,
          order_index: idx,
        });
      }

      if (!dryRun) {
        await deleteEventSongs({ supabaseUrl, apiKey, authToken, eventId: dbEvent.id });
        for (const row of rows) {
          await insertEventSong({ supabaseUrl, apiKey, authToken, payload: row });
        }
      }
      linkedEvents += 1;
      linkedRows += rows.length;
      console.log(`[LINKED] ${ev.date} | ${ev.title} | songs=${rows.length}`);
    } catch (err) {
      errors += 1;
      console.error(`[ERROR] ${ev.title}: ${err?.message || err}`);
    }
  }

  console.log(
    `DONE parsed_events=${parsed.length} linked_events=${linkedEvents} linked_rows=${linkedRows} created_songs=${createdSongs} missing_songs=${missingSongs} errors=${errors}`,
  );
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

