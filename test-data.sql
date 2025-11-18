-- Тестовые водители
INSERT INTO drivers (full_name, phone, service_type, car_number, status) VALUES
('Иванов Иван Иванович', '+7 (914) 111-11-11', 'water', 'А123БВ77', 'active'),
('Петров Петр Петрович', '+7 (914) 222-22-22', 'septic', 'В456ГД77', 'pending'),
('Сидоров Сидор Сидорович', '+7 (914) 333-33-33', 'both', 'Г789ЕЖ77', 'active')
ON CONFLICT (phone) DO NOTHING;