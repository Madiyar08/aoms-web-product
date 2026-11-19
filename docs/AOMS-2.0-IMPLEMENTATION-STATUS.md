# AOMS 2.0 — implementation status

This archive is a development iteration. It is not a production release.

## Changes in iteration 4
- Introduced a dark Enterprise Operations Center application shell with grouped navigation, system-status header and responsive layout.
- Rebuilt the home dashboard using existing SQLite-backed ATM, category, status and cleaning-report data only. No synthetic operational counts are added.
- Preserved existing route destinations and existing business modules.
- Kept Node.js built-ins external in the server-side Webpack configuration; kept `sharp` external.
- Restored `node:fs` and `node:path` imports in the SQLite adapter.
- Replaced the shared UUID helper's direct `node:crypto` import with Node/Web Crypto `globalThis.crypto.randomUUID()`.

## Still not implemented
- Import preview + explicit confirmation workflow.
- Official GeoJSON boundaries and point-in-polygon validation.
- Verified district catalog for all 14 administrative units.
- Full regional monitoring filters and route grouping/optimization changes.
- Inspector Reports media workflow.
- Configurable RBAC, immutable audit log and soft-delete coverage.
- Warehouse analytics and workflow expansion.
- Complete QA matrix, Telegram integration, Android/iOS camera and Railway staging/restart/load tests.

## Verification
- Source archive structure checked.
- Automated unit tests and Next.js production build have **not** been run in this environment.
- Local startup was reported by the user for the preceding iteration after applying the server externalization configuration; this iteration's visual changes still require local verification.

## Production safety
No production database, Railway Volume, Railway environment variables, GitHub repository, or Telegram production destination was accessed or modified. Test against a copy of the production database before merging.


## Iteration 5 — безопасный двухэтапный импорт Excel (2026-11-18)

Сделано в исходниках:
- Импорт разделён на предварительную проверку и отдельное подтверждение.
- Предварительный этап использует ту же логику разбора/сопоставления, что и фактический импорт, но все изменения SQLite выполняются внутри транзакции, которая принудительно откатывается после формирования сводки.
- Создание справочных значений по умолчанию также находится внутри этой транзакции и откатывается в режиме preview.
- Для подтверждения файл нужно выбрать повторно; сервер сравнивает SHA-256 с файлом, прошедшим preview. Если содержимое отличается, импорт не выполняется.
- Добавлено ограничение размера файла 20 МБ и явное ограничение формата `.xlsx` (ExcelJS не читает старый бинарный `.xls`).
- После успешного импорта обновляются кэш-страницы `/atms` и `/monitoring`.

Проверки этой итерации:
- Geography unit tests: 4/4 прошли.
- TypeScript/build: не подтверждены — установленный `node_modules` неполный (каталоги `@types/*` пустые после прерванной установки зависимостей); `tsc --noEmit` останавливается на отсутствующих типах `geojson`, `leaflet`, `node`, `react` и др.
- Интеграционный тест preview/rollback с реальным Excel-файлом ещё не выполнен; поэтому этот этап не объявляется полностью QA-проверенным.

Не затрагивались production DB, Railway, GitHub и Telegram.

## Iteration 6 — корректность фактической статистики по районам (2026-11-18)

Сделано:
- Добавлен отдельный расчёт `countActualDistrictCompletions` для мониторинга.
- Количество очищенных банкоматов по районам теперь определяется по фактическому району и региону ATM в справочнике, а не по плановым районам экипажа.
- Уникальные ATM ID считаются один раз в рамках региона/района; одинаковые названия районов в городе Ташкенте и Ташкентской области не объединяются.
- Отчёты с ATM ID, отсутствующим в справочнике, не теряются молча: они выделяются в отдельную строку «Банкомат отсутствует в справочнике».
- Метрика переименована в «Уникальные банкоматы», чтобы не путать число уникальных точек с количеством отправленных отчётов.

Проверки:
- Unit tests: 6/6 прошли (4 география + 2 расчёты мониторинга).
- Проверены дубли ATM ID, разделение одинаковых районов по региону и неизвестные ATM ID.
- Полный Next.js build / TypeScript check не выполнен из-за неполной установки зависимостей в этой среде.
- Проверка на копии рабочей SQLite базы и визуальная проверка интерфейса ещё требуются.

Ограничение:
- План KPI по отдельным районам не показывается: текущая модель расписания хранит KPI на экипаж в целом, а не распределение KPI между районами. Чтобы не создавать ложные цифры, блок показывает только фактическое количество уникальных ATM по реальному району.

## Iteration 7 — наследование региона в Excel-импорте (2026-11-18)

Исправлено:
- Если Excel содержит колонку «Регион», но значение указано только в строке-разделителе, последующие строки банкоматов с пустой ячейкой региона теперь наследуют последний регион-разделитель.
- Явно заполненный регион в строке банкомата имеет приоритет над унаследованным значением.
- Добавлен unit test на оба сценария.

Проверки:
- Unit tests: 7/7 прошли.
- Полный TypeScript check и Next.js production build по-прежнему не подтверждены: зависимости в среде не установлены полностью.
- Интеграционная проверка импорта на копии SQLite и пользовательском Excel-файле ещё требуется.

Границы итерации:
- Справочник содержит 14 административных единиц верхнего уровня; полный подтверждённый перечень районов и официальные GeoJSON-границы ещё не добавлены.
- Неизвестные регионы не переименовываются автоматически и сохраняются для проверки администратором.
- Production DB, Railway, GitHub и Telegram не затрагивались.

## Iteration 8 — district geometry validation (2026-11-18)

Implemented in this iteration:
- Extracted the point-in-polygon algorithm into `lib/geometry-polygon.ts` so it can be unit-tested without loading SQLite modules.
- Point-in-polygon now treats points on polygon edges/vertices as inside and safely rejects non-finite coordinates and polygons with fewer than three vertices.
- District-boundary API validates latitude/longitude ranges, rejects malformed points instead of silently filtering them, and limits a boundary to 10,000 points.
- Added five focused geometry tests for inside/outside, edge, vertex, and invalid inputs.

Verification:
- `node --experimental-strip-types --test tests/*.test.mjs`: 12 tests passed, 0 failed.
- Full Next.js production build and TypeScript check were not run; dependency installation remains incomplete in this environment.

Known remaining issue:
- Boundary records are still keyed by district name only, not by `(region, district)`. Identically named districts in different regions can therefore collide in boundary management. This requires a backward-compatible data-model/UI migration and remains explicitly unresolved; do not treat district boundary coverage as production-ready for all 14 administrative units.

## Iteration 9 — region-scoped district boundaries

Implemented on top of Iteration 8:
- District boundary records now support optional `regionId`; the identity is region + normalized district name.
- Reads and writes can resolve a stable region ID from a region label, while explicit IDs take precedence.
- Polygon and nearest-center lookup can be restricted to a region, preventing same-named districts from being mixed across regions.
- Existing rows without `regionId` are preserved as explicitly legacy/unscoped records. They are not silently assigned to any region.
- Boundary API accepts optional `regionId` / `region` when saving.
- District mismatch checking now resolves the ATM region and scopes boundary lookup accordingly.

Verification:
- `node --experimental-strip-types --test tests/*.test.mjs`: 15 passed, 0 failed.
- Full Next.js build and TypeScript check were not run because dependencies are not installed/verified in this environment.

Known remaining work:
- The boundary editor UI still presents the legacy district-only selector and must be upgraded to select region + district before this feature is fully operable from the interface.
- Legacy boundary rows require explicit admin review/reassignment; no automatic migration was performed because the source region cannot safely be inferred from a district name alone.
- No official district GeoJSON dataset was added; boundaries remain admin-entered or fetched on demand from OpenStreetMap for review.

## Iteration 10 — Region-aware boundary editor (2026-11-18)

Implemented in this source package:
- Boundary editor now groups districts under the region derived from ATM master data (`regionId` first, then normalized `region` label).
- Selecting a region scopes the district selector, saved boundary lookup, current polygon, and overlay polygons.
- Boundary save requests include the selected region ID/name; legacy records remain in a separate explicit `legacy` group and are not auto-assigned.
- OpenStreetMap reference lookup now includes the selected region label in the query instead of always appending Tashkent.
- Previously saved boundaries that have no matching ATM are still exposed for editing through their stored region ID.

Verification:
- `node --experimental-strip-types --test tests/*.test.mjs`: 15 passed, 0 failed.
- Global `tsc --noEmit` was attempted but cannot complete because project dependencies and type declarations are not installed in this workspace (`next`, React, Node types, ExcelJS, etc. missing). This is an environment/dependency blocker, not a passing typecheck.
- Production build and browser/manual map verification remain outstanding.

Safety:
- No production database, Railway service, GitHub repository, or production Telegram integration was accessed or changed.

## Iteration 11 — Inspector reports foundation

Implemented a separate `inspector_reports` JSON-row table and service. Added a Telegram Mini App API endpoint restricted to authenticated employees with the `Проверяющий` role. The endpoint validates comments, up to five image attachments, coordinate ranges, and GPS accuracy; stores photos on the existing persistent-volume photo store; records GPS quality as good/weak/missing; and sends a non-blocking manager notification with notification result persisted on the report. Added an admin journal page and navigation entry. Inspector reports are not written to the cleaning reports table and therefore do not enter cleaning KPI calculations.

Automated validation: `node --experimental-strip-types --test tests/*.test.mjs` — 20 tests passed, 0 failed (includes five new inspector-report validation tests).

Not yet implemented in this iteration: Mini App submission form/camera UX, video upload (up to 60 seconds), durable Telegram media archive/outbox for inspector attachments, inspector report status/comment workflow, and full Next.js TypeScript/build verification. The API currently stores photos on the persistent volume and notifies the manager by text; do not interpret this as completed Telegram photo/video archival.


## Iteration 15 — Inspector review and media access

- Added admin status and manager-comment controls to inspector reports.
- Added protected PATCH endpoint with validation and session-cookie authorization.
- Added access control for local and Telegram-backed media referenced by inspector reports.
- Added tests for identifying inspector-only media references.
- Automated unit tests: 28 passed. Full Next.js build/typecheck and live browser/Telegram tests remain outstanding.

## Iteration 16 — RBAC foundation and administrative audit events (2026-11-18)

Implemented:
- Added a central role/permission catalogue for `super_admin`, `operations_manager`, `inspector`, and `viewer`.
- The existing shared `ADMIN_PASSWORD` session is mapped only to `super_admin`; no named employee identity or per-user login was invented.
- Added append-only audit event helpers and a read-only admin API for the latest events.
- Inspector report status/comment updates now write an audit event in the same SQLite transaction as the report update. If either write fails, both changes roll back.
- Added an admin audit journal page and navigation entry.
- Audit details record the report ID, resulting status, whether a comment changed, and comment length; the comment body itself is not duplicated into the audit log.

Verification:
- `node --experimental-strip-types --test tests/*.test.mjs`: 31 tests passed, 0 failed (3 new permission-matrix tests).
- Full Next.js production build, TypeScript check, and browser verification were not run because `node_modules` is absent in this workspace.

Important limitations:
- This is an RBAC foundation, not full configurable employee RBAC. Existing web authentication is still one shared password, so actions are attributed to `shared-admin-session`, not an individual staff member.
- Audit events are append-only through the application API/module; this is not cryptographic tamper-evidence or database-level write-once storage. A database operator with direct file access can still alter SQLite.
- Only inspector report review/comment actions are currently audited. ATM, schedule, employee, settings, and other administrative changes still need event instrumentation.

Production safety:
- No production SQLite database, Railway environment, GitHub repository, or live Telegram destination was accessed or modified.


## Iteration 17 — расширение аудита административных операций (2026-11-18)

Реализовано поверх Iteration 16:
- Добавлен каталог типов событий аудита для банкоматов, расписания, регулярного расписания, сотрудников и машин/экипажей.
- В ручном создании/изменении/удалении ATM и массовом изменении/удалении записываются события аудита. Для изменения ATM фиксируются только реально изменившиеся поля.
- Создание и удаление записей расписания, создание/включение/приостановка/удаление регулярного расписания фиксируются в журнале.
- Создание, изменение роли, привязка Telegram chat ID и удаление сотрудника фиксируются в журнале. Значения телефона, chat ID и текст комментариев не копируются в audit details.
- Создание/удаление машины и изменение привязки Telegram-группы фиксируются в журнале; сам chat ID не сохраняется в деталях аудита.
- Каждая пара «изменение данных + событие аудита» выполняется в одной SQLite-транзакции. При ошибке аудита изменение откатывается.
- Страница журнала показывает понятные русские названия действий и типов объектов.

Проверки:
- `node --experimental-strip-types --test tests/*.test.mjs`: 33 теста пройдены, 0 ошибок. Добавлены проверки каталога audit events.
- `tsc --noEmit` запускался, но не может завершиться: в рабочей папке отсутствуют Next.js, React, Node и другие зависимости/типы. Поэтому TypeScript и production build не объявляются пройденными.
- Реальная SQLite-копия, браузерные сценарии и проверка журнала после действий в UI ещё не выполнены.

Ограничения:
- Веб-вход остаётся на общем `ADMIN_PASSWORD`; журнал пока указывает `shared-admin-session`, а не конкретного пользователя. Полноценные индивидуальные учётные записи и назначение ролей через UI ещё не реализованы.
- Аудит покрывает перечисленные действия через существующие Server Actions. Импорт Excel, некоторые API/системные фоновые операции, настройки и другие изменения ещё требуют отдельной инструментализации.
- Журнал append-only на уровне приложения, но не защищён от прямого редактирования файла SQLite администратором сервера.

Production SQLite, Railway, GitHub и live Telegram не затрагивались.

## Iteration 19 — персональные учётные записи (2026-11-18)
- Добавлена таблица `admin_users` поверх существующего JSON-row SQLite адаптера.
- Добавлены salted scrypt password hashes и HMAC-SHA-256 signed 12-hour session tokens.
- Добавлен bootstrap Super Admin из `ADMIN_USERNAME`/`ADMIN_PASSWORD` при первом входе и пустой таблице пользователей.
- Добавлена страница `/users` и API создания, изменения роли/имени, включения/отключения и сброса пароля.
- Добавлена защита от отключения последнего активного Super Admin.
- Новые пользовательские события добавлены в Audit Log.
- Ограничены некоторые группы маршрутов по ролям; audit-log и inspector review API проверяют разрешения.
- Legacy shared-password session оставлена для обратной совместимости; отключать `ADMIN_PASSWORD` сразу нельзя.
- Automated unit tests: 40/40 passed (Node 22.16.0). Next.js build and TypeScript check not run because dependencies are not installed in the working environment.
- Staging validation, session revocation, and full per-action authorization audit remain outstanding.


## Iteration 21 — Telegram Mini App и webhook security (2026-11-18)

Реализовано:
- Проверка Telegram Mini App `initData` теперь требует валидную HMAC-подпись, `auth_date` не старше 24 часов, допустимое отклонение будущего времени не более 30 секунд и числовой Telegram user ID. 24-часовое окно выбрано, чтобы Mini App мог оставаться открытым в течение рабочей смены.
- Повторяющиеся ключи и payload длиннее 16 КБ отклоняются. Сравнение HMAC выполняется constant-time.
- Telegram webhook требует заголовок `X-Telegram-Bot-Api-Secret-Token`, совпадающий с `TELEGRAM_WEBHOOK_SECRET`; сравнение constant-time. При отсутствии настройки endpoint отвечает 503, при неверном/отсутствующем заголовке — 401.
- Добавлены `.env.example`, README и отдельная инструкция по настройке `setWebhook` с `secret_token`.
- Проверки вынесены в отдельный pure auth-core модуль, чтобы их можно было тестировать без загрузки Next.js/SQLite зависимостей.

Проверки:
- `node --experimental-strip-types --test tests/*.test.mjs`: 49 тестов пройдены, 0 ошибок.
- Добавлены тесты валидной подписи, устаревшего/будущего auth_date, подмены payload, повторяющихся ключей, отсутствующего Telegram user и webhook secret.
- TypeScript и Next.js production build не запускались: `node_modules` отсутствует.

Важно перед развёртыванием:
- Необходимо задать `TELEGRAM_WEBHOOK_SECRET` (случайная строка от 32 символов) и обновить webhook через Telegram `setWebhook` с параметром `secret_token`. Пока секрет не настроен, webhook намеренно не принимает события.
- Telegram Bot API, реальная доставка webhook и Mini App на Android/iOS в этой итерации не проверялись.

Production Railway, рабочая SQLite, GitHub и действующий Telegram webhook не изменялись.
