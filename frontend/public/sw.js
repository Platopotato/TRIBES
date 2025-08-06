const CACHE_NAME = 'radix-tribes-v1.0.0';
const STATIC_CACHE_NAME = 'radix-tribes-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'radix-tribes-dynamic-v1.0.0';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Assets to cache on first request
const DYNAMIC_ASSETS = [
  '/src/main-app.tsx',
  '/src/App.tsx'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Socket.IO and API requests
  if (url.pathname.includes('/socket.io/') || 
      url.pathname.includes('/api/') ||
      url.protocol === 'ws:' || 
      url.protocol === 'wss:') {
    return;
  }
  
  // Handle static assets
  if (STATIC_ASSETS.includes(url.pathname) || 
      url.pathname.includes('/icons/') ||
      url.pathname.includes('/screenshots/')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            console.log('[SW] Serving from static cache:', url.pathname);
            return response;
          }
          
          return fetch(request)
            .then((fetchResponse) => {
              const responseClone = fetchResponse.clone();
              caches.open(STATIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
              return fetchResponse;
            });
        })
        .catch(() => {
          // Fallback for offline
          if (url.pathname === '/' || url.pathname.includes('.html')) {
            return caches.match('/index.html');
          }
        })
    );
    return;
  }
  
  // Handle dynamic assets (JS, CSS, etc.)
  if (url.pathname.includes('/src/') || 
      url.pathname.includes('.js') || 
      url.pathname.includes('.css') ||
      url.pathname.includes('.tsx') ||
      url.pathname.includes('.ts')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            console.log('[SW] Serving from dynamic cache:', url.pathname);
            return response;
          }
          
          return fetch(request)
            .then((fetchResponse) => {
              // Only cache successful responses
              if (fetchResponse.status === 200) {
                const responseClone = fetchResponse.clone();
                caches.open(DYNAMIC_CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return fetchResponse;
            })
            .catch(() => {
              console.log('[SW] Network failed for:', url.pathname);
              // Could return a fallback page here
            });
        })
    );
    return;
  }
  
  // For all other requests, try network first, then cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();
        
        // Cache successful responses
        if (response.status === 200) {
          caches.open(DYNAMIC_CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            });
        }
        
        return response;
      })
      .catch(() => {
        // Try to serve from cache if network fails
        return caches.match(request)
          .then((response) => {
            if (response) {
              console.log('[SW] Serving from cache (offline):', url.pathname);
              return response;
            }
            
            // Ultimate fallback
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'game-actions-sync') {
    event.waitUntil(syncGameActions());
  }
});

// Sync game actions when back online
async function syncGameActions() {
  try {
    // Get pending actions from IndexedDB or localStorage
    const pendingActions = JSON.parse(localStorage.getItem('pendingGameActions') || '[]');
    
    if (pendingActions.length > 0) {
      console.log('[SW] Syncing', pendingActions.length, 'pending actions');
      
      // Send actions to server
      for (const action of pendingActions) {
        try {
          await fetch('/api/sync-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action)
          });
        } catch (error) {
          console.error('[SW] Failed to sync action:', error);
          // Keep failed actions for next sync
          return;
        }
      }
      
      // Clear synced actions
      localStorage.removeItem('pendingGameActions');
      console.log('[SW] All actions synced successfully');
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'Your turn is ready!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Play Now'
      },
      {
        action: 'close',
        title: 'Later'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Radix Tribes', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
