/**
 * Plus Game Zone ERP — Production Service Worker
 * 
 * Capabilities:
 * - Network Interception & Offline Experience (App Shell, Assets, Fallback)
 * - Push Notifications & Rich OS Alerts
 * - Background Sync API ('sync' & 'periodicsync' handlers)
 * - Message Bus for Client / SW Communication
 * - Widget Data Caching & Offline API Handling
 */

const CACHE_NAME = 'pluszone-erp-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable-192.png',
  '/pwa-maskable-512.png',
  '/apple-touch-icon.png',
  '/cbe-logo.svg',
  '/telebirr-logo.svg',
  '/ebirr-logo.svg',
  '/widgets/summary.json'
];

// ============================================================================
// 1. LIFECYCLE: INSTALL & ACTIVATE
// ============================================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use map and catch to avoid failing install if an optional static asset is missing
      await Promise.all(
        ASSETS_TO_CACHE.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res.ok) {
              await cache.put(url, res);
            }
          } catch (err) {
            console.warn('[SW] Could not precache:', url, err);
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      // Notify all connected clients that the service worker is activated and ready
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: CACHE_NAME,
            timestamp: Date.now()
          });
        });
      });
    })
  );
});

// ============================================================================
// 2. NETWORK INTERCEPTION & OFFLINE EXPERIENCE
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // A. API Requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cache successful widget data and read queries for offline retrieval
          if (networkResponse && networkResponse.status === 200 && url.pathname.includes('/widget-data')) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, check if we have cached API response
          const cached = await caches.match(request);
          if (cached) return cached;

          // Provide structured offline JSON response
          return new Response(
            JSON.stringify({
              offline: true,
              message: 'PlusZone is operating in offline mode. Local cached state is active.',
              timestamp: Date.now()
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // B. HTML Navigations & Document Requests (Network-First with App Shell Cache Fallback)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedDoc = await caches.match(request);
          if (cachedDoc) return cachedDoc;
          const appShell = await caches.match('/index.html');
          if (appShell) return appShell;
          return caches.match('/');
        })
    );
    return;
  }

  // C. Static Assets: JS, CSS, Fonts, Images, Icons (Stale-While-Revalidate)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Trigger background network fetch to revalidate cache
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          // Silent catch offline
          return null;
        });

      // Return cached version immediately if present, otherwise await network
      return cachedResponse || fetchPromise.then((res) => {
        if (res) return res;
        // Last-resort fallback for navigations or index
        return caches.match('/index.html');
      });
    })
  );
});

// ============================================================================
// 3. BACKGROUND SYNC API
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered with tag:', event.tag);

  if (event.tag === 'sync-transactions' || event.tag === 'sync-ledger') {
    event.waitUntil(
      (async () => {
        // Broadcast sync event to all active clients
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: 'BACKGROUND_SYNC_TRIGGERED',
            tag: event.tag,
            timestamp: Date.now()
          });
        }
      })()
    );
  } else if (event.tag === 'sync-audit-logs') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: 'BACKGROUND_SYNC_AUDIT_LOGS',
            tag: event.tag,
            timestamp: Date.now()
          });
        }
      })()
    );
  }
});

// Periodic Background Sync (when permitted by browser/OS)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic background sync event:', event.tag);
  if (event.tag === 'sync-rates-and-balances' || event.tag === 'update-exchange-rates') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({
            type: 'PERIODIC_SYNC_TRIGGERED',
            tag: event.tag,
            timestamp: Date.now()
          });
        }
      })()
    );
  }
});

// ============================================================================
// 4. PUSH NOTIFICATIONS
// ============================================================================

self.addEventListener('push', (event) => {
  let data = {
    title: 'Plus Game Zone Alert',
    body: 'You have a new transaction update.',
    icon: '/pwa-192.png',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Financial statement & transaction alert',
    icon: data.icon || '/pwa-192.png',
    badge: '/pwa-192.png',
    vibrate: [150, 60, 150],
    tag: data.tag || `notif-${Date.now()}`,
    renotify: true,
    data: data.data || { url: '/' },
    actions: data.actions || [
      { action: 'open', title: 'Open ERP' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Plus Game Zone', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ============================================================================
// 5. MESSAGE CHANNEL (CLIENT <-> SERVICE WORKER)
// ============================================================================

self.addEventListener('message', (event) => {
  if (!event.data) return;

  // Trigger rich OS notification from client code
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data } = event.data.payload || {};
    const options = {
      body: body || 'New update in Plus Game Zone',
      icon: icon || '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: tag || `notif-${Date.now()}`,
      vibrate: [200, 100, 200],
      data: data || { url: '/' },
      renotify: true
    };
    self.registration.showNotification(title || 'Plus Game Zone', options);
    return;
  }

  // Force skip waiting on update prompt
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Return Service Worker diagnostic capabilities to requesting client
  if (event.data.type === 'QUERY_SW_CAPABILITIES') {
    event.source.postMessage({
      type: 'SW_CAPABILITIES_RESPONSE',
      capabilities: {
        cacheName: CACHE_NAME,
        offlineCapable: true,
        backgroundSync: 'sync' in self.registration,
        periodicSync: 'periodicSync' in self.registration,
        pushNotifications: 'showNotification' in self.registration,
        timestamp: Date.now()
      }
    });
  }
});
