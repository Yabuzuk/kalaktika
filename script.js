// Конфигурация цен
const PRICES = {
    water: 1300, // за кубометр
    septic: 4000 // за выезд
};

// Глобальные переменные
let map, modalMap;
let selectedCoords = null;
let placemark = null;
let currentUser = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
});

async function checkAuthentication() {
    const userPhone = localStorage.getItem('userPhone');
    
    if (!userPhone) {
        window.location.href = 'login.html';
        return;
    }
    
    // Показываем индикатор загрузки
    showLoadingIndicator();
    
    try {
        // Проверяем пользователя в базе данных
        const { data: user, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('phone', userPhone)
            .single();
            
        if (error || !user) {
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = user;
        
        // Контекст пользователя установлен
        
        initializeApp();
        
    } catch (error) {
        console.error('Ошибка проверки аутентификации:', error);
        
        // Проверяем, есть ли сеть
        if (!navigator.onLine) {
            showOfflineMessage();
            return;
        }
        
        localStorage.clear();
        window.location.href = 'login.html';
    } finally {
        hideLoadingIndicator();
    }
}

function initializeApp() {
    // Обновляем данные в меню
    document.getElementById('menuUserName').textContent = currentUser.name;
    document.getElementById('menuUserPhone').textContent = currentUser.phone;
    
    setupEventListeners();
    setMinDate();
    calculatePrice();
    
    // Загружаем текущий заказ
    loadCurrentOrder();
    
    // Подписываемся на изменения заказов
    subscribeToOrderUpdates();
    
    // Карты загружаются лениво при открытии модального окна
    // Проверяем, оптимально ли для мобильных
    if (!lazyMaps.isMobileOptimal()) {
        hideMapFeatures();
        console.log('Карты отключены для медленного соединения');
    }
}

function subscribeToOrderUpdates() {
    if (!currentUser) return;
    
    // Подписка на изменения заказов пользователя
    supabaseClient
        .channel('user-orders')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log('Изменение заказа:', payload);
            
            // Обновляем текущий заказ
            loadCurrentOrder();
            
            // Показываем уведомление
            if (payload.eventType === 'UPDATE') {
                showOrderUpdateNotification(payload.new);
            }
        })
        .subscribe();
}

function showOrderUpdateNotification(order) {
    const statusText = getOrderStatusText(order.status);
    const message = `Заказ #${order.id}: ${statusText}`;
    
    // Push уведомление
    showPushNotification('🚛 Обновление заказа', {
        body: message,
        tag: `order-${order.id}`,
        requireInteraction: true,
        silent: false
    });
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #667eea;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Удаляем через 4 секунды
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

async function loadCurrentOrder() {
    if (!currentUser) return;
    
    // Проверяем кэш
    const cacheKey = `current_order_${currentUser.id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        if (cached.order) {
            showCurrentOrder(cached.order);
        } else {
            hideCurrentOrder();
        }
        return;
    }
    
    UILoader.showSkeleton('currentOrderDetails');
    
    try {
        // Ищем текущий невыполненный заказ
        const { data: currentOrder, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('user_id', currentUser.id)
            .in('status', ['pending', 'confirmed', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Кэшируем результат
        cache.set(cacheKey, { order: currentOrder });

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
    const canCancel = canCancelOrder(order);
    
    const orderHtml = `
        <div class="current-order-details">
            <div><strong>${serviceIcon} Заказ #${order.id}</strong></div>
            <div><strong>Услуга:</strong> ${serviceName}</div>
            <div><strong>Адрес:</strong> ${order.address}</div>
            <div><strong>Дата и время:</strong> ${order.delivery_date} в ${order.delivery_time}</div>
            <div><strong>Количество:</strong> ${order.quantity} ${order.service_type === 'water' ? 'куб.м' : 'выезд'}</div>
            <div><strong>Стоимость:</strong> ${order.price.toLocaleString()} ₽</div>
            <div><strong>Статус:</strong> <span class="status-${order.status}">${statusText}</span></div>
            ${canCancel ? `<button class="cancel-order-btn" onclick="cancelCurrentOrder(${order.id})">❌ Отменить заказ</button>` : ''}
        </div>
    `;
    
    document.getElementById('currentOrderDetails').innerHTML = orderHtml;
    document.getElementById('currentOrderSection').style.display = 'block';
}

function hideCurrentOrder() {
    document.getElementById('currentOrderSection').style.display = 'none';
}

function initMaps() {
    try {
        // Проверяем доступность API
        if (typeof ymaps === 'undefined') {
            console.error('Яндекс.Карты API не загружен');
            hideMapFeatures();
            return;
        }

        // Карта в модальном окне с мобильными настройками
        modalMap = new ymaps.Map('modalMap', {
            center: [62.5354, 113.9607], // Мирный, Якутия
            zoom: 13,
            controls: ['zoomControl', 'searchControl'],
            behaviors: ['default', 'scrollZoom']
        }, {
            // Мобильные настройки
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: true
        });
        
        // Ограничиваем область поиска городом Мирный
        modalMap.controls.get('searchControl').options.set({
            boundedBy: [[62.50, 113.90], [62.57, 114.02]], // Границы города Мирный
            strictBounds: true
        });

        // Обработчик клика/касания по карте
        modalMap.events.add(['click', 'touchend'], function(e) {
            e.preventDefault();
            const coords = e.get('coords');
            selectLocationOnMap(coords);
        });
        
        console.log('Яндекс.Карты успешно инициализированы');
        
    } catch (error) {
        console.error('Ошибка инициализации карт:', error);
        hideMapFeatures();
    }
}

function hideMapFeatures() {
    // Скрываем кнопку выбора на карте
    const mapButton = document.getElementById('selectOnMap');
    if (mapButton) {
        mapButton.style.display = 'none';
    }
    
    // Отключаем автодополнение
    const addressInput = document.getElementById('address');
    if (addressInput) {
        addressInput.placeholder = 'Введите адрес вручную';
    }
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
    
    // Меню пункты с поддержкой touch
    addTouchSupport('profileBtn', openProfileModal);
    addTouchSupport('historyBtn', openHistoryModal);
    addTouchSupport('becomeDriverBtn', openDriverModal);
    addTouchSupport('logoutBtn', logout);
    
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
    
    // PWA установка
    setupPWAInstall();
    
    // Проверяем состояние установки при загрузке
    checkInstallStatus();
    
    // Запрашиваем разрешение на уведомления
    setTimeout(requestNotificationPermission, 2000);
    
    // Настраиваем фоновую синхронизацию
    setupBackgroundSync();


    
    // Обновление временных слотов при смене даты
    document.getElementById('date').addEventListener('change', generateTimeSlots);
    
    // Подсказки адресов
    document.getElementById('address').addEventListener('input', debounce(showAddressSuggestions, 300));
    
    // Скрываем подсказки при клике вне поля
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.address-input-container')) {
            const suggestions = document.getElementById('addressSuggestions');
            if (suggestions) {
                suggestions.style.display = 'none';
            }
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
    
    if (!selectedDate) {
        timeSelect.innerHTML = '<option value="">Выберите время</option>';
        return;
    }

    // Показываем индикатор загрузки
    timeSelect.innerHTML = '<option value="">⏳ Загрузка...</option>';
    timeSelect.disabled = true;
    
    try {
        // Параллельно генерируем слоты и получаем занятые
        const [allSlots, occupiedSlots] = await Promise.all([
            generateAllTimeSlots(),
            getOccupiedTimeSlots(selectedDate)
        ]);
        
        // Фильтруем доступные слоты
        const availableSlots = allSlots.filter(slot => !occupiedSlots.includes(slot));
        
        // Быстро обновляем DOM
        const options = ['<option value="">Выберите время</option>'];
        
        if (availableSlots.length > 0) {
            availableSlots.forEach(slot => {
                options.push(`<option value="${slot}">${slot}</option>`);
            });
        } else {
            options.push('<option value="" disabled>На эту дату все время занято</option>');
        }
        
        timeSelect.innerHTML = options.join('');
        
    } catch (error) {
        console.error('Ошибка загрузки слотов:', error);
        timeSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
    } finally {
        timeSelect.disabled = false;
    }
}

function generateAllTimeSlots() {
    return new Promise(resolve => {
        const slots = [];
        for (let hour = 8; hour <= 20; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                if (hour === 20 && minute > 0) break;
                slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
            }
        }
        resolve(slots);
    });
}

async function getOccupiedTimeSlots(date) {
    // Проверяем кэш
    const cacheKey = `time_slots_${date}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    try {
        // Получаем все заказы на выбранную дату
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('delivery_time')
            .eq('delivery_date', date)
            .in('status', ['pending', 'confirmed', 'in_progress']);

        if (error) throw error;

        // Возвращаем массив занятых временных слотов
        const slots = orders.map(order => order.delivery_time.slice(0, 5));
        
        // Кэшируем на 1 минуту
        cache.set(cacheKey, slots);
        return slots;
        
    } catch (error) {
        console.error('Ошибка получения занятых слотов:', error);
        return [];
    }
}

async function openMapModal() {
    document.getElementById('mapModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Ленивая загрузка карт
    if (!lazyMaps.loaded) {
        UILoader.showSpinner('Загрузка карт...');
        
        const loaded = await lazyMaps.load();
        UILoader.hideSpinner();
        
        if (!loaded) {
            alert('Не удалось загрузить карты');
            closeMapModal();
            return;
        }
        
        // Инициализируем карту после загрузки
        initMaps();
    }
    
    setTimeout(() => {
        if (modalMap && modalMap.container) {
            try {
                modalMap.container.fitToViewport();
            } catch (error) {
                console.log('Ошибка при обновлении карты:', error);
            }
        }
    }, 300);
}

function closeMapModal() {
    document.getElementById('mapModal').style.display = 'none';
    // Возвращаем скролл фона
    document.body.style.overflow = '';
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

async function showAddressSuggestions() {
    const query = document.getElementById('address').value.trim();
    const suggestionsContainer = document.getElementById('addressSuggestions');
    
    if (query.length < 3) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    try {
        // Используем Яндекс.Геосаджест API
        const response = await fetch(`https://suggest-maps.yandex.ru/v1/suggest?apikey=41a4deeb-0548-4d8e-b897-3c4a6bc08032&text=Мирный ${encodeURIComponent(query)}&results=5&lang=ru_RU`);
        
        if (!response.ok) {
            console.log(`Яндекс API ошибка: ${response.status}, используем локальные подсказки`);
            showLocalSuggestions(query, suggestionsContainer);
            return;
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            let html = '';
            data.results.forEach(result => {
                // Очищаем адрес от лишних частей
                let cleanAddress = result.title.text
                    .replace('Россия, ', '')
                    .replace('Республика Саха (Якутия), ', '')
                    .replace('Мирный, ', '')
                    .replace('город Мирный, ', '');
                    
                html += `<div class="suggestion-item" onclick="selectSuggestion('${cleanAddress}')">${cleanAddress}</div>`;
            });
            suggestionsContainer.innerHTML = html;
            suggestionsContainer.style.display = 'block';
        } else {
            showLocalSuggestions(query, suggestionsContainer);
        }
        
    } catch (error) {
        console.log('Ошибка Яндекс API, используем локальные подсказки');
        showLocalSuggestions(query, suggestionsContainer);
    }
}

function showLocalSuggestions(query, container) {
    const commonAddresses = [
        'ул. Ленина', 'ул. Мира', 'ул. Полярная', 'ул. Комсомольская',
        'ул. Пионерская', 'ул. Молодежная', 'ул. Трудовая', 'ул. Новая',
        'ул. Центральная', 'ул. Парковая', 'ул. Лесная', 'ул. Советская',
        'ул. Маяковского', 'ул. Пушкина', 'ул. Горького', 'ул. Октябрьская',
        'ул. Мирная', 'ул. Строителей', 'ул. Мирнинская', 'ул. Кирова',
        'пр. Ленина', 'пр. Мира', 'пер. Ленина', 'пер. Мира'
    ];
    
    const filtered = commonAddresses.filter(addr => 
        addr.toLowerCase().includes(query.toLowerCase())
    );
    
    if (filtered.length > 0) {
        let html = '';
        filtered.slice(0, 5).forEach(address => {
            html += `<div class="suggestion-item" onclick="selectSuggestion('${address}')">${address}</div>`;
        });
        container.innerHTML = html;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

function selectSuggestion(address) {
    document.getElementById('address').value = address;
    document.getElementById('addressSuggestions').style.display = 'none';
    
    // Очищаем координаты при выборе адреса из подсказок
    selectedCoords = null;
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
    
    // Показываем спиннер
    UILoader.showSpinner('Создание заказа...');
    
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
        UILoader.hideSpinner();
        showOrderConfirmation(order);
        
        // Очищаем кэш
        cache.clear();
        
        // Обновляем текущий заказ
        setTimeout(loadCurrentOrder, 1000);
    } catch (error) {
        UILoader.hideSpinner();
        console.error('Ошибка создания заказа:', error);
    }
}

async function saveOrder(order) {
    if (!currentUser) throw new Error('Пользователь не авторизован');
    
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
                user_id: currentUser.id,
                user_name: currentUser.name,
                user_phone: currentUser.phone
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
    
    // Push уведомление о создании заказа
    showPushNotification('✅ Заказ создан!', {
        body: `${serviceText} на ${order.date} в ${order.time}`,
        tag: 'order-created',
        requireInteraction: false
    });
    
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
    
    if (!currentUser) return;
    
    document.getElementById('profileName').value = currentUser.name;
    document.getElementById('profilePhone').value = currentUser.phone;
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

async function saveProfile(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const name = document.getElementById('profileName').value;
    const phone = document.getElementById('profilePhone').value;
    
    try {
        // Обновляем данные в базе
        const { error } = await supabaseClient
            .from('users')
            .update({ 
                name: name,
                phone: phone,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
            
        if (error) throw error;
        
        // Обновляем локальные данные
        currentUser.name = name;
        currentUser.phone = phone;
        localStorage.setItem('userPhone', phone);
        
        // Обновляем данные в меню
        document.getElementById('menuUserName').textContent = name;
        document.getElementById('menuUserPhone').textContent = phone;
        
        closeModals();
        alert('Профиль обновлен!');
        
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        alert('Ошибка при обновлении профиля');
    }
}

async function loadOrderHistory() {
    if (!currentUser) return;
    
    try {
        // Загружаем заказы из Supabase
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('user_id', currentUser.id)
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
            const canCancel = canCancelOrder(order);
            
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
                        ${canCancel ? `<button class="cancel-order-btn" onclick="cancelOrderFromHistory(${order.id})">❌ Отменить</button>` : ''}
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

function canCancelOrder(order) {
    // Можно отменить только если заказ не выполняется
    if (order.status === 'in_progress' || order.status === 'completed' || order.status === 'cancelled') {
        return false;
    }
    
    // Проверяем, осталось ли больше 3 часов до выполнения
    const now = new Date();
    const orderDateTime = new Date(order.delivery_date + 'T' + order.delivery_time);
    const timeDiff = orderDateTime.getTime() - now.getTime();
    const hoursLeft = timeDiff / (1000 * 60 * 60);
    
    return hoursLeft >= 3;
}

async function cancelCurrentOrder(orderId) {
    const confirmCancel = confirm('Вы уверены, что хотите отменить заказ?');
    
    if (!confirmCancel) return;
    
    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({ 
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);

        if (error) throw error;

        alert('Заказ успешно отменен!');
        
        // Обновляем отображение
        loadCurrentOrder();
        
    } catch (error) {
        console.error('Ошибка отмены заказа:', error);
        alert('Ошибка при отмене заказа. Попробуйте еще раз.');
    }
}

async function cancelOrderFromHistory(orderId) {
    await cancelCurrentOrder(orderId);
    // Обновляем историю
    loadOrderHistory();
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
    currentUser = null;
    localStorage.clear();
    window.location.href = 'login.html';
}

// PWA функциональность
let deferredPrompt;
let isInstallable = false;

function setupPWAInstall() {
    const installBtn = document.getElementById('installBtn');
    
    // Проверяем, установлено ли уже приложение
    if (window.matchMedia('(display-mode: standalone)').matches) {
        installBtn.style.display = 'none';
        return;
    }
    
    // Слушаем событие beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        isInstallable = true;
        installBtn.style.display = 'flex';
        console.log('PWA готово к установке');
    });
    
    // Обработчик кнопки установки
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt && isInstallable) {
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    console.log('PWA установлено');
                    installBtn.style.display = 'none';
                } else {
                    console.log('PWA установка отменена');
                }
                
                deferredPrompt = null;
                isInstallable = false;
            } catch (error) {
                console.error('Ошибка установки PWA:', error);
                showManualInstallInstructions();
            }
        } else {
            showManualInstallInstructions();
        }
    });
    
    // Скрываем кнопку по умолчанию, показываем только когда доступна установка
    installBtn.style.display = 'none';
}

function showManualInstallInstructions() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Показываем визуальную инструкцию
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    let content = '';
    
    if (isAndroid) {
        content = `
            <div style="background: white; border-radius: 15px; padding: 30px; max-width: 400px; text-align: center;">
                <h3 style="margin-bottom: 20px; color: #333;">📱 Установка на Android</h3>
                <div style="margin-bottom: 20px; text-align: left; line-height: 1.6;">
                    <p><strong>1.</strong> Нажмите меню браузера <span style="font-size: 18px;">⋮</span></p>
                    <p><strong>2.</strong> Найдите "Установить приложение"</p>
                    <p><strong>3.</strong> Нажмите "Установить"</p>
                    <p style="color: #28a745; font-weight: 600;">✨ Приложение появится на рабочем столе!</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">Понятно</button>
            </div>
        `;
    } else if (isIOS) {
        content = `
            <div style="background: white; border-radius: 15px; padding: 30px; max-width: 400px; text-align: center;">
                <h3 style="margin-bottom: 20px; color: #333;">📱 Установка на iPhone/iPad</h3>
                <div style="margin-bottom: 20px; text-align: left; line-height: 1.6;">
                    <p><strong>1.</strong> Нажмите кнопку "Поделиться" <span style="font-size: 18px;">□↗</span></p>
                    <p><strong>2.</strong> Выберите "На экран Домой"</p>
                    <p><strong>3.</strong> Нажмите "Добавить"</p>
                    <p style="color: #28a745; font-weight: 600;">✨ Приложение появится на рабочем столе!</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">Понятно</button>
            </div>
        `;
    } else {
        content = `
            <div style="background: white; border-radius: 15px; padding: 30px; max-width: 400px; text-align: center;">
                <h3 style="margin-bottom: 20px; color: #333;">📱 Установка приложения</h3>
                <div style="margin-bottom: 20px; text-align: left; line-height: 1.6;">
                    <p><strong>1.</strong> Откройте меню браузера</p>
                    <p><strong>2.</strong> Найдите "Установить приложение"</p>
                    <p><strong>3.</strong> Нажмите "Установить"</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: #667eea; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">Понятно</button>
            </div>
        `;
    }
    
    modal.innerHTML = content;
    document.body.appendChild(modal);
    
    // Удаляем при клике на фон
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
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

// Добавляем поддержку touch событий для мобильных устройств
function addTouchSupport(elementId, callback) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let touchStartTime = 0;
    
    element.addEventListener('touchstart', function(e) {
        touchStartTime = Date.now();
    }, { passive: true });
    
    element.addEventListener('touchend', function(e) {
        const touchDuration = Date.now() - touchStartTime;
        if (touchDuration < 500) { // Короткое касание
            e.preventDefault();
            callback();
        }
    }, { passive: false });
    
    // Оставляем обычный click для десктопа
    element.addEventListener('click', callback);
}

// Проверка мобильного устройства
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
}

// Оптимизация для мобильных устройств
if (isMobileDevice()) {
    // Отключаем 300ms задержку на клики
    document.addEventListener('DOMContentLoaded', function() {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(meta);
    });
}

// Индикатор загрузки
function showLoadingIndicator() {
    const loader = document.createElement('div');
    loader.id = 'loadingIndicator';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        font-size: 18px;
        color: #667eea;
    `;
    loader.innerHTML = '🚛 Загрузка...';
    document.body.appendChild(loader);
}

function hideLoadingIndicator() {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.remove();
    }
}

// Офлайн режим
function showOfflineMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        right: 20px;
        background: #ff4757;
        color: white;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        z-index: 10000;
        font-weight: 600;
    `;
    message.innerHTML = '⚠️ Нет соединения с интернетом';
    document.body.appendChild(message);
    
    // Проверяем соединение каждые 5 секунд
    const checkConnection = setInterval(() => {
        if (navigator.onLine) {
            clearInterval(checkConnection);
            message.remove();
            location.reload();
        }
    }, 5000);
}

// Push уведомления
async function requestNotificationPermission() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
        // На мобильных требуется пользовательское взаимодействие
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            // Показываем кнопку для включения уведомлений
            showNotificationButton();
            return false;
        }
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Разрешение на уведомления получено');
            return true;
        }
    }
    return false;
}

function showNotificationButton() {
    if (Notification.permission === 'granted') return;
    
    // Проверяем, нет ли уже кнопки
    if (document.getElementById('notificationBtn')) return;
    
    const notifBtn = document.createElement('button');
    notifBtn.id = 'notificationBtn';
    notifBtn.textContent = '🔔 Включить уведомления';
    notifBtn.style.cssText = `
        position: fixed;
        top: 70px;
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
        -webkit-tap-highlight-color: transparent;
    `;
    
    // Добавляем обработчики для мобильных
    const handleClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Клик по кнопке уведомлений');
        
        try {
            const permission = await Notification.requestPermission();
            console.log('Результат запроса:', permission);
            
            if (permission === 'granted') {
                notifBtn.remove();
                showPushNotification('✅ Уведомления включены!', {
                    body: 'Теперь вы будете получать уведомления о заказах',
                    tag: 'notification-enabled'
                });
            } else {
                alert('Для получения уведомлений необходимо разрешить их в настройках браузера');
            }
        } catch (error) {
            console.error('Ошибка запроса уведомлений:', error);
        }
    };
    
    // Добавляем обработчики для всех типов событий
    notifBtn.addEventListener('click', handleClick);
    notifBtn.addEventListener('touchend', handleClick, { passive: false });
    
    document.body.appendChild(notifBtn);
    console.log('Кнопка уведомлений добавлена');
}

function showPushNotification(title, options = {}) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
                badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23667eea"/%3E%3Ctext x="50" y="60" font-size="40" text-anchor="middle" fill="white"%3E🚛%3C/text%3E%3C/svg%3E',
                vibrate: [300, 100, 300, 100, 300],
                silent: false,
                sound: 'default',
                requireInteraction: true,
                ...options
            });
        });
    }
}

// Отслеживание состояния сети
window.addEventListener('online', function() {
    console.log('Соединение восстановлено');
    location.reload();
});

window.addEventListener('offline', function() {
    console.log('Соединение потеряно');
    showOfflineMessage();
});

// Проверка статуса установки
function checkInstallStatus() {
    // Проверяем, запущено ли как PWA
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        console.log('Приложение уже установлено');
        document.getElementById('installBtn').style.display = 'none';
    }
    
    // Отслеживаем событие успешной установки
    window.addEventListener('appinstalled', () => {
        console.log('PWA успешно установлено');
        document.getElementById('installBtn').style.display = 'none';
        
        // Показываем уведомление
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
        notification.textContent = '✅ Приложение установлено!';
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    });
}

// Настройка фоновой синхронизации
function setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
            // Регистрируем фоновую синхронизацию
            return registration.sync.register('background-sync');
        }).then(() => {
            console.log('Фоновая синхронизация зарегистрирована');
        }).catch(error => {
            console.log('Ошибка регистрации фоновой синхронизации:', error);
        });
    }
    
    // Периодическая синхронизация (только для установленных PWA)
    if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
            return registration.periodicSync.register('check-orders', {
                minInterval: 60000 // Проверяем каждую минуту
            });
        }).then(() => {
            console.log('Периодическая синхронизация зарегистрирована');
        }).catch(error => {
            console.log('Периодическая синхронизация не поддерживается:', error);
        });
    }
}