import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Versão do SW - altere para forçar atualização
const SW_VERSION = '2.1.0';
const SHARE_CACHE_NAME = 'share-target-cache-v1';
const SHARE_CACHE_KEY = '/shared-target-payload';
console.log('[SW] Liturgia+ Service Worker v' + SW_VERSION);

// Limpa caches antigos
cleanupOutdatedCaches();

// Precache todos os assets gerados pelo build
precacheAndRoute(self.__WB_MANIFEST || []);

// Estratégia para API do Supabase (REST)
// IMPORTANTE: nunca interceptar mutações (POST/PUT/PATCH/DELETE), pois isso pode
// causar falhas de autenticação/RLS quando o request passa pelo Service Worker.
// Usa NetworkFirst quando online, CacheFirst quando offline
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.hostname.includes('supabase.co') &&
    url.pathname.startsWith('/rest/'),
  async ({ request, event }) => {
    // Check if online
    if (navigator.onLine) {
      // Online: try network first
      const networkFirst = new NetworkFirst({
        cacheName: 'supabase-api-cache',
        plugins: [
          new CacheableResponsePlugin({
            statuses: [0, 200],
          }),
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24, // 24 horas
          }),
        ],
      });
      return networkFirst.handle({ request, event });
    } else {
      // Offline: use cache first
      const cacheFirst = new CacheFirst({
        cacheName: 'supabase-api-cache',
        plugins: [
          new CacheableResponsePlugin({
            statuses: [0, 200],
          }),
        ],
      });
      return cacheFirst.handle({ request, event });
    }
  }
);

// Estratégia para páginas de evento offline (/e/*)
registerRoute(
  ({ url }) => url.pathname.startsWith('/e/'),
  new NetworkFirst({
    cacheName: 'event-pages-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
      }),
    ],
  })
);

// Estratégia para Storage do Supabase (imagens, PDFs, áudios)
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co') && url.pathname.startsWith('/storage/'),
  new CacheFirst({
    cacheName: 'supabase-storage-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Estratégia para arquivos de áudio
registerRoute(
  ({ request, url }) => 
    request.destination === 'audio' || 
    /\.(mp3|wav|ogg|m4a)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'audio-files-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 60 * 60 * 24 * 60, // 60 dias
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Estratégia para imagens
registerRoute(
  ({ request, url }) => 
    request.destination === 'image' || 
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Estratégia para assets estáticos (CSS, JS, fonts)
registerRoute(
  ({ request }) => 
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
      }),
    ],
  })
);

// Web Share Target (Android/WhatsApp -> PWA)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'POST') return;

  const url = new URL(request.url);
  if (url.pathname !== '/share-target') return;

  event.respondWith((async () => {
    try {
      const formData = await request.formData();
      const filesFromParam = formData.getAll('files').filter((item) => item instanceof File);
      const fallbackFile = formData.get('file');
      const pickedFile = filesFromParam[0] || (fallbackFile instanceof File ? fallbackFile : null);

      if (pickedFile) {
        const cache = await caches.open(SHARE_CACHE_NAME);

        const response = new Response(pickedFile, {
          headers: {
            'content-type': pickedFile.type || 'application/octet-stream',
            'x-shared-name': encodeURIComponent(pickedFile.name || 'arquivo-compartilhado'),
          },
        });

        await cache.put(SHARE_CACHE_KEY, response);
      }

      return Response.redirect('/share-target?shared=1', 303);
    } catch (error) {
      console.error('[SW] Share target error:', error);
      return Response.redirect('/share-target?shared=0', 303);
    }
  })());
});

// Ativar service worker imediatamente e limpar caches antigos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version:', SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new version:', SW_VERSION);
  event.waitUntil(
    Promise.all([
      // Limpa caches antigos com nomes diferentes
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Mantém apenas os caches atuais
              const validCaches = [
                'supabase-api-cache',
                'event-pages-cache',
                'supabase-storage-cache',
                'audio-files-cache',
                'images-cache',
                'static-resources',
                'offline-audio-cache',
                'offline-files-cache'
              ];
              return !validCaches.includes(cacheName) && !cacheName.startsWith('workbox-');
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      // Toma controle de todas as páginas
      self.clients.claim()
    ])
  );
});
