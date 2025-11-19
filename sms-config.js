// Конфигурация SMS-сервиса
const SMS_CONFIG = {
    // SMS.RU настройки
    SMS_RU: {
        api_id: 'YOUR_SMS_RU_API_KEY', // Получить на https://sms.ru/
        api_url: 'https://sms.ru/sms/send'
    },
    
    // SMSC.RU настройки (альтернатива)
    SMSC: {
        login: 'YOUR_SMSC_LOGIN',
        password: 'YOUR_SMSC_PASSWORD',
        api_url: 'https://smsc.ru/sys/send.php'
    },
    
    // Twilio настройки (международный)
    TWILIO: {
        account_sid: 'YOUR_TWILIO_SID',
        auth_token: 'YOUR_TWILIO_TOKEN',
        from_number: '+1234567890'
    }
};

// Функция отправки SMS через SMS.RU
async function sendSMSRu(phone, message) {
    try {
        const response = await fetch(SMS_CONFIG.SMS_RU.api_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                api_id: SMS_CONFIG.SMS_RU.api_id,
                to: phone.replace(/\D/g, ''),
                msg: message,
                json: 1
            })
        });
        
        const result = await response.json();
        
        if (result.status_code === 100) {
            console.log('SMS отправлена успешно');
            return true;
        } else {
            throw new Error(`Ошибка SMS.RU: ${result.status_text}`);
        }
    } catch (error) {
        console.error('Ошибка отправки SMS:', error);
        throw error;
    }
}

// Функция отправки SMS через SMSC.RU
async function sendSMSSMSC(phone, message) {
    try {
        const response = await fetch(SMS_CONFIG.SMSC.api_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                login: SMS_CONFIG.SMSC.login,
                psw: SMS_CONFIG.SMSC.password,
                phones: phone.replace(/\D/g, ''),
                mes: message,
                fmt: 3 // JSON формат ответа
            })
        });
        
        const result = await response.json();
        
        if (result.error_code) {
            throw new Error(`Ошибка SMSC: ${result.error}`);
        }
        
        console.log('SMS отправлена успешно');
        return true;
    } catch (error) {
        console.error('Ошибка отправки SMS:', error);
        throw error;
    }
}

// Основная функция отправки SMS (выберите нужный сервис)
async function sendSMS(phone, message) {
    // Для тестирования - просто логируем
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`[ТЕСТ] SMS на ${phone}: ${message}`);
        alert(`[ТЕСТ] Код: ${message.match(/\d{4}/)[0]}`); // Показываем код для тестирования
        return true;
    }
    
    // В продакшене используйте один из сервисов:
    try {
        return await sendSMSRu(phone, message);
        // или return await sendSMSSMSC(phone, message);
    } catch (error) {
        console.error('Не удалось отправить SMS:', error);
        throw error;
    }
}