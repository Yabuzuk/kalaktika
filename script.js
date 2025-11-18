// Конфигурация цен
const PRICES = {
    water: 1300, // за кубометр
    septic: 4000 // за выезд
};

// Глобальные переменные
let map, modalMap;
let selectedCoords = null;
let placemark = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setMinDate();
    calculatePrice();
});

function initializeApp() {
    // Проверяем авторизацию
    const userName = localStorage.getItem('userName') || 'Пользователь';
    const userPhone = localStorage.getItem('userPhone') || '+7 (999) 123-45-67';
    
    // Обновляем данные в меню
    document.getElementById('menuUserName').textContent = userName;
    document.getElementById('menuUserPhone').textContent = userPhone;
    
    // Загружаем текущий заказ
    loadCurrentOrder();
    
    // Инициализируем Яндекс карты
    ymaps.ready(initMaps);
}

async function loadCurrentOrder() {
    const userPhone = localStorage.getItem('userPhone');
    
    try {
        // Ищем текущий невыполненный заказ
        const { data: currentOrder, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('user_phone', userPhone)
            .in('status', ['pending', 'confirmed', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (currentOrder) {
            showCurrentOrder(currentOrder);
        } else {
            hideCurrentOrder();
        }

    } catch (error) {
        console.error('Ошибка загрузки текущего заказа:', error);
        hideCurrentOrder();
    }
}

function showCurrentOrder(order) {
    const serviceIcon = order.service_type === 'water' ? '💧' : '🚽';
    const serviceName = order.service_type === 'water' ? 'Доставка воды' : 'Откачка септика';
    const statusText = getOrderStatusText(order.status);
    
    const orderHtml = `
        <div class="current-order-details">
            <div><strong>${serviceIcon} Заказ #${order.id}</strong></div>
            <div><strong>Услуга:</strong> ${serviceName}</div>
            <div><strong>Адрес:</strong> ${order.address}</div>
            <div><strong>Дата и время:</strong> ${order.delivery_date} в ${order.delivery_time}</div>
            <div><strong>Количество:</strong> ${order.quantity} ${order.service_type === 'water' ? 'куб.м' : 'выезд'}</div>
            <div><strong>Стоимость:</strong> ${order.price.toLocaleString()} ₽</div>
            <div><strong>Статус:</strong> <span class="status-${order.status}">${statusText}</span></div>
        </div>
    `;
    
    document.getElementById('currentOrderDetails').innerHTML = orderHtml;
    document.getElementById('currentOrderSection').style.display = 'block';
}

function hideCurrentOrder() {
    document.getElementById('currentOrderSection').style.display = 'none';
}

function initMaps() {
    // Карта в модальном окне
    modalMap = new ymaps.Map('modalMap', {
        center: [62.5354, 113.9607], // Мирный, Якутия
        zoom: 13,
        controls: ['zoomControl', 'searchControl']
    });
    
    // Ограничиваем область поиска городом Мирный
    modalMap.controls.get('searchControl').options.set({
        boundedBy: [[62.50, 113.90], [62.57, 114.02]], // Границы города Мирный
        strictBounds: true
    });

    // Обработчик клика по карте в модальном окне
    modalMap.events.add('click', function(e) {
        const coords = e.get('coords');
        selectLocationOnMap(coords);
    });
}

function setupEventListeners() {
    // Переключение типа услуги
    document.querySelectorAll('input[name="service"]').forEach(radio => {
        radio.addEventListener('change', handleServiceChange);
    });

    // Изменение количества
    document.getElementById('quantity').addEventListener('input', calculatePrice);

    // Кнопка выбора на карте
    document.getElementById('selectOnMap').addEventListener('click', openMapModal);

    // Модальное окно карты
    document.querySelector('.close').addEventListener('click', closeMapModal);
    document.getElementById('confirmAddress').addEventListener('click', confirmAddress);

    // Кнопка заказа
    document.getElementById('orderBtn').addEventListener('click', createOrder);

    // Бургер меню
    document.getElementById('burgerBtn').addEventListener('click', openSideMenu);
    document.getElementById('closeMenu').addEventListener('click', closeSideMenu);
    document.getElementById('overlay').addEventListener('click', closeSideMenu);
    
    // Меню пункты
    document.getElementById('profileBtn').addEventListener('click', openProfileModal);
    document.getElementById('historyBtn').addEventListener('click', openHistoryModal);
    document.getElementById('becomeDriverBtn').addEventListener('click', openDriverModal);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Модальные окна
    document.querySelectorAll('.modal .close').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
    
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('driverLoginForm').addEventListener('submit', loginDriver);
    document.getElementById('driverRegisterForm').addEventListener('submit', registerDriver);
    
    // Табы водителя
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchDriverTab(tabName);
        });
    });

    // Поиск адреса при вводе
    document.getElementById('address').addEventListener('input', debounce(showAddressSuggestions, 300));
    
    // Обновление временных слотов при смене даты
    document.getElementById('date').addEventListener('change', generateTimeSlots);
    
    // Скрываем подсказки при клике вне поля
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.address-input-container')) {
            document.getElementById('addressSuggestions').style.display = 'none';
        }
    });
}

function handleServiceChange() {
    const service = document.querySelector('input[name="service"]:checked').value;
    const quantitySection = document.getElementById('quantitySection');
    
    if (service === 'septic') {
        quantitySection.style.display = 'none';
    } else {
        quantitySection.style.display = 'block';
    }
    
    calculatePrice();
}

function calculatePrice() {
    const service = document.querySelector('input[name="service"]:checked').value;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    
    let totalPrice;
    if (service === 'water') {
        totalPrice = PRICES.water * quantity;
    } else {
        totalPrice = PRICES.septic;
    }
    
    document.getElementById('totalPrice').textContent = `${totalPrice.toLocaleString()} ₽`;
}

function setMinDate() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateInput = document.getElementById('date');
    dateInput.min = tomorrow.toISOString().split('T')[0];
    dateInput.value = tomorrow.toISOString().split('T')[0];
    
    // Генерируем временные интервалы для завтрашнего дня
    setTimeout(generateTimeSlots, 100);
}

async function generateTimeSlots() {
    const timeSelect = document.getElementById('time');
    const selectedDate = document.getElementById('date').value;
    
    timeSelect.innerHTML = '<option value="">Выберите время</option>';
    
    if (!selectedDate) return;
    
    // Получаем занятые слоты на выбранную дату
    const occupiedSlots = await getOccupiedTimeSlots(selectedDate);
    
    // Генерируем слоты с 8:00 до 20:00 каждые 30 минут
    for (let hour = 8; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            if (hour === 20 && minute > 0) break; // Последний слот 20:00
            
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            // Проверяем, не занят ли этот слот
            if (!occupiedSlots.includes(timeString)) {
                const option = document.createElement('option');
                option.value = timeString;
                option.textContent = timeString;
                timeSelect.appendChild(option);
            }
        }
    }
    
    if (timeSelect.children.length === 1) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'На эту дату все время занято';
        option.disabled = true;
        timeSelect.appendChild(option);
    }
}

async function getOccupiedTimeSlots(date) {
    try {
        // Получаем все заказы на выбранную дату
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('delivery_time')
            .eq('delivery_date', date)
            .in('status', ['pending', 'confirmed', 'in_progress']);

        if (error) throw error;

        // Возвращаем массив занятых временных слотов
        return orders.map(order => order.delivery_time.slice(0, 5));
        
    } catch (error) {
        console.error('Ошибка получения занятых слотов:', error);
        return [];
    }
}

function openMapModal() {
    document.getElementById('mapModal').style.display = 'block';
    setTimeout(() => {
        modalMap.container.fitToViewport();
    }, 100);
}

function closeMapModal() {
    document.getElementById('mapModal').style.display = 'none';
}

function selectLocationOnMap(coords) {
    selectedCoords = coords;
    
    // Удаляем предыдущую метку
    if (placemark) {
        modalMap.geoObjects.remove(placemark);
    }
    
    // Добавляем новую метку
    placemark = new ymaps.Placemark(coords, {
        balloonContent: 'Выбранный адрес'
    }, {
        preset: 'islands#redDotIcon'
    });
    
    modalMap.geoObjects.add(placemark);
    
    // Получаем адрес по координатам
    ymaps.geocode(coords).then(function(res) {
        const firstGeoObject = res.geoObjects.get(0);
        if (firstGeoObject) {
            let fullAddress = firstGeoObject.getAddressLine();
            // Убираем лишние части адреса
            let cleanAddress = fullAddress
                .replace('Россия, ', '')
                .replace('Республика Саха (Якутия), ', '')
                .replace('городской округ "город Мирный", ', '')
                .replace('Мирный, ', '');
            
            document.getElementById('address').value = cleanAddress;
            console.log('Полный адрес:', fullAddress);
            console.log('Очищенный адрес:', cleanAddress);
        } else {
            document.getElementById('address').value = `Координаты: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
        }
    }).catch(function(error) {
        console.error('Ошибка геокодирования:', error);
        document.getElementById('address').value = `Координаты: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
    });
}

function confirmAddress() {
    closeMapModal();
}

function showAddressSuggestions(query) {
    const suggestionsContainer = document.getElementById('addressSuggestions');
    
    if (query.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    ymaps.suggest('Мирный, Якутия, ' + query, {
        boundedBy: [[62.50, 113.90], [62.57, 114.02]],
        strictBounds: true,
        results: 5
    }).then(function(suggestions) {
        suggestionsContainer.innerHTML = '';
        
        if (suggestions.length > 0) {
            suggestions.forEach(function(suggestion) {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = suggestion.displayName;
                item.addEventListener('click', function() {
                    selectSuggestion(suggestion.displayName);
                });
                suggestionsContainer.appendChild(item);
            });
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }).catch(function(error) {
        console.error('Ошибка получения подсказок:', error);
        suggestionsContainer.style.display = 'none';
    });
}

function selectSuggestion(address) {
    document.getElementById('address').value = address;
    document.getElementById('addressSuggestions').style.display = 'none';
    
    // Показываем адрес на карте
    geocodeAndShowOnMap(address);
}

function geocodeAndShowOnMap(address) {
    ymaps.geocode(address, {
        results: 1,
        boundedBy: [[62.50, 113.90], [62.57, 114.02]],
        strictBounds: true
    }).then(function(res) {
        const firstGeoObject = res.geoObjects.get(0);
        if (firstGeoObject) {
            const coords = firstGeoObject.geometry.getCoordinates();
            selectedCoords = coords;
        }
    }).catch(function(error) {
        console.error('Ошибка геокодирования:', error);
    });
}

async function createOrder() {
    const service = document.querySelector('input[name="service"]:checked').value;
    const address = document.getElementById('address').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    
    // Валидация
    if (!address.trim()) {
        alert('Пожалуйста, укажите адрес доставки');
        return;
    }
    
    if (!date || !time) {
        alert('Пожалуйста, укажите дату и время');
        return;
    }
    
    // Создаем объект заказа
    const order = {
        id: Date.now(),
        service: service,
        address: address,
        coords: selectedCoords,
        date: date,
        time: time,
        quantity: service === 'water' ? quantity : 1,
        price: service === 'water' ? PRICES.water * quantity : PRICES.septic,
        status: 'pending',
        created: new Date().toISOString()
    };
    
    // Сохраняем заказ в Supabase
    try {
        await saveOrder(order);
        showOrderConfirmation(order);
        
        // Обновляем текущий заказ
        setTimeout(loadCurrentOrder, 1000);
    } catch (error) {
        console.error('Ошибка создания заказа:', error);
    }
}

async function saveOrder(order) {
    try {
        const { data, error } = await supabaseClient
            .from('orders')
            .insert([{
                service_type: order.service,
                address: order.address,
                coordinates: order.coords,
                delivery_date: order.date,
                delivery_time: order.time,
                quantity: order.quantity,
                price: order.price,
                status: order.status,
                user_name: localStorage.getItem('userName'),
                user_phone: localStorage.getItem('userPhone')
            }]);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка при создании заказа');
        throw error;
    }
}

function showOrderConfirmation(order) {
    const serviceText = order.service === 'water' ? 'Доставка воды' : 'Откачка септика';
    const quantityText = order.service === 'water' ? `${order.quantity} куб.м` : '1 выезд';
    
    alert(`Заказ создан!
    
Услуга: ${serviceText}
Количество: ${quantityText}
Адрес: ${order.address}
Дата и время: ${order.date} в ${order.time}
Стоимость: ${order.price.toLocaleString()} ₽

Номер заказа: #${order.id}`);
    
    // Очищаем форму
    resetForm();
}

function resetForm() {
    document.getElementById('address').value = '';
    document.getElementById('quantity').value = '1';
    document.querySelector('input[name="service"][value="water"]').checked = true;
    
    // Очищаем карту
    if (modalMap) {
        modalMap.geoObjects.removeAll();
    }
    
    selectedCoords = null;
    placemark = null;
    
    // Пересчитываем цену
    handleServiceChange();
    setMinDate();
}

// Функции меню
function openSideMenu() {
    document.getElementById('sideMenu').classList.add('open');
    document.getElementById('overlay').classList.add('show');
}

function closeSideMenu() {
    document.getElementById('sideMenu').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}

function openProfileModal() {
    closeSideMenu();
    const userName = localStorage.getItem('userName') || '';
    const userPhone = localStorage.getItem('userPhone') || '';
    
    document.getElementById('profileName').value = userName;
    document.getElementById('profilePhone').value = userPhone;
    document.getElementById('profileModal').style.display = 'block';
}

function openHistoryModal() {
    closeSideMenu();
    loadOrderHistory();
    document.getElementById('historyModal').style.display = 'block';
}

function openDriverModal() {
    closeSideMenu();
    // Предзаполняем телефон из профиля
    const userPhone = localStorage.getItem('userPhone') || '';
    document.getElementById('loginDriverPhone').value = userPhone;
    document.getElementById('driverPhone').value = userPhone;
    
    // По умолчанию открываем вкладку входа
    switchDriverTab('login');
    document.getElementById('driverModal').style.display = 'block';
}

function switchDriverTab(tabName) {
    // Убираем активные классы
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Добавляем активные классы
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`driver${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`).classList.add('active');
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

function saveProfile(e) {
    e.preventDefault();
    const name = document.getElementById('profileName').value;
    const phone = document.getElementById('profilePhone').value;
    
    localStorage.setItem('userName', name);
    localStorage.setItem('userPhone', phone);
    
    // Обновляем данные в меню
    document.getElementById('menuUserName').textContent = name;
    document.getElementById('menuUserPhone').textContent = phone;
    
    closeModals();
    alert('Профиль обновлен!');
}

async function loadOrderHistory() {
    const userPhone = localStorage.getItem('userPhone');
    
    try {
        // Загружаем заказы из Supabase
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('user_phone', userPhone)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        const userOrders = orders || [];
    
    let historyHtml = '';
    
    if (userOrders.length === 0) {
        historyHtml = '<p style="text-align: center; color: #666;">У вас пока нет заказов</p>';
    } else {
        userOrders.forEach(order => {
            const serviceIcon = order.service_type === 'water' ? '💧' : '🚽';
            const serviceName = order.service_type === 'water' ? 'Доставка воды' : 'Откачка септика';
            const orderDate = new Date(order.created_at).toLocaleDateString('ru-RU');
            const statusText = getOrderStatusText(order.status);
            
            historyHtml += `
                <div class="order-history-item">
                    <div class="order-history-header">
                        <div class="order-history-title">${serviceIcon} Заказ #${order.id}</div>
                        <div class="order-history-date">${orderDate}</div>
                    </div>
                    <div class="order-history-details">
                        <div><strong>Услуга:</strong> ${serviceName}</div>
                        <div><strong>Адрес:</strong> ${order.address}</div>
                        <div><strong>Дата и время:</strong> ${order.delivery_date} в ${order.delivery_time}</div>
                        <div><strong>Количество:</strong> ${order.quantity} ${order.service_type === 'water' ? 'куб.м' : 'выезд'}</div>
                        <div><strong>Стоимость:</strong> ${order.price.toLocaleString()} ₽</div>
                        <div><strong>Статус:</strong> <span class="status-${order.status}">${statusText}</span></div>
                    </div>
                </div>
            `;
        });
    }
    
    document.getElementById('orderHistory').innerHTML = historyHtml;
    
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        document.getElementById('orderHistory').innerHTML = '<p style="text-align: center; color: #666;">Ошибка загрузки истории заказов</p>';
    }
}

function getOrderStatusText(status) {
    const statusMap = {
        'pending': 'Ожидает подтверждения',
        'confirmed': 'Подтвержден',
        'in_progress': 'Выполняется',
        'completed': 'Выполнен',
        'cancelled': 'Отменен'
    };
    return statusMap[status] || 'Обрабатывается';
}

async function loginDriver(e) {
    e.preventDefault();
    
    const phone = document.getElementById('loginDriverPhone').value;
    
    try {
        // Проверяем, есть ли такой водитель в Supabase
        const { data, error } = await supabaseClient
            .from('drivers')
            .select('*')
            .eq('phone', phone)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        if (data) {
            if (data.status === 'pending') {
                alert('Ваш аккаунт ожидает активации администратором. Пожалуйста, подождите.');
                return;
            }
            
            if (data.status === 'blocked') {
                alert('Ваш аккаунт заблокирован. Обратитесь к администратору.');
                return;
            }
            
            // Сохраняем данные водителя
            localStorage.setItem('driverName', data.full_name);
            localStorage.setItem('driverId', data.id);
            localStorage.setItem('driverPhone', data.phone);
            
            closeModals();
            
            // Переходим в CRM водителя
            window.open('driver.html', '_blank');
        } else {
            alert('Водитель с таким номером не найден. Пожалуйста, зарегистрируйтесь.');
            switchDriverTab('register');
        }
    } catch (error) {
        console.error('Ошибка входа водителя:', error);
        alert('Ошибка при входе. Попробуйте еще раз.');
    }
}

async function registerDriver(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('driverFullName').value;
    const service = document.getElementById('driverService').value;
    const phone = document.getElementById('driverPhone').value;
    const carNumber = document.getElementById('driverCarNumber').value;
    
    try {
        // Проверяем, нет ли уже такого водителя
        const { data: existingDriver } = await supabaseClient
            .from('drivers')
            .select('id')
            .eq('phone', phone)
            .single();
        
        if (existingDriver) {
            alert('Водитель с таким номером уже зарегистрирован. Используйте вкладку "Вход".');
            return;
        }
        
        // Регистрируем нового водителя
        const { data: newDriver, error } = await supabaseClient
            .from('drivers')
            .insert([{
                full_name: fullName,
                phone: phone,
                service_type: service,
                car_number: carNumber
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        closeModals();
        
        alert(`Регистрация успешна!

Спасибо за регистрацию, ${fullName}!

Ваш аккаунт отправлен на модерацию.
Мы свяжемся с вами после активации.`);
        
        // Очищаем форму
        document.getElementById('driverRegisterForm').reset();
        
    } catch (error) {
        console.error('Ошибка регистрации водителя:', error);
        
        if (error.code === '23505') { // Ошибка уникальности
            alert('Водитель с таким номером уже существует.');
        } else {
            alert('Ошибка при регистрации. Попробуйте еще раз.');
        }
    }
}

function getServiceName(service) {
    const serviceNames = {
        'water': 'Водовозка',
        'septic': 'Откачка септика',
        'both': 'Обе услуги'
    };
    return serviceNames[service] || service;
}

function logout() {
    localStorage.removeItem('userName');
    localStorage.removeItem('userPhone');
    localStorage.removeItem('userToken');
    window.location.href = 'login.html';
}

// Утилита для debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}