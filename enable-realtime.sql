-- Включаем Realtime для таблицы orders
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Включаем Realtime для таблицы users  
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Включаем Realtime для таблицы drivers
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;