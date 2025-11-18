-- Проверяем и исправляем доступ к таблице drivers
-- Удаляем все политики для drivers
DROP POLICY IF EXISTS "Allow all drivers operations" ON drivers;

-- Отключаем и включаем RLS
ALTER TABLE drivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Создаем универсальную политику
CREATE POLICY "Allow all operations on drivers" ON drivers USING (true) WITH CHECK (true);