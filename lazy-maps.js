// Ленивая загрузка Яндекс.Карт
class LazyMaps {
    constructor() {
        this.loaded = false;
        this.loading = false;
        this.callbacks = [];
    }

    async load() {
        if (this.loaded) return true;
        if (this.loading) {
            return new Promise(resolve => {
                this.callbacks.push(resolve);
            });
        }

        this.loading = true;
        UILoader.showProgress(0);

        try {
            // Проверяем соединение
            if (!navigator.onLine) {
                throw new Error('Нет интернета');
            }

            // Загружаем API только при необходимости
            if (typeof ymaps === 'undefined') {
                UILoader.showProgress(30);
                await this.loadScript();
            }

            UILoader.showProgress(60);
            
            // Ждем готовности API
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
                
                ymaps.ready(() => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            UILoader.showProgress(100);
            this.loaded = true;
            this.loading = false;
            
            // Вызываем все ожидающие колбэки
            this.callbacks.forEach(callback => callback(true));
            this.callbacks = [];
            
            return true;

        } catch (error) {
            console.error('Ошибка загрузки карт:', error);
            this.loading = false;
            
            // Уведомляем об ошибке
            this.callbacks.forEach(callback => callback(false));
            this.callbacks = [];
            
            return false;
        } finally {
            UILoader.hideProgress();
        }
    }

    loadScript() {
        return new Promise((resolve, reject) => {
            // Проверяем скорость соединения
            if (navigator.connection && navigator.connection.effectiveType === 'slow-2g') {
                reject(new Error('Очень медленное соединение'));
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://api-maps.yandex.ru/2.1/?apikey=63c21778-deb0-4a95-bc2a-fb4d2dd46449&lang=ru_RU';
            script.onload = resolve;
            script.onerror = reject;
            
            // Таймаут для медленных соединений
            const timeout = setTimeout(() => {
                reject(new Error('Таймаут загрузки карт'));
            }, 15000);
            
            script.onload = () => {
                clearTimeout(timeout);
                resolve();
            };
            
            document.head.appendChild(script);
        });
    }

    // Проверка поддержки на мобильных
    isMobileOptimal() {
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSlowConnection = navigator.connection && navigator.connection.effectiveType === 'slow-2g';
        
        return !isMobile || !isSlowConnection;
    }
}

const lazyMaps = new LazyMaps();