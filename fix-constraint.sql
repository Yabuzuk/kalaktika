-- Удаляем старый constraint
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_status_check;

-- Добавляем новый constraint с pending
ALTER TABLE drivers ADD CONSTRAINT drivers_status_check 
CHECK (status IN ('pending', 'active', 'blocked'));

-- Обновляем статус всех существующих водителей на pending
UPDATE drivers SET status = 'pending' WHERE status NOT IN ('pending', 'active', 'blocked');

-- Обновляем значение по умолчанию
ALTER TABLE drivers ALTER COLUMN status SET DEFAULT 'pending';