const CACHE_NAME = 'yuno-habittrack-v3';
const urlsToCache = [
  // App shell HTML is no longer pre-cached to avoid stale UI.
  // Intentionally do not cache manifest or icons to avoid stale Home Screen
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - prefer network for app shell and code, cache for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  const isManifestOrIcon = url.pathname.endsWith('/manifest.json') || /\/yuno(180|512)\.png(\?.*)?$/.test(url.pathname + url.search);
  if (isManifestOrIcon) {
    // Always bypass cache for manifest and icons
    return;
  }

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  const isAppCode = request.destination === 'script' || request.destination === 'style' || url.pathname.startsWith('/_next/');

  if (isNavigation || isAppCode) {
    // Network-first to avoid serving stale UI or code
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for other requests (images, fonts, etc.)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return networkResponse;
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Handle app updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
