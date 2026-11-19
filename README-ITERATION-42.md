# Iteration 42 — SQLite integrity and transaction safety

## Что изменено

- Добавлена строгая проверка внутренних имён таблиц SQLite до построения SQL.
- При открытии БД задаются `busy_timeout=5000`, `foreign_keys=ON` и `synchronous=FULL`.
- Существующий journal mode намеренно не меняется: переключение production SQLite на WAL требует отдельного плана резервного копирования и проверки восстановления на копии Volume.
- Вложенные `withTransaction` теперь используют SQLite SAVEPOINT. Если вложенная операция падает, а внешний код перехватывает ошибку, изменения вложенной операции откатываются отдельно.
- Ошибки разбора повреждённого JSON содержат контекст таблицы и ID записи.
- Добавлена read-only диагностика `checkDatabaseIntegrity()` на базе `PRAGMA quick_check`.
- Добавлены интеграционные тесты реальной временной SQLite-базы: CRUD, внешний rollback, вложенные savepoint, небезопасные имена таблиц, повреждённый JSON и integrity check.

## Проверка

Команда:

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

Итог тестов указан в сопроводительном ответе. Проверка выполняется на временной тестовой базе, не на production SQLite.

## Ограничения

- Production SQLite, Railway Volume, GitHub и Telegram не открывались и не изменялись.
- WAL не включался и миграции схемы не выполнялись.
- Полный TypeScript check и Next.js production build не запускались, так как `node_modules` отсутствует.
- `quick_check` является лёгкой диагностикой целостности, а не заменой резервной копии и полного восстановления из backup.
