const CACHE_NAME = 'clmtp-wms-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Installation — mise en cache des assets statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activation — nettoyage anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — stratégie Network First avec fallback cache
self.addEventListener('fetch', e => {
  // Ne pas intercepter les requêtes Supabase (toujours en ligne)
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Mettre en cache les nouvelles ressources
        if (response.ok && e.request.method === 'GET') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => {
        if (cached) return cached;
        // Fallback vers la page principale si hors ligne
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      }))
  );
});

// Message pour forcer la mise à jour
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
