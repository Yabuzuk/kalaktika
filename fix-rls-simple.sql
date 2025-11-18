-- Удаляем ВСЕ политики
DROP POLICY IF EXISTS "Users can create profiles" ON users;
DROP POLICY IF EXISTS "Users can view and update own data" ON users;
DROP POLICY IF EXISTS "Users can create their orders" ON orders;
DROP POLICY IF EXISTS "Users can view their orders" ON orders;
DROP POLICY IF EXISTS "Users can update their orders" ON orders;
DROP POLICY IF EXISTS "Anyone can create users" ON users;
DROP POLICY IF EXISTS "Anyone can read users" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;

-- Отключаем RLS полностью
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Включаем RLS обратно
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Создаем новые простые политики
CREATE POLICY "Allow all users operations" ON users USING (true) WITH CHECK (true);
CREATE POLICY "Allow all orders operations" ON orders USING (true) WITH CHECK (true);