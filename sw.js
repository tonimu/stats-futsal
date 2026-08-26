// Service Worker mínimo para Stats Fútbol Sala.
// Objetivo: permitir que la app sea instalable como PWA y funcione offline.
// Los datos siguen en IndexedDB del navegador, este SW solo cachea archivos.

const CACHE_NAME = 'stats-futsal-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Limpiar cachés viejas de versiones anteriores
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Solo cachear GET
  if (req.method !== 'GET') return;
  // Estrategia: red primero, si falla o hay problemas usar caché.
  // Así siempre ves la última versión si tienes internet, pero funciona offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Solo cacheamos el propio dominio de la app
        if (res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Promise.reject()))
  );
});
