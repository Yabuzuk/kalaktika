-- Добавляем поле driver_id к существующей таблице
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id VARCHAR(50);

-- Создаем индекс для driver_id
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);

-- Политика для водителей - могут читать и обновлять заказы
DROP POLICY IF EXISTS "Drivers can view orders" ON orders;
CREATE POLICY "Drivers can view orders" ON orders
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can update orders" ON orders;
CREATE POLICY "Drivers can update orders" ON orders
    FOR UPDATE USING (true);