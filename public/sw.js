// Agency Group Service Worker v9.0
// v9: REMOVED client.navigate() nuclear reload from activate.
//     The forced-reload was causing green flash on Android:
//     skipWaiting() activates the SW mid-render → client.navigate() reloads
//     the page → browser shows background color during reload transition.
// v9 strategy: soft activate only. HTML is always fresh (no-store fetch).
//              Stale-HTML recovery is handled by the self-heal script in layout.tsx.

const CACHE_NAME = 'agency-group-v9';

self.addEventListener('install', (event) => {
  // Skip waiting immediately — activate right away
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      // claim() takes control of open tabs without forcing a reload.
      // The page will use this SW on the NEXT navigation, not the current one.
      .then(() => self.clients.claim())
      // v9: NO client.navigate() — removed to prevent green flash on Android.
      // Rationale: client.navigate() fires mid-render, causing Chrome to briefly
      // show the html/body background colour (#0c1f15 / dark green) between pages.
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // HTML navigation requests — ALWAYS fresh from network, NO FALLBACK to cache.
  // Critical: never serve stale HTML even on bad mobile connections.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
    );
    return;
  }

  // Static assets (JS chunks, CSS files, images) — cache-first for speed.
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
