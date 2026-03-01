# Документация API бекенда для модуля Suggestions

Единая документация разбита на структурированный набор файлов. Вся информация сохранена; ссылки между разделами ведут на соответствующие файлы.

---

## Содержание документации

| Документ | Описание |
|----------|----------|
| [01-overview.md](01-overview.md) | **Обзор модуля и экранов** — список экранов (/suggestions, детали, модалки, not-found/error), назначение и связь с API. |
| [02-models.md](02-models.md) | **Модели данных** — Suggestion, Author, SuggestionCluster, SuggestionsConfig, BannedUser, Duplicate candidate, Message (Team Chat); связь пользователя и голосов (таблица votes); генерация ID, ai_summary, updated_at. |
| [03-conventions.md](03-conventions.md) | **Соглашения API** — пагинация (page/limit, жёсткий максимум), формат ошибок (коды 400/401/403/404/409), формат ответа при grouped=true (кластеры), аутентификация и текущий пользователь. |
| [04-endpoints-suggestions.md](04-endpoints-suggestions.md) | **Эндпоинты: предложения** — GET список (поиск, сортировка, AI Grouping), GET один, PATCH статус/категория, POST создание (isOfficial, source), POST vote (Toggle-логика), DELETE один, POST bulk/delete, merge, bulk/merge, bulk/status, GET widget/public. |
| [05-endpoints-duplicates-config.md](05-endpoints-duplicates-config.md) | **Эндпоинты: дубликаты и конфиг** — GET/POST duplicates, dismiss-duplicates, Discord Preview; GET/PUT config, GET config/defaults; GET/PUT settings/notifications; GET/DELETE/POST bans (Ban/Unban), последствия бана. |
| [06-endpoints-team-config.md](06-endpoints-team-config.md) | **Эндпоинты: Team Chat и прочее** — GET/POST/PATCH/DELETE comments, typing; проверка удаления категории; GET counts/stats; GET categories; GET /me (роль, permissions). |
| [07-endpoints-summary.md](07-endpoints-summary.md) | **Сводная таблица эндпоинтов** — таблица «Метод | Путь | Назначение» по всем методам API. |
| [08-screens-mapping.md](08-screens-mapping.md) | **Привязка по экранам и элементам** — какой экран/кнопка какой эндпоинт использует (список, деталь, виджет, Create, Settings, Bulk, права). |
| [09-recommendations.md](09-recommendations.md) | **Рекомендации по документу для разработчика** — что реализовано в документации (примеры JSON, ошибки, пагинация, grouped, аутентификация), экспорт в OpenAPI/Swagger. |

---

## Быстрый старт

1. Обзор и модели: [01-overview.md](01-overview.md), [02-models.md](02-models.md).  
2. Правила запросов/ответов: [03-conventions.md](03-conventions.md).  
3. Полный список методов: [07-endpoints-summary.md](07-endpoints-summary.md).  
4. Детали по каждому методу: [04-endpoints-suggestions.md](04-endpoints-suggestions.md), [05-endpoints-duplicates-config.md](05-endpoints-duplicates-config.md), [06-endpoints-team-config.md](06-endpoints-team-config.md).  
5. Связь фронта с API: [08-screens-mapping.md](08-screens-mapping.md).
