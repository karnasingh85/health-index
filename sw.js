const CACHE = 'health-index-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','/index.html','/manifest.json'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => { self.clients.claim(); });
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      return caches.open(CACHE).then(c => { c.put(e.request, resp.clone()); return resp; });
    }).catch(() => caches.match('/index.html')))
  );
});
