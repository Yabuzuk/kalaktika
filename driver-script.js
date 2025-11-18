// Глобальные переменные
let currentFilter = 'all';
let orders = [];
let driverId = null;
let currentDate = new Date();
let notificationInterval = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeDriver();
    setupEventListeners();
    loadOrders();
    
    // Автообновление каждые 30 секунд
    setInterval(loadOrders, 30000);
    
    // Проверка напоминаний каждую минуту
    notificationInterval = setInterval(checkReminders, 60000);
    
    // Инициализация календаря
    initCalendar();
});

function initializeDriver() {
    // Проверяем авторизацию водителя
    driverId = localStorage.getItem('driverId') || 'driver_' + Date.now();
    const driverName = localStorage.getItem('driverName') || 'Водитель';
    
    document.getElementById('driverName').textContent = driverName;
    localStorage.setItem('driverId', driverId);
}

function setupEventListeners() {
    // Кнопка обновления
    document.getElementById('refreshBtn').addEventListener('click', loadOrders);
    
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
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
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
        card.addEventListener('click', function() {
            const orderId = this.dataset.orderId;
            showOrderDetails(orderId);
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
                    <div class="info-label">Услуга</div>
                    <div class="info-value">${serviceName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Количество</div>
                    <div class="info-value">${order.quantity} ${order.service_type === 'water' ? 'куб.м' : 'выезд'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Адрес</div>
                    <div class="info-value">${order.address}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Время</div>
                    <div class="info-value">${formatDateTime(order.delivery_date, order.delivery_time)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Клиент</div>
                    <div class="info-value">${order.user_name}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Стоимость</div>
                    <div class="info-value">${order.price.toLocaleString()} ₽</div>
                </div>
            </div>
            
            <div class="order-actions">
                ${getActionButtons(order)}
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
                <button class="btn btn-accept" onclick="updateOrderStatus(${order.id}, 'confirmed')">Принять</button>
                <button class="btn btn-cancel" onclick="updateOrderStatus(${order.id}, 'cancelled')">Отклонить</button>
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
        
        // Обновляем локальные данные
        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex !== -1) {
            orders[orderIndex].status = newStatus;
            if (newStatus === 'confirmed') {
                orders[orderIndex].driver_id = driverId;
            }
        }
        
        renderOrders();
        updateStats();
        
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
    const newOrders = orders.filter(order => order.status === 'pending').length;
    const activeOrders = orders.filter(order => 
        order.status === 'confirmed' || order.status === 'in_progress'
    ).length;
    
    const today = new Date().toISOString().split('T')[0];
    const completedToday = orders.filter(order => 
        order.status === 'completed' && 
        order.delivery_date === today
    );
    
    const todayEarnings = completedToday.reduce((sum, order) => sum + order.price, 0);
    
    document.getElementById('newOrdersCount').textContent = newOrders;
    document.getElementById('activeOrdersCount').textContent = activeOrders;
    document.getElementById('completedTodayCount').textContent = completedToday.length;
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
        <div style="text-align: center;">
            ${getActionButtons(order)}
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
                <div class="day-order-card" onclick="showOrderDetails(${order.id})">
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
    
    return orders.filter(order => {
        // Сравниваем только дату без времени
        const orderDate = order.delivery_date;
        return orderDate === dateStr && 
               (order.status === 'pending' || order.status === 'confirmed' || order.status === 'in_progress');
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