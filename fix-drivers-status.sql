-- Обновляем статус всех существующих водителей на pending
UPDATE drivers SET status = 'pending' WHERE status = 'active';

-- Обновляем значение по умолчанию для новых водителей
ALTER TABLE drivers ALTER COLUMN status SET DEFAULT 'pending';