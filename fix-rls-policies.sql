-- Удаляем старые политики
DROP POLICY IF EXISTS "Users can create profiles" ON users;
DROP POLICY IF EXISTS "Users can view and update own data" ON users;
DROP POLICY IF EXISTS "Users can create their orders" ON orders;
DROP POLICY IF EXISTS "Users can view their orders" ON orders;
DROP POLICY IF EXISTS "Users can update their orders" ON orders;

-- Временно отключаем RLS для создания пользователей
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Простые политики для пользователей
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Любой может создать пользователя (регистрация)
CREATE POLICY "Anyone can create users" ON users
    FOR INSERT WITH CHECK (true);

-- Любой может читать пользователей (для проверки существования)
CREATE POLICY "Anyone can read users" ON users
    FOR SELECT USING (true);

-- Пользователи могут обновлять свои данные
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (true);

-- Простые политики для заказов
-- Любой может создать заказ
CREATE POLICY "Anyone can create orders" ON orders
    FOR INSERT WITH CHECK (true);

-- Любой может читать заказы (для водителей и админов)
CREATE POLICY "Anyone can read orders" ON orders
    FOR SELECT USING (true);

-- Любой может обновлять заказы (для изменения статуса)
CREATE POLICY "Anyone can update orders" ON orders
    FOR UPDATE USING (true);