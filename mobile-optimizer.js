// Оптимизация для мобильного интернета
class MobileOptimizer {
    constructor() {
        this.connectionType = this.getConnectionType();
        this.isSlowConnection = this.isSlowConnection();
        this.init();
    }

    init() {
        if (this.isSlowConnection) {
            this.enableDataSaver();
        }
        this.optimizeImages();
        this.preloadCritical();
    }

    getConnectionType() {
        if ('connection' in navigator) {
            return navigator.connection.effectiveType;
        }
        return 'unknown';
    }

    isSlowConnection() {
        const slowTypes = ['slow-2g', '2g'];
        return slowTypes.includes(this.connectionType) || 
               (navigator.connection && navigator.connection.saveData);
    }

    enableDataSaver() {
        // Отключаем автозагрузку карт
        document.getElementById('selectOnMap').style.display = 'none';
        
        // Уменьшаем частоту обновлений
        this.reduceUpdateFrequency();
        
        // Показываем уведомление
        this.showDataSaverNotice();
    }

    reduceUpdateFrequency() {
        // Увеличиваем TTL кэша до 10 минут
        if (window.cache) {
            cache.ttl = 10 * 60 * 1000;
        }
    }

    optimizeImages() {
        // Заменяем тяжелые изображения на легкие
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (this.isSlowConnection) {
                img.loading = 'lazy';
            }
        });
    }

    preloadCritical() {
        // Предзагружаем только критичные ресурсы
        const critical = [
            '/styles.css',
            '/script.js'
        ];
        
        critical.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = url;
            link.as = url.endsWith('.css') ? 'style' : 'script';
            document.head.appendChild(link);
        });
    }

    showDataSaverNotice() {
        const notice = document.createElement('div');
        notice.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff9500;
            color: white;
            padding: 10px;
            text-align: center;
            font-size: 14px;
            z-index: 10000;
        `;
        notice.innerHTML = '📶 Медленное соединение - включен режим экономии трафика';
        document.body.appendChild(notice);
        
        setTimeout(() => notice.remove(), 5000);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    new MobileOptimizer();
});