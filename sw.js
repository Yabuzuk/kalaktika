const CACHE_NAME = 'kalaktika-v2';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './styles.css',
  './script.js',
  './config.js',
  './manifest.json',
  './admin.html',
  './admin-styles.css',
  './admin-script.js',
  './driver.html',
  './driver-styles.css',
  './driver-script.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Установка');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Кэширование файлов');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Ошибка кэширования', error);
      })
  );
});

// Обработка запросов
self.addEventListener('fetch', event => {
  // Пропускаем запросы к внешним API
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('yandex.ru') ||
      event.request.url.includes('sms.ru')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем кэшированную версию или загружаем из сети
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .catch(() => {
            // Если сеть недоступна, возвращаем главную страницу для SPA
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Обновление кэша
self.addEventListener('activate', event => {
  console.log('Service Worker: Активация');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Удаление старого кэша', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});