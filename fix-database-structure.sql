-- Исправление структуры базы данных

-- 1. Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Добавление user_id в orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- 3. Исправление RLS политик
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can view their orders" ON orders;

-- Разрешаем всем создавать заказы
CREATE POLICY "Allow insert orders" ON orders
    FOR INSERT WITH CHECK (true);

-- Разрешаем всем читать заказы
CREATE POLICY "Allow select orders" ON orders
    FOR SELECT USING (true);

-- Разрешаем всем обновлять заказы
CREATE POLICY "Allow update orders" ON orders
    FOR UPDATE USING (true);

-- 4. Включение RLS для users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on users" ON users
    FOR ALL USING (true);

-- 5. Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- 6. Триггер для users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();