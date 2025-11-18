-- Создание таблицы водителей в Supabase
CREATE TABLE IF NOT EXISTS drivers (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('water', 'septic', 'both')),
    car_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_service_type ON drivers(service_type);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- Включение Row Level Security
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Политики безопасности
CREATE POLICY "Anyone can register as driver" ON drivers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Drivers can view their profile" ON drivers
    FOR SELECT USING (true);

CREATE POLICY "Drivers can update their profile" ON drivers
    FOR UPDATE USING (true);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_drivers_updated_at 
    BEFORE UPDATE ON drivers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();