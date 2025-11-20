// Дополнительное кэширование в Service Worker для мобильного интернета
const MOBILE_CACHE_NAME = 'kalaktika-mobile-v1';
const CRITICAL_RESOURCES = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/config.js',
  '/cache-manager.js',
  '/ui-loader.js',
  '/mobile-optimizer.js'
];

// Агрессивное кэширование для мобильных
self.addEventListener('fetch', event => {
  // Только для GET запросов
  if (event.request.method !== 'GET') return;
  
  // Пропускаем API запросы
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('yandex.ru')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        // Возвращаем из кэша немедленно
        return response;
      }
      
      // Для медленных соединений - кэшируем все
      return fetch(event.request).then(fetchResponse => {
        if (fetchResponse.status === 200) {
          const responseClone = fetchResponse.clone();
          caches.open(MOBILE_CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      }).catch(() => {
        // Офлайн фолбэк
        return caches.match('/index.html');
      });
    })
  );
});