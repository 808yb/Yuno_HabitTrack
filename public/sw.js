const CACHE_NAME = 'yuno-habittrack-v2';
const urlsToCache = [
  '/',
  // Intentionally do not cache manifest or icons to avoid stale Home Screen
  // Add other important assets here
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isManifestOrIcon = url.pathname.endsWith('/manifest.json') || /\/yuno(180|512)\.png(\?.*)?$/.test(url.pathname + url.search);
  if (isManifestOrIcon) {
    // Always bypass cache for manifest and icons
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
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
