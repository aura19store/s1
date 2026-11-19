/* Only the generic offline screen is cached. Never cache pages, APIs, cart,
   checkout, account data, admin responses, or mutations. */
const OFFLINE_CACHE = 'aura-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('aura-offline-') && key !== OFFLINE_CACHE)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;
  event.respondWith(fetch(request).catch(async () =>
    (await caches.match(OFFLINE_URL)) || Response.error()
  ));
});
