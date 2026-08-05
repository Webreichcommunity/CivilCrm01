const CACHE_NAME = 'vastushobha-construction-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/brandlogo.png', '/pwa-192.png', '/pwa-512.png'];
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  if (IS_LOCAL_DEV) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  if (IS_LOCAL_DEV) {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    );
    self.clients.claim();
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (IS_LOCAL_DEV) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match('/'));
    })
  );
});
