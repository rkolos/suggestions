# Покрытие эндпоинтов API задачами (блоки 3–5)

Документ явно привязывает эндпоинты из [suggestions-api](../suggestions-api/) (07-endpoints-summary.md, 08-screens-mapping.md) к задачам плана разработки в `about/`. Используется для проверки полноты плана и однозначного отнесения каждого эндпоинта к TASK.

---

## Сводная таблица

| Эндпоинт | Метод | Назначение | Задача в плане |
|----------|--------|------------|----------------|
| `/api/v1/suggestions` | GET | Список: фильтры, сортировка, пагинация, AI Grouping (`grouped=true` или GET /clusters), facets | **TASK-3.2** (подпункт: параметр `grouped`, формат кластеров и facets — см. 04-endpoints-suggestions, 03-conventions) |
| `/api/v1/suggestions/stats` | GET | Счётчики по статусам (сайдбар, фильтр) | **TASK-3.5** (GET /stats или /suggestions/stats) |
| `/api/v1/suggestions/:id` | GET | Детальная панель; 404 → not-found | **TASK-3.2** |
| `/api/v1/suggestions/:id` | PATCH | Статус и/или категория | **TASK-3.2** (PATCH /:id, PATCH /:id/status) |
| `/api/v1/suggestions` | POST | Создание; isOfficial — официальный пост | **TASK-3.2** |
| `/api/v1/suggestions/:id/vote` | POST | Голосование upvote/downvote | **TASK-3.5** |
| `/api/v1/suggestions/:id` | DELETE | Удаление из детальной панели | **TASK-3.2** |
| `/api/v1/suggestions/bulk/delete` | POST | Массовое удаление | **TASK-3.3** |
| `/api/v1/suggestions/bulk/status` | POST | Массовое изменение статуса | **TASK-3.3** |
| `/api/v1/suggestions/merge` | POST | Слияние одного (sourceId → targetId) | **TASK-3.3**, доменная логика **TASK-2.4** |
| `/api/v1/suggestions/bulk/merge` | POST | Массовое слияние | **TASK-3.3** |
| `/api/v1/suggestions/:id/widget` или `/:id/public` | GET | Open in Widget: публичная ссылка или данные для виджета | **TASK-3.2** (подпункт «Виджет и публичная страница») |
| `/api/v1/suggestions/similar` | POST | Поиск похожих по тексту (форма создания) | **TASK-5.2** |
| `/api/v1/suggestions/:id/duplicates` | GET | Дубликаты для предложения :id (вкладка Duplicates) | **TASK-5.2** (подпункт GET /:id/duplicates) |
| `/api/v1/suggestions/:id/dismiss-duplicates` | POST | «Похожих нет» | **TASK-5.2** (подпункт POST /:id/dismiss-duplicates) |
| `/api/v1/suggestions/:id/discord-preview` | GET | Discord Preview: payload/embed для предпросмотра | **TASK-3.2** |
| `/api/v1/suggestions/config` | GET, PUT | Настройки (Categories, Notifications; version и т.д.) | **TASK-3.1** |
| `/api/v1/suggestions/settings/notifications` | GET, PUT | Только шаблоны уведомлений | **TASK-3.1** (подпункт) |
| `/api/v1/suggestions/config/defaults` | GET | Дефолтные шаблоны для Reset to Default | **TASK-3.1** (подпункт) |
| `/api/v1/suggestions/bans` (алиас /banned-users) | GET, POST | Список забаненных, поиск ?search=, Ban | **TASK-3.4** |
| `/api/v1/suggestions/bans/:userId` | DELETE | Unban | **TASK-3.4** |
| `/api/v1/suggestions/:id/comments` | GET, POST | Team Chat — список и отправка | **TASK-3.4** |
| `/api/v1/suggestions/comments/:commentId` | PATCH, DELETE | Team Chat — редактирование и удаление (плоский маршрут по API) | **TASK-3.5** (путь уточняется по согласованию с API) |
| `/api/v1/suggestions/:id/comments/typing` | POST | Опционально: индикатор печати (real-time) | **TASK-3.4** или **TASK-3.5** (опционально; в плане не обязателен для MVP) |
| `/api/v1/suggestions/categories` | GET | Опционально: только список категорий | **TASK-3.1** (можно отдавать из того же ConfigController или отдельный роут) |
| `/api/v1/me` (или /users/me, /auth/me) | GET | Текущий пользователь: id, username, avatarUrl, **role**, **permissions** | **TASK-3.7** (расширить контракт: role и permissions для скрытия Settings и «Post as Official») |

---

## Примечания

- **AI Grouping и facets:** параметр `grouped=true` и опциональный формат ответа с кластерами (`type: "cluster"`) и facets описаны в suggestions-api (04-endpoints-suggestions, 03-conventions). В TASK-3.2 явно добавить подпункт: поддержка query `grouped`, формат кластеров, опциональные facets в ответе списка.
- **Виджет/public:** эндпоинт GET widget или /public и связь с POST vote для публичной страницы описаны в TASK-3.2 (подпункт «Виджет и публичная страница»).
- **Дубликаты:** два сценария — (1) POST /similar для модалки создания; (2) GET /:id/duplicates и POST /:id/dismiss-duplicates для вкладки Duplicates на детальной панели — оба отнесены к TASK-5.2 с явными подпунктами в описании задачи.
- **Config:** GET/PUT config/defaults и GET/PUT settings/notifications входят в TASK-3.1 (расширение ConfigController или отдельные роуты).
- **GET /me:** в TASK-3.7 зафиксировать возврат полей `role` и `permissions` (canManageSuggestionsConfig, canPostOfficialProposal, canBanUsers) по контракту API 06/07/08.

После согласования путей и форматов с suggestions-api (см. [TASK-0.5](0_5.md) «Согласование плана с suggestions-api») при необходимости обновить номера путей в данной таблице.
