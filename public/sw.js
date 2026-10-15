/*
 * Minimal service worker: makes the app installable and lets the shell open offline.
 * Network-first for pages (always fresh when online), cache-first for hashed static assets.
 * Web Push: see the `push` handler at the bottom — it is ready, but nothing sends pushes yet
 * (that needs the backend + VAPID keys; see src/floor/webPush.ts).
 */
const CACHE = 'gym-app-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (req.url.includes('/_expo/') || req.url.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        hit =>
          hit ||
          fetch(req).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
            return res;
          })
      )
    );
  }
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Power Gym Tunis', {
      body: data.body || '',
      icon: '/icons/icon.png',
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data || '/'));
});
