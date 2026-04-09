// Agency Group Service Worker v8.0
// v8: On activate, FORCE NAVIGATE all open tabs to get fresh HTML
// HTML pages: NEVER cached, NEVER served stale (no fallback to cache)
// Static assets: cache-first for performance

const CACHE_NAME = 'agency-group-v8';

self.addEventListener('install', (event) => {
  // Skip waiting immediately — activate right away, don't wait for old SW to die
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // NUCLEAR: force reload ALL open tabs to get fresh HTML
        // client.navigate() reloads the page — since this SW is now active,
        // the navigate request is fetched fresh from network (no-store below)
        // This breaks through ANY stale cache on the user's device
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(clients => {
            clients.forEach(client => {
              // Try navigate() first (forces page reload with fresh HTML)
              // Fall back to postMessage if navigate fails
              try {
                client.navigate(client.url).catch(() => {
                  client.postMessage({ type: 'SW_ACTIVATED_V8' });
                });
              } catch (e) {
                client.postMessage({ type: 'SW_ACTIVATED_V8' });
              }
            });
          });
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // HTML navigation requests — ALWAYS fresh from network, NO FALLBACK to cache
  // Critical: never serve stale HTML even on bad mobile connections
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
    );
    return;
  }

  // Static assets (JS chunks, CSS files, images) — cache-first for speed
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ─── Push Notification Handling ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Agency Group', body: event.data.text() }; }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    image: data.image,
    data: { url: data.url || '/' },
    actions: data.actions || [],
    tag: data.tag || 'ag-notification',
    requireInteraction: data.urgent || false,
    vibrate: [100, 50, 100],
    silent: false,
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Agency Group', options)
  );
});

// ─── Notification Click Handling ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// ─── Background Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-contacts') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  try {
    const cache = await caches.open('ag-offline-actions');
    const requests = await cache.keys();
    return Promise.all(
      requests.map(async req => {
        try { await fetch(req.clone()); await cache.delete(req); }
        catch { /* Keep for next sync */ }
      })
    );
  } catch { /* Fail silently */ }
}
