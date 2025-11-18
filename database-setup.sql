-- Создание таблицы заказов в Supabase
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('water', 'septic')),
    address TEXT NOT NULL,
    coordinates JSONB,
    delivery_date DATE NOT NULL,
    delivery_time TIME NOT NULL,
    quantity INTEGER DEFAULT 1,
    price INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    user_name VARCHAR(100) NOT NULL,
    user_phone VARCHAR(20) NOT NULL,
    driver_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_user_phone ON orders(user_phone);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Включение Row Level Security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Политика безопасности: пользователи могут создавать заказы
CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (true);

-- Политика безопасности: пользователи могут читать свои заказы
CREATE POLICY "Users can view their orders" ON orders
    FOR SELECT USING (user_phone = current_setting('request.jwt.claims', true)::json->>'phone');

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();