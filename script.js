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
    // Проверяем авторизацию (заглушка)
    const userName = localStorage.getItem('userName') || 'Пользователь';
    document.getElementById('userName').textContent = `Привет, ${userName}!`;
    
    // Инициализируем Яндекс карты
    ymaps.ready(initMaps);
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

    // Модальное окно
    document.querySelector('.close').addEventListener('click', closeMapModal);
    document.getElementById('confirmAddress').addEventListener('click', confirmAddress);

    // Кнопка заказа
    document.getElementById('orderBtn').addEventListener('click', createOrder);

    // Кнопка выхода
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Поиск адреса при вводе
    document.getElementById('address').addEventListener('input', debounce(showAddressSuggestions, 300));
    
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
    
    // Генерируем временные интервалы
    generateTimeSlots();
}

function generateTimeSlots() {
    const timeSelect = document.getElementById('time');
    timeSelect.innerHTML = '<option value="">Выберите время</option>';
    
    // Генерируем слоты с 8:00 до 20:00 каждые 30 минут
    for (let hour = 8; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            if (hour === 20 && minute > 0) break; // Последний слот 20:00
            
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const option = document.createElement('option');
            option.value = timeString;
            option.textContent = timeString;
            timeSelect.appendChild(option);
        }
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

function logout() {
    localStorage.removeItem('userName');
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