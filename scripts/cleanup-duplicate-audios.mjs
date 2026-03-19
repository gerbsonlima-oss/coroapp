#!/usr/bin/env node
import process from 'node:process';

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

function getFileNameFromUrl(url) {
  try {
    const u = new URL(url || '');
    const seg = u.pathname.split('/').filter(Boolean);
    return decodeURIComponent(seg[seg.length - 1] || '');
  } catch {
    const raw = (url || '').split('/').pop() || '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
}

function fileCore(url) {
  const f = getFileNameFromUrl(url).replace(/\.[a-z0-9]+$/i, '');
  // Remove common timestamp prefix from uploads: 1773882339024_
  return compact(f.replace(/^\d{10,}_/, ''));
}

async function fetchAllSongAudios({ supabaseUrl, apiKey, authToken, tenantId }) {
  const all = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = new URL('/rest/v1/song_audios', supabaseUrl);
    url.searchParams.set('select', 'id,song_id,tenant_id,name,naipe,audio_url,created_at');
    url.searchParams.set('tenant_id', `eq.${tenantId}`);
    url.searchParams.set('order', 'created_at.asc');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const res = await fetch(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!res.ok) throw new Error(`song_audios fetch failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }

  return all;
}

function chooseKeepAndDelete(group) {
  const sorted = [...group].sort((a, b) => {
    const da = new Date(a.created_at || 0).getTime();
    const db = new Date(b.created_at || 0).getTime();
    if (da !== db) return da - db; // keep oldest
    return (a.id || '').localeCompare(b.id || '');
  });
  return {
    keep: sorted[0],
    drop: sorted.slice(1),
  };
}

function makeKey(...parts) {
  return parts.map((x) => (x == null ? '' : String(x))).join('|');
}

function dedupePlan(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const dropIds = new Set();
  const reasons = [];

  const groupsA = new Map();
  for (const r of rows) {
    const key = makeKey(r.song_id, normalizeText(r.naipe), compact(r.audio_url));
    if (!groupsA.has(key)) groupsA.set(key, []);
    groupsA.get(key).push(r);
  }
  for (const g of groupsA.values()) {
    if (g.length < 2) continue;
    const { keep, drop } = chooseKeepAndDelete(g);
    for (const d of drop) {
      dropIds.add(d.id);
      reasons.push({ id: d.id, keep: keep.id, reason: 'same_song_naipe_url' });
    }
  }

  const remainingB = rows.filter((r) => !dropIds.has(r.id));
  const groupsB = new Map();
  for (const r of remainingB) {
    const key = makeKey(r.song_id, normalizeText(r.naipe), compact(r.name), fileCore(r.audio_url));
    if (!groupsB.has(key)) groupsB.set(key, []);
    groupsB.get(key).push(r);
  }
  for (const g of groupsB.values()) {
    if (g.length < 2) continue;
    const { keep, drop } = chooseKeepAndDelete(g);
    for (const d of drop) {
      dropIds.add(d.id);
      reasons.push({ id: d.id, keep: keep.id, reason: 'same_song_naipe_name_filecore' });
    }
  }

  const remainingC = rows.filter((r) => !dropIds.has(r.id));
  const groupsC = new Map();
  for (const r of remainingC) {
    const key = makeKey(r.song_id, normalizeText(r.naipe), fileCore(r.audio_url));
    if (!groupsC.has(key)) groupsC.set(key, []);
    groupsC.get(key).push(r);
  }
  for (const g of groupsC.values()) {
    if (g.length < 2) continue;
    const { keep, drop } = chooseKeepAndDelete(g);
    for (const d of drop) {
      // Only remove if names are very close too; avoids removing distinct takes
      const s = similarity(keep.name, d.name);
      const prefixMatch =
        compact(keep.name).startsWith(compact(d.name)) ||
        compact(d.name).startsWith(compact(keep.name));
      if (s >= 0.9 || prefixMatch) {
        dropIds.add(d.id);
        reasons.push({ id: d.id, keep: keep.id, reason: 'same_song_naipe_filecore_very_similar_name' });
      }
    }
  }

  const dropRows = [...dropIds].map((id) => byId.get(id)).filter(Boolean);
  return { dropRows, reasons };
}

async function deleteByIds({ supabaseUrl, apiKey, authToken, tenantId, ids }) {
  if (!ids.length) return 0;
  let deleted = 0;
  const chunkSize = 100;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const url = new URL('/rest/v1/song_audios', supabaseUrl);
    url.searchParams.set('tenant_id', `eq.${tenantId}`);
    url.searchParams.set('id', `in.(${chunk.join(',')})`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${authToken}`,
        Prefer: 'return=representation',
      },
    });
    if (!res.ok) throw new Error(`delete failed: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    deleted += Array.isArray(rows) ? rows.length : 0;
  }
  return deleted;
}

async function main() {
  const supabaseUrl = argValue('--supabase-url', process.env.SUPABASE_URL || '');
  const apiKey = argValue('--anon-key', process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  const authToken = argValue('--auth-token', process.env.SUPABASE_AUTH_TOKEN || '');
  const tenantId = argValue('--tenant-id', process.env.SUPABASE_TENANT_ID || process.env.TENANT_ID || '');
  const execute = process.argv.includes('--execute');

  if (!supabaseUrl) throw new Error('Missing --supabase-url');
  if (!apiKey) throw new Error('Missing --anon-key');
  if (!authToken) throw new Error('Missing --auth-token');
  if (!tenantId) throw new Error('Missing --tenant-id');

  const allRows = await fetchAllSongAudios({ supabaseUrl, apiKey, authToken, tenantId });
  const { dropRows, reasons } = dedupePlan(allRows);

  console.log(`TOTAL_AUDIOS=${allRows.length}`);
  console.log(`DUPLICATES_CANDIDATES=${dropRows.length}`);
  const reasonCount = reasons.reduce((acc, r) => {
    acc[r.reason] = (acc[r.reason] || 0) + 1;
    return acc;
  }, {});
  console.log(`REASONS=${JSON.stringify(reasonCount)}`);

  if (!execute) {
    console.log('MODE=dry-run (no deletions)');
    return;
  }

  const deleted = await deleteByIds({
    supabaseUrl,
    apiKey,
    authToken,
    tenantId,
    ids: dropRows.map((r) => r.id),
  });
  console.log(`DELETED=${deleted}`);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});

