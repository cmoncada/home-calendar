// Service worker de Home Calendar (PWA).
// - La app (HTML) se pide primero a la red; sin conexión se usa la última copia guardada.
// - Los archivos de /assets/ llevan hash en el nombre: se sirven desde caché para siempre.
// - Las fotos de perfil (/media/) se muestran desde caché y se actualizan en segundo plano.
// - La API (/api/) NUNCA pasa por la caché: los datos siempre son los del servidor.
// Sube VERSION si cambias este archivo de forma incompatible (borra las cachés antiguas).
const VERSION = 'v1';
const SHELL_CACHE = `hc-shell-${VERSION}`;
const ASSETS_CACHE = `hc-assets-${VERSION}`;
const MEDIA_CACHE = `hc-media-${VERSION}`;
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSETS_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hc-') && !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    // Es una SPA: cualquier ruta devuelve el mismo index.html, se guarda como "/"
    if (response.ok) cache.put('/', response.clone());
    return response;
  } catch {
    return (await cache.match('/')) ?? Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached ?? Response.error());
  return cached ?? network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // datos: siempre de la red

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
  } else if (url.pathname.startsWith('/media/')) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
  } else {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
  }
});
