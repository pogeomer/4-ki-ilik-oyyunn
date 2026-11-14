// sw.js - iOS PWA Otomatik Güncelleme & Network-First Service Worker
const CACHE_NAME = 'cember-savunmasi-v5';

self.addEventListener('install', (event) => {
  // Yeni sürüm geldiği anda beklemeden aktif ol!
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Eski önbellekleri tamamen temizle
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Her zaman ÖNCE İNTERNETTEN (Vercel'den) en güncel dosyayı çek (cache: 'no-store')
  // Sadece internet yoksa önbellekteki yedekten aç.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((networkResponse) => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
