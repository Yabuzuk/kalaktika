// Глобальные переменные
let currentFilter = 'all';
let orders = [];
let driverId = null;
let currentDate = new Date();
let notificationInterval = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    await initializeDriver();
    setupEventListeners();
    loadOrders();
    
    // Запрашиваем разрешение на уведомления
    requestNotificationPermission();
    
    // PWA установка для водителей
    setupDriverPWA();
    
    // Подписка на изменения заказов
    subscribeToDriverOrderUpdates();
    
    // Проверка напоминаний каждую минуту
    notificationInterval = setInterval(checkReminders, 60000);
    
    // Инициализация календаря
    initCalendar();
    
    // Проверяем доступность Яндекс.Карт
    setTimeout(() => {
        if (typeof ymaps === 'undefined') {
            console.warn('Яндекс.Карты API не загрузился');
        } else {
            console.log('Яндекс.Карты API успешно загружен');
        }
    }, 2000);
});

function subscribeToDriverOrderUpdates() {
    // Подписка на все изменения заказов
    supabaseClient
        .channel('driver-orders')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders'
        }, (payload) => {
            console.log('Изменение заказа для водителя:', payload);
            
            // Обновляем данные
            setTimeout(() => {
                loadOrders();
            }, 500);
            
            // Показываем уведомления
            if (payload.eventType === 'INSERT') {
                playNotificationSound();
                
                // Проверяем разрешение перед отправкой
                if (Notification.permission === 'granted') {
                    showBrowserNotification('Новый заказ!', 'Поступил новый заказ на выполнение');
                } else {
                    console.log('Нет разрешения на уведомления');
                }
                
                showDriverNotification('Новый заказ поступил!', 'info');
            } else if (payload.eventType === 'UPDATE') {
                const order = payload.new;
                if (order && order.id) {
                    showDriverNotification(`Заказ #${order.id} обновлен`, 'info');
                }
            }
        })
        .subscribe();
        
    // Автообновление каждые 30 секунд
    setInterval(() => {
        loadOrders();
    }, 30000);
}

function showDriverNotification(message, type = 'info') {
    let container = document.querySelector('.notifications');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notifications';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        background: #667eea;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        margin-bottom: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    
    if (type === 'warning') {
        notification.style.background = '#ffc107';
        notification.style.color = '#333';
    } else if (type === 'error') {
        notification.style.background = '#dc3545';
    }
    
    notification.textContent = message;
    container.appendChild(notification);
    
    // Удаляем через 4 секунды
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

async function initializeDriver() {
    // Проверяем авторизацию водителя
    driverId = localStorage.getItem('driverId');
    const driverName = localStorage.getItem('driverName') || 'Водитель';
    
    if (!driverId) {
        window.location.href = 'driver-login.html';
        return;
    }
    
    // Проверяем статус водителя
    try {
        const { data: driver, error } = await supabaseClient
            .from('drivers')
            .select('status, full_name')
            .eq('id', driverId)
            .single();
            
        if (error || !driver) {
            alert('Водитель не найден');
            logout();
            return;
        }
        
        if (driver.status === 'blocked') {
            alert('Ваш аккаунт заблокирован. Обратитесь к администратору.');
            logout();
            return;
        }
        
        if (driver.status === 'pending') {
            alert('Ваш аккаунт ожидает активации администратором.');
            logout();
            return;
        }
        
        document.getElementById('driverName').textContent = driver.full_name;
        
    } catch (error) {
        console.error('Ошибка проверки статуса:', error);
        logout();
    }
}

function setupEventListeners() {
    // Кнопка обновления
    document.getElementById('refreshBtn').addEventListener('click', loadOrders);
    
    // Кнопка теста уведомлений
    document.getElementById('testNotificationBtn').addEventListener('click', function() {
        playNotificationSound();
        showBrowserNotification('Тестовое уведомление', 'Проверка работы уведомлений');
        showDriverNotification('Тест уведомлений пройден!', 'info');
    });
    
    // Фильтры
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.status;
            renderOrders();
        });
    });
    
    // Модальные окна
    document.querySelector('.close').addEventListener('click', closeModal);
    document.querySelector('.close-day').addEventListener('click', closeDayModal);
    document.querySelector('.close-map').addEventListener('click', closeMapModal);
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Календарь
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
}

async function loadOrders() {
    try {
        const currentDriverId = localStorage.getItem('driverId');
        
        // Загружаем только заказы текущего водителя или новые заказы
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
            .or(`driver_id.eq.${currentDriverId},driver_id.is.null`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        orders = data || [];
        renderOrders();
        updateStats();
        renderCalendar();
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

function renderOrders() {
    const ordersList = document.getElementById('ordersList');
    let filteredOrders = orders;
    
    if (currentFilter !== 'all') {
        filteredOrders = orders.filter(order => order.status === currentFilter);
    }
    
    if (filteredOrders.length === 0) {
        ordersList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Заказов не найдено</div>';
        return;
    }
    
    ordersList.innerHTML = filteredOrders.map(order => createOrderCard(order)).join('');
    
    // Добавляем обработчики событий
    document.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Проверяем, не кликнули ли по кнопке
            if (e.target.classList.contains('btn')) {
                e.stopPropagation();
                return;
            }
            
            const orderId = this.dataset.orderId;
            showOrderDetails(orderId);
        });
    });
    
    // Обработчики для кнопок принятия/отклонения
    document.querySelectorAll('.btn-accept, .btn-cancel').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const orderId = this.dataset.orderId;
            const action = this.dataset.action;
            
            if (action === 'accept') {
                updateOrderStatus(orderId, 'confirmed');
            } else if (action === 'decline') {
                updateOrderStatus(orderId, 'cancelled');
            }
        });
    });
}

function createOrderCard(order) {
    const serviceIcon = order.service_type === 'water' ? '💧' : '🚽';
    const serviceName = order.service_type === 'water' ? 'Доставка воды' : 'Откачка септика';
    const statusText = getStatusText(order.status);
    
    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <div class="order-id">${serviceIcon} Заказ #${order.id}</div>
                <div class="order-status status-${order.status}">${statusText}</div>
            </div>
            
            <div class="order-info">
                <div class="info-item">
                    <div class="info-label">Услуга:</div>
                    <div class="info-value">${serviceName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Кол-во:</div>
                    <div class="info-value">${order.quantity} ${order.service_type === 'water' ? 'куб.м' : 'выезд'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Адрес:</div>
                    <div class="info-value">${order.address}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Время:</div>
                    <div class="info-value">${formatDateTime(order.delivery_date, order.delivery_time)}</div>
                </div>
            </div>
            
            <div class="order-actions">
                ${getActionButtons(order)}
                <button class="btn btn-map" onclick="showOrderMap(${order.id})">📍 Карта</button>
            </div>
        </div>
    `;
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Новый',
        'confirmed': 'Принят',
        'in_progress': 'В работе',
        'completed': 'Выполнен',
        'cancelled': 'Отменен'
    };
    return statusMap[status] || status;
}

function getActionButtons(order) {
    switch (order.status) {
        case 'pending':
            return `
                <button class="btn btn-accept" data-order-id="${order.id}" data-action="accept">Принять</button>
                <button class="btn btn-cancel" data-order-id="${order.id}" data-action="decline">Отклонить</button>
            `;
        case 'confirmed':
            return `
                <button class="btn btn-start" onclick="updateOrderStatus(${order.id}, 'in_progress')">Начать работу</button>
                <button class="btn btn-cancel" onclick="updateOrderStatus(${order.id}, 'cancelled')">Отменить</button>
            `;
        case 'in_progress':
            return `
                <button class="btn btn-complete" onclick="updateOrderStatus(${order.id}, 'completed')">Завершить</button>
            `;
        default:
            return '';
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        // Проверяем статус водителя перед принятием заказа
        if (newStatus === 'confirmed') {
            const { data: driver, error: driverError } = await supabaseClient
                .from('drivers')
                .select('status')
                .eq('id', driverId)
                .single();
                
            if (driverError || !driver) {
                alert('Ошибка проверки статуса водителя');
                return;
            }
            
            if (driver.status !== 'active') {
                alert('Вы не можете принимать заказы. Обратитесь к администратору.');
                return;
            }
        }
        
        const updateData = { 
            status: newStatus,
            updated_at: new Date().toISOString()
        };
        
        // Если заказ принимается, добавляем водителя
        if (newStatus === 'confirmed') {
            updateData.driver_id = driverId;
        }
        
        const { error } = await supabaseClient
            .from('orders')
            .update(updateData)
            .eq('id', orderId);

        if (error) throw error;
        
        // Обновляем локальные данные немедленно
        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex !== -1) {
            orders[orderIndex].status = newStatus;
            orders[orderIndex].updated_at = new Date().toISOString();
            if (newStatus === 'confirmed') {
                orders[orderIndex].driver_id = driverId;
            }
        }
        
        // Мгновенно обновляем интерфейс
        renderOrders();
        updateStats();
        renderCalendar();
        
        // Показываем уведомление
        showNotification(`Заказ #${orderId} ${getStatusText(newStatus).toLowerCase()}`);
        
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        alert('Ошибка при обновлении заказа');
    }
}

function formatDateTime(date, time) {
    const orderDate = new Date(date + 'T' + time);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dateStr;
    if (orderDate.toDateString() === today.toDateString()) {
        dateStr = 'Сегодня';
    } else if (orderDate.toDateString() === tomorrow.toDateString()) {
        dateStr = 'Завтра';
    } else {
        dateStr = orderDate.toLocaleDateString('ru-RU');
    }
    
    return `${dateStr} в ${time}`;
}

function updateStats() {
    const currentDriverId = localStorage.getItem('driverId');
    
    // Новые заказы (без водителя)
    const newOrders = orders.filter(order => 
        order.status === 'pending' && !order.driver_id
    ).length;
    
    // Активные заказы водителя
    const activeOrders = orders.filter(order => 
        order.driver_id == currentDriverId &&
        (order.status === 'confirmed' || order.status === 'in_progress')
    ).length;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Все выполненные заказы водителя
    const allCompletedOrders = orders.filter(order => 
        order.driver_id == currentDriverId &&
        order.status === 'completed'
    );
    
    // Выполненные сегодня
    const completedToday = allCompletedOrders.filter(order => 
        order.delivery_date === today
    );
    
    // Общая статистика (все время)
    const totalAllEarnings = allCompletedOrders.reduce((sum, order) => sum + order.price, 0);
    const totalCommission = Math.round(totalAllEarnings * 0.1);
    const totalDriverEarnings = totalAllEarnings - totalCommission;
    
    // Статистика за сегодня
    const todayTotalEarnings = completedToday.reduce((sum, order) => sum + order.price, 0);
    const todayCommission = Math.round(todayTotalEarnings * 0.1);
    const todayEarnings = todayTotalEarnings - todayCommission;
    
    document.getElementById('newOrdersCount').textContent = newOrders;
    document.getElementById('activeOrdersCount').textContent = activeOrders;
    document.getElementById('totalCompletedCount').textContent = allCompletedOrders.length;
    document.getElementById('totalEarnings').textContent = totalDriverEarnings.toLocaleString() + ' ₽';
    document.getElementById('totalCommission').textContent = totalCommission.toLocaleString() + ' ₽';
    document.getElementById('todayEarnings').textContent = todayEarnings.toLocaleString() + ' ₽';
}

function showOrderDetails(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    const serviceIcon = order.service_type === 'water' ? '💧' : '🚽';
    const serviceName = order.service_type === 'water' ? 'Доставка воды' : 'Откачка септика';
    
    const detailsHtml = `
        <h3>${serviceIcon} Заказ #${order.id}</h3>
        <div style="margin: 20px 0;">
            <p><strong>Услуга:</strong> ${serviceName}</p>
            <p><strong>Количество:</strong> ${order.quantity} ${order.service_type === 'water' ? 'куб.м' : 'выезд'}</p>
            <p><strong>Адрес:</strong> ${order.address}</p>
            <p><strong>Дата и время:</strong> ${formatDateTime(order.delivery_date, order.delivery_time)}</p>
            <p><strong>Клиент:</strong> ${order.user_name}</p>
            <p><strong>Телефон:</strong> ${order.user_phone}</p>
            <p><strong>Стоимость:</strong> ${order.price.toLocaleString()} ₽</p>
            <p><strong>Статус:</strong> ${getStatusText(order.status)}</p>
            <p><strong>Создан:</strong> ${new Date(order.created_at).toLocaleString('ru-RU')}</p>
        </div>
        <div style="text-align: center; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            ${getActionButtons(order)}
            <button class="btn btn-map" onclick="showOrderMap(${order.id})">📍 Карта</button>
            <button class="btn btn-navigate" onclick="navigateToOrder('Мирный, ${order.address}')">📍 Маршрут</button>
        </div>
    `;
    
    document.getElementById('orderDetails').innerHTML = detailsHtml;
    document.getElementById('orderModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
}

function closeDayModal() {
    document.getElementById('dayOrdersModal').style.display = 'none';
}

function showOrderDetailsFromCalendar(orderId) {
    // Закрываем модальное окно дня
    closeDayModal();
    
    // Открываем детали заказа
    setTimeout(() => {
        showOrderDetails(orderId);
    }, 100);
}

function showDayOrders(dateStr) {
    const dayOrders = orders.filter(order => {
        return order.delivery_date === dateStr;
    });
    
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = date.toLocaleDateString('ru-RU', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    let content = `<h3>📅 ${dayName}</h3>`;
    
    if (dayOrders.length === 0) {
        content += '<p style="text-align: center; color: #666; margin: 40px 0;">На этот день заказов нет</p>';
    } else {
        content += '<div class="day-orders-list">';
        
        // Сортируем по времени
        dayOrders.sort((a, b) => a.delivery_time.localeCompare(b.delivery_time));
        
        dayOrders.forEach(order => {
            const serviceIcon = order.service_type === 'water' ? '💧' : '🚽';
            const serviceName = order.service_type === 'water' ? 'Доставка воды' : 'Откачка септика';
            const statusText = getStatusText(order.status);
            
            content += `
                <div class="day-order-card" onclick="showOrderDetailsFromCalendar(${order.id})">
                    <div class="day-order-header">
                        <div class="day-order-title">${serviceIcon} Заказ #${order.id}</div>
                        <div class="day-order-time">${order.delivery_time.slice(0, 5)}</div>
                    </div>
                    <div class="day-order-info">
                        <div><strong>Услуга:</strong> ${serviceName}</div>
                        <div><strong>Адрес:</strong> ${order.address}</div>
                        <div><strong>Клиент:</strong> ${order.user_name} (${order.user_phone})</div>
                        <div><strong>Статус:</strong> <span class="order-status status-${order.status}">${statusText}</span></div>
                        <div><strong>Стоимость:</strong> ${order.price.toLocaleString()} ₽</div>
                    </div>
                </div>
            `;
        });
        
        content += '</div>';
    }
    
    document.getElementById('dayOrdersContent').innerHTML = content;
    document.getElementById('dayOrdersModal').style.display = 'block';
}

function showNotification(message) {
    // Простое уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function logout() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
    }
    localStorage.removeItem('driverId');
    localStorage.removeItem('driverName');
    window.location.href = 'driver-login.html';
}

// Календарь
function initCalendar() {
    renderCalendar();
}

function renderCalendar() {
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    
    document.getElementById('currentMonth').textContent = 
        `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
    
    let calendarHtml = '<div class="calendar-grid">';
    
    // Заголовки дней недели
    dayNames.forEach(day => {
        calendarHtml += `<div class="calendar-header">${day}</div>`;
    });
    
    // Дни месяца
    const today = new Date();
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
        const isToday = date.toDateString() === today.toDateString();
        const dayOrders = getOrdersForDate(date);
        
        let dayClass = 'calendar-day';
        if (!isCurrentMonth) dayClass += ' other-month';
        if (isToday) dayClass += ' today';
        
        calendarHtml += `
            <div class="${dayClass}" data-date="${dateStr}" onclick="showDayOrders('${dateStr}')">
                <div class="day-number">${date.getDate()}</div>
                <div class="day-orders">
                    ${dayOrders.map(order => 
                        `<div class="order-dot ${order.service_type}" title="${order.service_type === 'water' ? 'Вода' : 'Септик'} ${order.delivery_time}">
                            ${order.delivery_time.slice(0, 5)}
                        </div>`
                    ).join('')}
                </div>
            </div>
        `;
    }
    
    calendarHtml += '</div>';
    document.getElementById('calendar').innerHTML = calendarHtml;
}

function getOrdersForDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const currentDriverId = localStorage.getItem('driverId');
    
    return orders.filter(order => {
        // Сравниваем только дату без времени
        const orderDate = order.delivery_date;
        return orderDate === dateStr && 
               order.driver_id == currentDriverId &&
               (order.status === 'confirmed' || order.status === 'in_progress');
    });
}

// Напоминания
function checkReminders() {
    const now = new Date();
    const in30Minutes = new Date(now.getTime() + 30 * 60000);
    const in60Minutes = new Date(now.getTime() + 60 * 60000);
    
    orders.forEach(order => {
        if (order.status !== 'confirmed' && order.status !== 'in_progress') return;
        
        const orderDateTime = new Date(order.delivery_date + 'T' + order.delivery_time);
        
        // Напоминание за час
        if (orderDateTime <= in60Minutes && orderDateTime > in30Minutes) {
            if (!order.reminder_60_sent) {
                showReminder(`Заказ #${order.id} через 1 час`, 'warning');
                order.reminder_60_sent = true;
            }
        }
        
        // Напоминание за 30 минут
        if (orderDateTime <= in30Minutes && orderDateTime > now) {
            if (!order.reminder_30_sent) {
                showReminder(`Заказ #${order.id} через 30 минут!`, 'error');
                order.reminder_30_sent = true;
            }
        }
    });
}

function showReminder(message, type = 'info') {
    let container = document.querySelector('.notifications');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notifications';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Функции для уведомлений
async function requestNotificationPermission() {
    if ('Notification' in window) {
        // На мобильных требуется пользовательское взаимодействие
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            showDriverNotificationButton();
            return;
        }
        
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('Разрешение на уведомления:', permission);
        }
        console.log('Текущий статус уведомлений:', Notification.permission);
    } else {
        console.log('Браузер не поддерживает уведомления');
    }
}

function showDriverNotificationButton() {
    if (Notification.permission === 'granted') return;
    
    const notifBtn = document.createElement('button');
    notifBtn.textContent = '🔔 Включить уведомления';
    notifBtn.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        right: 20px;
        background: #ff6b35;
        color: white;
        border: none;
        padding: 15px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        z-index: 10000;
        animation: pulse 2s infinite;
    `;
    
    notifBtn.addEventListener('click', async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            notifBtn.remove();
            showBrowserNotification('✅ Уведомления включены!', 'Теперь вы будете получать уведомления о новых заказах');
        }
    });
    
    document.body.appendChild(notifBtn);
}

function playNotificationSound() {
    try {
        // Простой звук через Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
        
        console.log('Звуковое уведомление воспроизведено');
    } catch (error) {
        console.error('Ошибка воспроизведения звука:', error);
    }
}

function showBrowserNotification(title, body) {
    console.log('Попытка показать уведомление:', title, body);
    console.log('Статус разрешения:', Notification.permission);
    
    if (Notification.permission !== 'granted') {
        console.log('Нет разрешения на уведомления');
        return;
    }
    
    // Push уведомление через Service Worker (приоритет)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            console.log('Отправка через Service Worker');
            registration.showNotification(title, {
                body: body,
                icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
                badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
                vibrate: [300, 100, 300, 100, 300],
                silent: false,
                requireInteraction: true,
                tag: 'driver-notification-' + Date.now()
            });
        }).catch(error => {
            console.error('Ошибка Service Worker:', error);
            // Фолбэк на обычное уведомление
            fallbackNotification(title, body);
        });
    } else {
        fallbackNotification(title, body);
    }
}

function fallbackNotification(title, body) {
    try {
        console.log('Отправка обычного уведомления');
        const notification = new Notification(title, {
            body: body,
            icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
            requireInteraction: true
        });
        
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
        
        setTimeout(() => notification.close(), 8000);
        
    } catch (error) {
        console.error('Ошибка создания уведомления:', error);
    }
}
    
    // Дублируем обычным уведомлением
    if (!('Notification' in window)) {
        console.log('Браузер не поддерживает уведомления');
        return;
    }
    
    if (Notification.permission === 'granted') {
        try {
            const notification = new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
                requireInteraction: true
            });
            
            console.log('Уведомление создано');
            
            // Автозакрытие через 8 секунд
            setTimeout(() => {
                notification.close();
            }, 8000);
            
            // Клик по уведомлению
            notification.onclick = function() {
                window.focus();
                notification.close();
            };
            
        } catch (error) {
            console.error('Ошибка создания уведомления:', error);
        }
    } else {
        console.log('Нет разрешения на уведомления. Текущий статус:', Notification.permission);
    }
}

// Переменные для карты
let orderMap = null;
let currentOrderForMap = null;
let driverLocation = null;
let routeControl = null;

// Функции для карты и навигации
function showOrderMap(orderId) {
    const order = orders.find(o => o.id == orderId);
    if (!order) return;
    
    currentOrderForMap = order;
    document.getElementById('mapTitle').textContent = `📍 Заказ #${order.id} - ${order.address}`;
    document.getElementById('mapModal').style.display = 'block';
    
    // Инициализируем карту через небольшую задержку
    setTimeout(() => {
        initOrderMap(order);
    }, 300);
}

function initOrderMap(order) {
    console.log('Инициализация карты для заказа:', order);
    
    if (typeof ymaps === 'undefined') {
        console.error('ymaps не определен');
        document.getElementById('orderMap').innerHTML = '<div style="padding: 50px; text-align: center; color: #666;"><h3>Карты недоступны</h3><p>Проверьте интернет-соединение и перезагрузите страницу</p></div>';
        return;
    }
    
    ymaps.ready(() => {
        // Удаляем старую карту
        if (orderMap) {
            orderMap.destroy();
        }
        
        // Создаем новую карту
        orderMap = new ymaps.Map('orderMap', {
            center: [62.5354, 113.9607], // Мирный
            zoom: 13,
            controls: ['zoomControl', 'fullscreenControl']
        });
        
        // Находим адрес заказа в Мирном
        const fullAddress = `Мирный, ${order.address}`;
        ymaps.geocode(fullAddress).then(result => {
            const firstGeoObject = result.geoObjects.get(0);
            if (firstGeoObject) {
                const coords = firstGeoObject.geometry.getCoordinates();
                
                // Добавляем метку заказа
                const orderPlacemark = new ymaps.Placemark(coords, {
                    balloonContent: `<strong>Заказ #${order.id}</strong><br>${order.address}`,
                    hintContent: order.address
                }, {
                    preset: 'islands#redDotIcon'
                });
                
                orderMap.geoObjects.add(orderPlacemark);
                orderMap.setCenter(coords, 15);
                
                // Автоматически строим маршрут
                buildRouteAutomatically(coords);
            }
        });
        
        // Настраиваем обработчики кнопок
        document.getElementById('myLocationBtn').onclick = () => showMyLocation();
    });
}

function buildRouteAutomatically(orderCoords) {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            position => {
                driverLocation = [position.coords.latitude, position.coords.longitude];
                
                // Строим маршрут автоматически
                ymaps.route([driverLocation, orderCoords], {
                    mapStateAutoApply: true,
                    routingMode: 'auto'
                }).then(route => {
                    orderMap.geoObjects.add(route);
                    
                    // Добавляем метку водителя
                    const driverPlacemark = new ymaps.Placemark(driverLocation, {
                        balloonContent: 'Ваше местоположение',
                        hintContent: 'Вы здесь'
                    }, {
                        preset: 'islands#blueDotIcon'
                    });
                    
                    orderMap.geoObjects.add(driverPlacemark);
                    
                    // Показываем все объекты на карте
                    orderMap.setBounds(orderMap.geoObjects.getBounds(), {
                        checkZoomRange: true,
                        zoomMargin: 50
                    });
                }).catch(error => {
                    console.error('Ошибка построения маршрута:', error);
                });
            },
            error => {
                console.log('Не удалось определить местоположение водителя');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    }
}

function showMyLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const coords = [position.coords.latitude, position.coords.longitude];
                orderMap.setCenter(coords, 16);
                
                // Добавляем метку текущего местоположения
                const myPlacemark = new ymaps.Placemark(coords, {
                    balloonContent: 'Ваше текущее местоположение',
                    hintContent: 'Вы здесь'
                }, {
                    preset: 'islands#geolocationIcon'
                });
                
                orderMap.geoObjects.add(myPlacemark);
            },
            error => {
                alert('Не удалось определить ваше местоположение');
            }
        );
    }
}

function closeMapModal() {
    document.getElementById('mapModal').style.display = 'none';
    if (orderMap) {
        orderMap.destroy();
        orderMap = null;
    }
}

function navigateToOrder(address) {
    // Оставляем для совместимости
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                const routeUrl = `https://yandex.ru/maps/?rtext=${lat},${lon}~${encodeURIComponent(address)}&rtt=auto`;
                window.open(routeUrl, '_blank');
            },
            function(error) {
                const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(address)}&mode=search`;
                window.open(mapUrl, '_blank');
            }
        );
    } else {
        const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(address)}&mode=search`;
        window.open(mapUrl, '_blank');
    }
}

// PWA для водителей
let driverDeferredPrompt;

function setupDriverPWA() {
    // Слушаем событие beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        driverDeferredPrompt = e;
        showInstallButton();
    });
    
    // Проверяем, установлено ли приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('CRM водителя уже установлено');
    }
}

function showInstallButton() {
    const installBtn = document.createElement('button');
    installBtn.textContent = '📱 Установить CRM';
    installBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        font-weight: 600;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
    `;
    
    installBtn.addEventListener('click', async () => {
        if (driverDeferredPrompt) {
            driverDeferredPrompt.prompt();
            const { outcome } = await driverDeferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('CRM водителя установлено');
                installBtn.remove();
            }
            
            driverDeferredPrompt = null;
        }
    });
    
    document.body.appendChild(installBtn);
}