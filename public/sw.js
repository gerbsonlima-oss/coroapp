import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache todos os assets gerados pelo build
precacheAndRoute(self.__WB_MANIFEST || []);

// Estratégia para API do Supabase (REST)
// IMPORTANTE: nunca interceptar mutações (POST/PUT/PATCH/DELETE), pois isso pode
// causar falhas de autenticação/RLS quando o request passa pelo Service Worker.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.hostname.includes('supabase.co') &&
    url.pathname.startsWith('/rest/'),
  new NetworkFirst({
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

// Ativar service worker imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
