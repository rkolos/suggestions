# Сводная таблица эндпоинтов

| Метод | Путь | Назначение на фронте |
|-------|------|----------------------|
| GET | /api/v1/suggestions | Список: фильтры, **сортировка** (sort=id\|category\|score\|status\|created, order), **AI Grouping** (grouped=true или GET /clusters), total, facets |
| GET | /api/v1/suggestions/stats | Счётчики по статусам: сайдбар (New), фильтр в карточном списке |
| GET | /api/v1/suggestions/:id | Детальная панель, 404 → not-found; опционально unreadCommentsCount |
| PATCH | /api/v1/suggestions/:id | Статус и/или категория (или отдельные PATCH status/category) |
| POST | /api/v1/suggestions | Создание предложения; **isOfficial** — официальный пост (автор системный, id prop-, статус Open) |
| POST | /api/v1/suggestions/:id/vote | **Голосование:** upvote/downvote (виджет/публичная страница) |
| DELETE | /api/v1/suggestions/:id | Удаление из детальной панели |
| POST | /api/v1/suggestions/bulk/delete | Массовое удаление (Bulk Actions) |
| POST | /api/v1/suggestions/bulk/status | **Массовое изменение статуса** (Bulk Set Status) |
| POST | /api/v1/suggestions/merge | Слияние одного = подтверждение дубликата (sourceId → targetId) |
| POST | /api/v1/suggestions/bulk/merge | Массовое слияние выбранных |
| GET | /api/v1/suggestions/:id/widget или /public | **Open in Widget:** публичная ссылка или данные для виджета |
| POST | /api/v1/suggestions/similar | Поиск похожих по тексту (форма создания); body `{ "text": "..." }` |
| GET | /api/v1/suggestions/:id/duplicates | AI-анализ: дубликаты для предложения :id, список с Match Score |
| POST | /api/v1/suggestions/:id/dismiss-duplicates | "Похожих нет" |
| GET | /api/v1/suggestions/:id/discord-preview | **Discord Preview:** payload/embed для предпросмотра в Discord |
| GET | /api/v1/suggestions/config | Настройки (Categories, Notifications; version, suggestionCount/canDelete) |
| PUT | /api/v1/suggestions/config | Сохранение настроек (409 при удалении категории с предложениями) |
| GET | /api/v1/suggestions/settings/notifications | Только шаблоны уведомлений (получение) |
| PUT | /api/v1/suggestions/settings/notifications | Только шаблоны уведомлений (редактирование) |
| GET | /api/v1/suggestions/config/defaults | Дефолтные шаблоны для "Reset to Default" |
| GET | /api/v1/suggestions/bans (алиас /banned-users) | Список забаненных, **поиск** ?search= (админ-панель) |
| DELETE | /api/v1/suggestions/bans/:userId (алиас /banned-users/:id) | Unban |
| POST | /api/v1/suggestions/bans (алиас /banned-users) | Ban user |
| GET | /api/v1/suggestions/:id/comments | Team Chat — список сообщений |
| POST | /api/v1/suggestions/:id/comments | Team Chat — отправка сообщения |
| PATCH | /api/v1/suggestions/comments/:commentId | Team Chat — редактирование комментария (плоский маршрут) |
| DELETE | /api/v1/suggestions/comments/:commentId | Team Chat — удаление комментария (плоский маршрут) |
| POST | /api/v1/suggestions/:id/comments/typing | Опционально: индикатор печати (real-time) |
| GET | /api/v1/suggestions/categories | Опционально: только список категорий |
| GET | /api/v1/me (или /users/me, /auth/me) | **Проверка прав:** роль (Admin/Manager/Owner), permissions для скрытия Settings и "Post as Official" |

Детальное описание каждого метода: [04-endpoints-suggestions.md](04-endpoints-suggestions.md), [05-endpoints-duplicates-config.md](05-endpoints-duplicates-config.md), [06-endpoints-team-config.md](06-endpoints-team-config.md).
