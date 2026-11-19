# Iteration 40 — защита экспорта ATM по RBAC

## Что изменено

- Полный экспорт реестра ATM (`/api/atms/export`) теперь доступен только роли `super_admin`.
- Экспорт матрицы покрытия (`/api/atms/coverage-export`) также ограничен ролью `super_admin`, поскольку содержит полный массив данных по банкоматам и отчётам.
- Общие права `atms:write` больше не дают операционному менеджеру возможность выгружать полный реестр.
- Ограничение применяется централизованной серверной политикой `requiredApiPermission`, вызываемой middleware для API.
- Добавлен регрессионный тест для super-admin, operations-manager и viewer.

## Проверка

Запустить:

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

Production database, Railway, GitHub и Telegram не затрагивались. TypeScript и production build отдельно не подтверждены.
