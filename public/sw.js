// Service worker mínimo: permite usar la app sin conexión tras la primera visita.
//  - Navegaciones: red primero, caché como respaldo.
//  - /assets/* (nombres con hash, inmutables): caché primero.
//  - Resto de recursos propios: se sirve la copia en caché y se revalida en segundo plano
//    (así una corrección en theme-init.js, el manifiesto, etc. llega sin quedarse "congelada").
// Solo se cachean respuestas correctas del propio origen.
const CACHE = 'diferenciaitor-v3';
const PRECACHE = ['/', '/acerca-de', '/privacidad', '/favicon.svg', '/manifest.webmanifest'];

const cacheable = (res) => res && res.ok && res.type === 'basic';

self.addEventListener('install', (event) => {
  // Una por una: si alguna ruta falla, no se invalida toda la instalación.
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url)))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        // Sin conexión: la página pedida si está en caché; si no, la portada (la app enruta por la URL).
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (cacheable(res)) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (cacheable(res)) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    ),
  );
});
