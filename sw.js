const CACHE = 'lumi-vocab-v2';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'words.json',
  'words.js',
  'manifest.webmanifest',
  'icon.svg',
  'mascot.svg',
  'mascot-map.svg',
  'rival-blue.svg',
  'rival-pink.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('index.html');
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
