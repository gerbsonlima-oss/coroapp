// Versão do SW
const SW_VERSION = '3.0.0';
const CACHE_PREFIX = 'cantosacro';

// Cache names
const CACHES = {
  api: `${CACHE_PREFIX}-api-v1`,
  storage: `${CACHE_PREFIX}-storage-v1`,
  audio: `${CACHE_PREFIX}-audio-v1`,
  images: `${CACHE_PREFIX}-images-v1`,
  static: `${CACHE_PREFIX}-static-v1`,
  events: `${CACHE_PREFIX}-events-v1`,
};

const ALL_CACHES = Object.values(CACHES);

// Install: activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v' + SW_VERSION);
  self.skipWaiting();
});

// Activate: clean old caches and take control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v' + SW_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && !ALL_CACHES.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: is Supabase API GET request?
function isSupabaseApiGet(request, url) {
  return request.method === 'GET' &&
    url.hostname.includes('supabase.co') &&
    url.pathname.startsWith('/rest/');
}

// Helper: is Supabase storage request?
function isSupabaseStorage(url) {
  return url.hostname.includes('supabase.co') && url.pathname.startsWith('/storage/');
}

// Helper: is audio file?
function isAudioFile(request, url) {
  return request.destination === 'audio' ||
    /\.(mp3|wav|ogg|m4a)$/i.test(url.pathname);
}

// Helper: is image?
function isImageFile(request, url) {
  return request.destination === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname);
}

// Helper: is static asset?
function isStaticAsset(request) {
  return request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font';
}

// Helper: is event page?
function isEventPage(url) {
  return url.pathname.startsWith('/e/');
}

// Network first strategy
async function networkFirst(request, cacheName, timeoutMs = 3000) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

// Cache first strategy
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

// Stale while revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Supabase API (GET only) - network first
  if (isSupabaseApiGet(request, url)) {
    event.respondWith(networkFirst(request, CACHES.api));
    return;
  }

  // Event pages - network first
  if (isEventPage(url)) {
    event.respondWith(networkFirst(request, CACHES.events));
    return;
  }

  // Supabase storage - cache first
  if (isSupabaseStorage(url)) {
    event.respondWith(cacheFirst(request, CACHES.storage));
    return;
  }

  // Audio files - cache first
  if (isAudioFile(request, url)) {
    event.respondWith(cacheFirst(request, CACHES.audio));
    return;
  }

  // Images - cache first
  if (isImageFile(request, url)) {
    event.respondWith(cacheFirst(request, CACHES.images));
    return;
  }

  // Static assets - stale while revalidate
  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request, CACHES.static));
    return;
  }
});
