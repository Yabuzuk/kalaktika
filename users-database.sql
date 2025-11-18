-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Включение Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут создавать свои профили
CREATE POLICY "Users can create profiles" ON users
    FOR INSERT WITH CHECK (true);

-- Политика: пользователи могут читать и обновлять свои данные
CREATE POLICY "Users can view and update own data" ON users
    FOR ALL USING (phone = current_setting('app.current_user_phone', true));

-- Обновляем таблицу заказов - добавляем связь с пользователями
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);

-- Создаем индекс для связи
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Обновляем политики безопасности для заказов
DROP POLICY IF EXISTS "Users can view their orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;

-- Новые политики с привязкой к user_id
CREATE POLICY "Users can create their orders" ON orders
    FOR INSERT WITH CHECK (user_id IN (
        SELECT id FROM users WHERE phone = current_setting('app.current_user_phone', true)
    ));

CREATE POLICY "Users can view their orders" ON orders
    FOR SELECT USING (user_id IN (
        SELECT id FROM users WHERE phone = current_setting('app.current_user_phone', true)
    ));

CREATE POLICY "Users can update their orders" ON orders
    FOR UPDATE USING (user_id IN (
        SELECT id FROM users WHERE phone = current_setting('app.current_user_phone', true)
    ));

-- Функция для автоматического обновления updated_at в таблице users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();