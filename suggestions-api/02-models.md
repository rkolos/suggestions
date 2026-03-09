# Модели данных (общие)

Использовать те же сущности, что и во фронте (`data/suggestions.ts`, `data/suggestionsConfig.ts`), чтобы контракт был однозначным.

## 2.1 Suggestion (предложение)

| Поле | Тип | Описание |
|------|-----|----------|
| id | string | Уникальный идентификатор (см. «Генерация ID» ниже) |
| source | `'discord' \| 'web'` | Источник |
| author | Author | Автор (обязательно с полем **id** для связей в БД и проверки прав) |
| content | Content | Заголовок, описание, категория |
| metrics | Metrics | score, upvotes, downvotes |
| lifecycle | Lifecycle | status, merged_into? |
| created_at | string | ISO 8601 |
| updated_at | string | ISO 8601 — дата последнего изменения (для сортировки и индикатора «отредактировано») |
| ai_summary? | string | Текст для AI-блока (опционально; см. «Поле ai_summary» ниже) |
| type? | `'official_proposal'` | Официальное предложение |
| isPinned? | boolean | Закреплено вверху списка |

**Author:** `{ id: string, username: string, avatar_url: string, isSystem?: boolean }` — поле **id** обязательно. Это ID пользователя в системе: по нему связывают сущности в БД, передают в POST /bans (userId), проверяют права на редактирование/удаление комментария в Team Chat (совпадение текущего пользователя с author.id). **Зарезервированный id:** см. раздел «Зарезервированные значения» ниже.  
**Content:** `{ title: string, description: string, category: string }` — категория может иметь разное отображение на фронте (например Financial → BILLING), бекенд отдаёт значение поля, отображение на усмотрение фронта.  
**Metrics:** `{ score: number, upvotes: number, downvotes: number }`  
**Lifecycle:** `{ status: SuggestionStatus, merged_into?: string }`  
**SuggestionStatus:** `'New' | 'Open' | 'Duplicate' | 'Planned' | 'In Progress' | 'Completed' | 'Rejected'`

**Генерация ID предложений:** бекенд должен однозначно задать формат. Допустимы два варианта: (1) **последовательный автоинкремент** в БД — цифровая часть идёт по порядку (1, 2, 3…), префикс `sug_` или `prop-` в зависимости от типа; (2) **уникальный непредсказуемый идентификатор** — префикс + nanoid/uuid (например `sug_abc12xyz`, `prop-def34uvw`). В API контракте id — строка; выбор варианта остаётся за бекендом (для репликации и распределённой генерации предпочтителен вариант 2).

**Поле ai_summary:** заполняется бекендом. Варианты: (1) **асинхронно** после создания или значимого изменения предложения (фоновый воркер/очередь); (2) **по запросу** — отдельный эндпоинт `POST /api/v1/suggestions/:id/generate-summary` запускает генерацию и по завершении возвращает или обновляет поле; (3) комбинация (например кэш при первом запросе). В ответах GET suggestion и в списке поле опционально; если ещё не сгенерировано — не передавать или передавать null.

## 2.2 SuggestionCluster (для AI Grouping)

| Поле | Тип |
|------|-----|
| master | Suggestion |
| children | Suggestion[] |
| totalDuplicates | number |

## 2.3 SuggestionsConfig (настройки)

| Поле | Тип |
|------|-----|
| categories | SuggestionCategory[] |
| notifications | NotificationTemplates |
| version? | string | Опционально: метка версии для отображения в UI (например "v2.0" в заголовке списка) |

**SuggestionCategory:** `{ id: string, label: string, color: string }` — при необходимости для проверки удаления категории добавлять `suggestionCount?: number` или `canDelete?: boolean` (см. [06-endpoints-team-config.md](06-endpoints-team-config.md)).  
**NotificationTemplates:** `{ ticket_created: string, ticket_approved: string, ticket_rejected: string, ticket_merged: string }`  
Шаблоны из config используются бекендом при отправке уведомлений (Discord: ЛС автору и сообщение в треде); фронт только загружает и сохраняет их в настройках. Отдельного эндпоинта «получить один шаблон» не требуется. Плейсхолдеры: `{{user}}`, `{{id}}`, `{{title}}` — для всех; для ticket_merged дополнительно: `{{targetTitle}}`, `{{targetDescription}}`, `{{targetUrl}}` (ссылка на сообщение в Discord, в которое смержили; заполняется, если у целевого предложения есть discordMessageId и в конфиге компании заданы discordGuildId и suggestionsChannelId).

## 2.4 BannedUser

| Поле | Тип |
|------|-----|
| id | string |
| username | string |
| avatar_url | string |
| banned_at | string (ISO 8601) |

## 2.5 Duplicate candidate (для вкладки Duplicates)

| Поле | Тип |
|------|-----|
| id | string | **ID существующего suggestion** — того, **в который** сливаем (target). При нажатии Merge фронт вызывает POST merge с sourceId = текущее предложение, targetId = duplicate.id. |
| title | string |
| status | string | например "in_progress", "closed" |
| matchScore | number | 0–100 |
| excerpt | string |
| upvotes | number |
| downvotes | number |

## 2.6 Team Chat (внутренние комментарии)

- **Message:** `{ id: string, author: { id: string, username: string, avatar_url?: string }, body: string, created_at: string (ISO), updated_at: string (ISO) }`  
У автора комментария обязательно поле **author.id** (ID пользователя) — для проверки прав на редактирование/удаление (совпадает ли текущий пользователь с author.id). Поле **updated_at** — дата последнего изменения (если редактировался); для отображения индикатора «отредактировано» и сортировки.  
При необходимости — pagination (cursor/limit).  
Опционально: бекенд может отдавать **unreadCommentsCount** (в GET suggestion или отдельно GET .../comments/unread-count), чтобы фронт показывал бейдж на вкладке Team Chat; при открытии вкладки — сброс (например POST .../comments/read).

## Зарезервированные значения

### Системный пользователь (author.id = "system")

Идентификатор **`"system"`** зарезервирован для технических действий от имени системы:

- Комментарии при слиянии дубликатов (например: «Идея объединена с [ID]»)
- Системные уведомления

Запись с `id = "system"` создаётся в таблице `users` через Prisma seed (`npx prisma db seed`). При ответах API автор с таким id может быть представлен как:

```json
{
  "id": "system",
  "username": "System",
  "avatar_url": null,
  "isSystem": true
}
```

Поле `isSystem: true` (опционально) позволяет фронтенду и интеграциям отличать системные сообщения от пользовательских.

## 2.6a Связь пользователя и голосов (таблица votes)

В API в объекте Suggestion отдаются только агрегаты **metrics** (score, upvotes, downvotes). Для БД и защиты от накрутки бекенд обязан хранить связь «кто за что проголосовал»: отдельная таблица (или сущность) **votes** с полями, например: `suggestion_id`, `user_id`, `vote` (upvote | downvote) или `direction` (+1 | -1). Один пользователь — один голос на предложение (повторный/противоположный голос обрабатывается по Toggle-логике, см. [04-endpoints-suggestions.md](04-endpoints-suggestions.md)#голосование-vote). В JSON эта связь не отдаётся; при изменении голосов пересчитываются metrics и отдаются в ответах GET/POST vote.
