const CACHE = 'mantenimiento-puentes-grua-ant-v11';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // No interceptar solicitudes externas, por ejemplo Google Apps Script.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        // Siempre se pide la versión de red en paralelo y se guarda en caché,
        // haya o no una copia previa. Así la próxima apertura ya tiene la
        // versión nueva lista, sin esperar a que el navegador decida
        // invalidar el caché por su cuenta (el gap que tenía ANT-105).
        const network = fetch(e.request)
          .then(resp => {
            if (resp && resp.ok) cache.put(e.request, resp.clone());
            return resp;
          })
          .catch(() => null);

        if (cached) {
          // Responde de inmediato con lo que ya está en caché; la
          // actualización de red sigue en segundo plano sin bloquear esto.
          network;
          return cached;
        }

        // No hay nada cacheado todavía: hay que esperar la red.
        return network.then(resp => {
          if (resp) return resp;
          // El fallback a index.html se usa solo para navegación.
          if (e.request.mode === 'navigate') return cache.match('./index.html');
          throw new Error('Recurso no disponible offline');
        });
      })
    )
  );
});
