// NO-CACHE Service Worker for Radix Tribes
// Ensures users ALWAYS get the latest version - no caching whatsoever

const CACHE_NAME = 'radix-tribes-no-cache-v2.6';

// Install event - clear ALL caches
self.addEventListener('install', (event) => {
  console.log('🔄 [SW] Installing NO-CACHE service worker - clearing all caches');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('🗑️ [SW] Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('✅ [SW] All caches cleared - no caching mode active');
      return self.skipWaiting();
    })
  );
});

// Activate event - take control immediately and clear any remaining caches
self.addEventListener('activate', (event) => {
  console.log('✅ [SW] Activating NO-CACHE service worker');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('🗑️ [SW] Force deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('🚀 [SW] NO-CACHE service worker activated - all caches cleared');
        return self.clients.claim();
      })
  );
});

// Fetch event - NEVER cache, always fetch fresh from network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Socket.IO and API requests (let them handle themselves)
  if (url.pathname.includes('/socket.io/') ||
      url.pathname.includes('/api/') ||
      url.protocol === 'ws:' ||
      url.protocol === 'wss:') {
    return;
  }

  // Only cache-bust same-origin requests to avoid CORS issues
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // Same-origin: use aggressive cache-busting
    event.respondWith(
      fetch(request.url + (request.url.includes('?') ? '&' : '?') + '_cb=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }).catch(() => {
        // If cache-busted request fails, try original request
        return fetch(request, { cache: 'no-store' });
      })
    );
  } else {
    // Cross-origin: use original request to avoid CORS issues
    event.respondWith(
      fetch(request, { cache: 'no-store' })
    );
  }
});

// Force reload all clients when service worker updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('🔄 [SW] Force updating service worker');
    self.skipWaiting();
  }
});

console.log('🚀 [SW] NO-CACHE Service Worker loaded - version 2.6');
