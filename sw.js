const CACHE_NAME = 'kalaktika-v5';
const MOBILE_CACHE_NAME = 'kalaktika-mobile-v1';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './styles.css',
  './script.js',
  './config.js',
  './manifest.json',
  './driver-manifest.json',
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

// Обработка запросов с оптимизацией для мобильного интернета
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
        // Возвращаем кэшированную версию немедленно
        if (response) {
          return response;
        }
        
        // Для мобильных - агрессивное кэширование
        return fetch(event.request)
          .then(fetchResponse => {
            if (fetchResponse.status === 200 && event.request.method === 'GET') {
              const responseClone = fetchResponse.clone();
              caches.open(MOBILE_CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return fetchResponse;
          })
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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const baseUrl = self.location.origin;
      
      // Проверяем, открыто ли приложение
      for (let client of clientList) {
        if (client.url.includes('driver.html') || client.url.includes('index.html') || client.url === baseUrl + '/') {
          return client.focus();
        }
      }
      
      // Определяем, какую страницу открывать
      let targetUrl = baseUrl + '/index.html';
      
      // Если уведомление для водителя
      if (event.notification.tag && event.notification.tag.includes('driver')) {
        targetUrl = baseUrl + '/driver.html';
      }
      
      return clients.openWindow(targetUrl);
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

// Фоновая синхронизация для проверки новых заказов
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(checkForNewOrders());
  }
});

// Периодическая фоновая синхронизация (только для установленных PWA)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-orders') {
    event.waitUntil(checkForNewOrders());
  }
});

// Альтернативный механизм - проверка при активации
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_ORDERS') {
    event.waitUntil(checkForNewOrders());
  }
  if (event.data && event.data.type === 'INIT_REALTIME') {
    initRealtimeConnection();
  }
});

// Supabase Realtime connection для альтернативы Periodic Sync
let realtimeChannel = null;

function initRealtimeConnection() {
  try {
    // Создаем WebSocket соединение с Supabase Realtime
    const wsUrl = 'wss://xflzsoruvmodqjsfvrwr.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbHpzb3J1dm1vZHFqc2Z2cndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzAwMDIsImV4cCI6MjA3OTAwNjAwMn0.CY5Za3yO0QH1x4ChjwvMVn1O9WmZIWF3QkfWoHF7WvU&vsn=1.0.0';
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('SW: Realtime подключен');
      
      // Подписываемся на изменения в таблице orders
      const joinMessage = {
        topic: 'realtime:public:orders',
        event: 'phx_join',
        payload: {},
        ref: '1'
      };
      
      ws.send(JSON.stringify(joinMessage));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Обрабатываем новые заказы
        if (data.event === 'INSERT' && data.payload && data.payload.record) {
          const order = data.payload.record;
          handleNewOrder(order);
        }
      } catch (error) {
        console.error('SW: Ошибка обработки Realtime сообщения:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('SW: Ошибка Realtime соединения:', error);
    };
    
    ws.onclose = () => {
      console.log('SW: Realtime соединение закрыто');
      // Переподключение через 5 секунд
      setTimeout(initRealtimeConnection, 5000);
    };
    
  } catch (error) {
    console.error('SW: Ошибка инициализации Realtime:', error);
  }
}

function handleNewOrder(order) {
  const serviceIcon = order.service_type === 'water' ? '💧' : '🚝';
  const serviceName = order.service_type === 'water' ? 'Доставка воды' : 'Откачка септика';
  
  self.registration.showNotification(`${serviceIcon} Новый заказ!`, {
    body: `${serviceName} от ${order.user_name}`,
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
    vibrate: [300, 100, 300, 100, 300],
    silent: false,
    requireInteraction: true,
    tag: `realtime-order-${order.id}`,
    data: { orderId: order.id, url: '/driver.html' }
  });
}

async function checkForNewOrders() {
  try {
    // Получаем последний ID заказа из кэша
    const cache = await caches.open('orders-cache');
    const lastOrderResponse = await cache.match('/last-order-id');
    let lastOrderId = 0;
    
    if (lastOrderResponse) {
      const data = await lastOrderResponse.json();
      lastOrderId = data.id;
    }
    
    // Проверяем новые заказы через Supabase REST API
    const response = await fetch('https://xflzsoruvmodqjsfvrwr.supabase.co/rest/v1/orders?select=id,service_type,user_name,created_at&order=id.desc&limit=1', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbHpzb3J1dm1vZHFqc2Z2cndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzAwMDIsImV4cCI6MjA3OTAwNjAwMn0.CY5Za3yO0QH1x4ChjwvMVn1O9WmZIWF3QkfWoHF7WvU',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmbHpzb3J1dm1vZHFqc2Z2cndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzAwMDIsImV4cCI6MjA3OTAwNjAwMn0.CY5Za3yO0QH1x4ChjwvMVn1O9WmZIWF3QkfWoHF7WvU'
      }
    });
    
    if (response.ok) {
      const orders = await response.json();
      
      if (orders.length > 0) {
        const latestOrder = orders[0];
        
        // Если есть новый заказ
        if (latestOrder.id > lastOrderId) {
          const serviceIcon = latestOrder.service_type === 'water' ? '💧' : '🚝';
          const serviceName = latestOrder.service_type === 'water' ? 'Доставка воды' : 'Откачка септика';
          
          // Показываем уведомление
          await self.registration.showNotification(`${serviceIcon} Новый заказ!`, {
            body: `${serviceName} от ${latestOrder.user_name}`,
            icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
            badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
            vibrate: [300, 100, 300, 100, 300],
            silent: false,
            requireInteraction: true,
            tag: `new-order-${latestOrder.id}`,
            data: { orderId: latestOrder.id, url: '/driver.html' }
          });
          
          // Сохраняем новый последний ID
          await cache.put('/last-order-id', new Response(JSON.stringify({ id: latestOrder.id })));
        }
      }
    }
    
  } catch (error) {
    console.error('Ошибка фоновой синхронизации:', error);
  }
}