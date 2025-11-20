# Файлы для удаления

## ❌ Устаревшие страницы авторизации:
- `login.html` - заменен на `user-login.html`
- `driver-login.html` - заменен на `driver-auth.html`

## ❌ Неиспользуемые SQL файлы:
- `create-drivers-table.sql` - дублирует `drivers-database.sql`
- `fix-constraint.sql` - одноразовый фикс
- `fix-drivers-access.sql` - одноразовый фикс  
- `fix-drivers-status.sql` - одноразовый фикс
- `fix-rls-policies.sql` - одноразовый фикс
- `fix-rls-simple.sql` - одноразовый фикс
- `rls-functions.sql` - одноразовый фикс
- `test-data.sql` - тестовые данные
- `update-database.sql` - одноразовый фикс

## ❌ Неиспользуемые файлы:
- `resource-hints.html` - не подключен
- `service-worker-cache.js` - не используется
- `sms-config.js` - SMS не реализовано
- `SMS-SETUP.md` - SMS не реализовано

## ✅ Оставить (используются):
- Все HTML страницы (кроме login.html, driver-login.html)
- Все JS файлы (кроме sms-config.js, service-worker-cache.js)
- Основные SQL файлы (database-setup.sql, drivers-database.sql, users-database.sql)
- Документация (README.md, MOBILE-FIX.md, RECOMMENDATIONS.md)
- PWA файлы (manifest.json, driver-manifest.json, sw.js, icon-192.png)
- Стили (styles.css, admin-styles.css, driver-styles.css)

## 📋 Итого к удалению: 15 файлов