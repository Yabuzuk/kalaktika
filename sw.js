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
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Если приложение уже открыто, фокусируемся на нём
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Иначе открываем новое окно
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Обработка push сообщений
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Обновление заказа',
      icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
      badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
      vibrate: [300, 100, 300, 100, 300],
      silent: false,
      requireInteraction: true,
      tag: data.tag || 'default'
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || '🚛 Водовозка', options)
    );
  }
});