// Simple offline-first service worker
const CACHE = "ruota-cl-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./sw.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE) ? null : caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;
  // For navigation requests (HTML pages), prefer network first so index.html updates quickly
  const accept = req.headers.get('Accept') || '';
  if (req.mode === 'navigate' || accept.indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(req).then((res) => {
        // Update cache with latest HTML
        if (req.method === 'GET' && res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./') || caches.match('/index.html') || new Response('Offline', { status: 503 }))
    );
    return;
  }

  // For other requests, use cache-first strategy
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache any GET same-origin response for resiliency
        if (req.method === "GET" && res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }));
    })
  );
});
