const CACHE_NAME = 'kalaktika-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/styles.css',
  '/script.js',
  '/config.js',
  '/admin.html',
  '/admin-styles.css',
  '/admin-script.js',
  '/driver.html',
  '/driver-styles.css',
  '/driver-script.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Обработка запросов
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем кэшированную версию или загружаем из сети
        return response || fetch(event.request);
      }
    )
  );
});

// Обновление кэша
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});