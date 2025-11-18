let drivers = [];
let orders = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupEventListeners();
    
    // Автообновление каждые 30 секунд
    setInterval(loadData, 30000);
});

function setupEventListeners() {
    // Фильтры водителей
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.status;
            renderDrivers();
        });
    });
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function loadData() {
    try {
        // Загружаем водителей
        const { data: driversData, error: driversError } = await supabaseClient
            .from('drivers')
            .select('*')
            .order('created_at', { ascending: false });

        if (driversError) throw driversError;
        drivers = driversData || [];

        // Загружаем заказы
        const { data: ordersData, error: ordersError } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;
        orders = ordersData || [];

        renderDrivers();
        renderRecentOrders();
        updateStats();

    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

function renderDrivers() {
    let filteredDrivers = drivers;
    
    if (currentFilter !== 'all') {
        filteredDrivers = drivers.filter(driver => driver.status === currentFilter);
    }
    
    const driversList = document.getElementById('driversList');
    
    if (filteredDrivers.length === 0) {
        driversList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">Водителей не найдено</p>';
        return;
    }
    
    driversList.innerHTML = filteredDrivers.map(driver => createDriverCard(driver)).join('');
}

function createDriverCard(driver) {
    const statusText = getStatusText(driver.status);
    const serviceText = getServiceText(driver.service_type);
    
    // Подсчитываем статистику водителя
    const driverOrders = orders.filter(order => order.driver_id == driver.id && order.status === 'completed');
    const totalEarnings = driverOrders.reduce((sum, order) => sum + order.price, 0);
    const commission = Math.round(totalEarnings * 0.1);
    const driverEarnings = totalEarnings - commission;
    
    return `
        <div class="driver-card">
            <div class="driver-header">
                <div class="driver-name">${driver.full_name}</div>
                <div class="driver-status status-${driver.status}">${statusText}</div>
            </div>
            
            <div class="driver-info">
                <div><strong>Телефон:</strong> ${driver.phone}</div>
                <div><strong>Услуги:</strong> ${serviceText}</div>
                <div><strong>Автомобиль:</strong> ${driver.car_number}</div>
                <div><strong>Регистрация:</strong> ${new Date(driver.created_at).toLocaleDateString('ru-RU')}</div>
                <div><strong>Заказов:</strong> ${driverOrders.length}</div>
                <div><strong>Заработок:</strong> ${driverEarnings.toLocaleString()} ₽</div>
            </div>
            
            <div class="driver-actions">
                ${getDriverActions(driver)}
            </div>
        </div>
    `;
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Ожидает',
        'active': 'Активен',
        'blocked': 'Заблокирован'
    };
    return statusMap[status] || status;
}

function getServiceText(service) {
    const serviceMap = {
        'water': 'Водовозка',
        'septic': 'Септик',
        'both': 'Обе услуги'
    };
    return serviceMap[service] || service;
}

function getDriverActions(driver) {
    switch (driver.status) {
        case 'pending':
            return `<button class="btn btn-activate" onclick="updateDriverStatus(${driver.id}, 'active')">Активировать</button>`;
        case 'active':
            return `<button class="btn btn-block" onclick="updateDriverStatus(${driver.id}, 'blocked')">Заблокировать</button>`;
        case 'blocked':
            return `<button class="btn btn-unblock" onclick="updateDriverStatus(${driver.id}, 'active')">Разблокировать</button>`;
        default:
            return '';
    }
}

async function updateDriverStatus(driverId, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('drivers')
            .update({ status: newStatus })
            .eq('id', driverId);

        if (error) throw error;

        // Обновляем локальные данные
        const driverIndex = drivers.findIndex(d => d.id === driverId);
        if (driverIndex !== -1) {
            drivers[driverIndex].status = newStatus;
        }

        renderDrivers();
        updateStats();

        const statusText = getStatusText(newStatus);
        alert(`Статус водителя изменен на: ${statusText}`);

    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        alert('Ошибка при изменении статуса водителя');
    }
}

function renderRecentOrders() {
    const recentOrders = orders.slice(0, 10);
    const ordersContainer = document.getElementById('recentOrders');
    
    if (recentOrders.length === 0) {
        ordersContainer.innerHTML = '<p style="text-align: center; color: #666;">Заказов пока нет</p>';
        return;
    }
    
    ordersContainer.innerHTML = recentOrders.map(order => {
        const serviceIcon = order.service_type === 'water' ? '💧' : '🚽';
        const commission = Math.round(order.price * 0.1);
        
        return `
            <div class="order-item">
                <div class="order-header">
                    <div class="order-id">${serviceIcon} Заказ #${order.id}</div>
                    <div class="order-price">${order.price.toLocaleString()} ₽</div>
                </div>
                <div class="order-details">
                    <div><strong>Клиент:</strong> ${order.user_name}</div>
                    <div><strong>Адрес:</strong> ${order.address}</div>
                    <div><strong>Дата:</strong> ${order.delivery_date} в ${order.delivery_time}</div>
                    <div><strong>Комиссия:</strong> ${commission.toLocaleString()} ₽</div>
                </div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    const totalOrders = orders.length;
    const completedOrders = orders.filter(order => order.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.price, 0);
    const totalCommission = Math.round(totalRevenue * 0.1);
    const activeDriversCount = drivers.filter(driver => driver.status === 'active').length;
    
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString() + ' ₽';
    document.getElementById('totalCommission').textContent = totalCommission.toLocaleString() + ' ₽';
    document.getElementById('activeDrivers').textContent = activeDriversCount;
}

function logout() {
    window.location.href = 'admin-login.html';
}