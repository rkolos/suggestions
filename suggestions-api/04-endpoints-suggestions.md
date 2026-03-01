# Эндпоинты: предложения (список, CRUD, голосование, bulk, widget)

Ссылки: [модели](02-models.md), [соглашения](03-conventions.md).

---

## 3.1 Список предложений (главная таблица и левая колонка на детали)

**Метод и путь:** `GET /api/v1/suggestions`

**Query (все опциональны):**
- `q` — полнотекстовый поиск. Рекомендуется искать минимум по **title** и **id**; желательно также по **content.description** и **author.username**, чтобы соответствовать ожиданиям пользователей (поиск по тексту описания и по имени автора). Если бекенд поддерживает только часть полей — зафиксировать это в контракте (например: «q ищет по title, id, description, author.username»).
- `status` — фильтр по статусам, массив: `status=New&status=Open` (или один статус).
- `category` — фильтр по категориям, массив.
- `score_gt` — score строго больше (number).
- `score_lt` — score строго меньше (number).
- `created_from` — дата от (ISO date или YYYY-MM-DD).
- `created_to` — дата до.
- **Сортировка (Sorting):** параметр `sort` — поле сортировки: `id` (по идентификатору), `category` (по категории), `score` (по баллу), `status` (по статусу), `created` (по дате создания). Параметр `order` — направление: `asc` | `desc`. По умолчанию рекомендуется `sort=score`, `order=desc`. Невалидное значение `sort` — 400.
- **AI Grouping:** параметр `grouped` — при `grouped=true` бекенд возвращает кластеры (мастер-предложение + список дочерних) и одиночные предложения (формат — [03-conventions.md](03-conventions.md)#формат-ответа-при-groupedtrue-get-suggestions). Альтернатива: отдельный эндпоинт `GET /api/v1/suggestions/clusters` с теми же query-фильтрами, возвращающий только `{ items: SuggestionCluster[], total: number }`; фронт при необходимости объединяет с одиночными из GET suggestions без grouped.
- `page`, `limit` — пагинация (по умолчанию page=1, limit=20; см. [03-conventions.md](03-conventions.md)#пагинация).

**Коды ответов:** 200 OK, 400 Bad Request (невалидные query), 401 Unauthorized (если эндпоинт защищён).

**Пример запроса:**  
`GET /api/v1/suggestions?status=New&status=Open&sort=score&order=desc&page=1&limit=20`

**Пример ответа 200 (без группировки):**

```json
{
  "items": [
    {
      "id": "sug_8821",
      "source": "discord",
      "author": { "id": "user_42", "username": "john_doe", "avatar_url": "https://...", "isSystem": false },
      "content": { "title": "Добавить темную тему", "description": "...", "category": "UI" },
      "metrics": { "score": 42, "upvotes": 45, "downvotes": 3 },
      "lifecycle": { "status": "Open" },
      "created_at": "2024-01-20T10:30:00Z",
      "updated_at": "2024-01-20T10:30:00Z"
    }
  ],
  "total": 1
}
```

При `grouped=true` элементы в `items` — либо объекты с `"type": "cluster"` (master, children, totalDuplicates), либо объекты Suggestion без type или с `"type": "suggestion"` (см. [03-conventions.md](03-conventions.md)). Опционально в ответе: `facets: { byStatus: { New: number, Open: number, ... } }`.

**Назначение:**  
- Страница списка: таблица, заголовок с total, фильтры, сортировка, Refresh, AI Grouping.  
- Левая колонка на `/suggestions/[id]`: тот же список с фильтрами и поиском.

---

## 3.2 Один предложение (детальная панель и проверка 404)

**Метод и путь:** `GET /api/v1/suggestions/:id`

**Коды ответов:** 200 OK, 404 Not Found (предложение не найдено — фронт показывает not-found), 401 Unauthorized (если защищён).

**Пример ответа 200:**

```json
{
  "id": "sug_8821",
  "source": "discord",
  "author": { "id": "user_42", "username": "john_doe", "avatar_url": "https://...", "isSystem": false },
  "content": { "title": "Добавить темную тему", "description": "...", "category": "UI" },
  "metrics": { "score": 42, "upvotes": 45, "downvotes": 3 },
  "lifecycle": { "status": "Open" },
  "created_at": "2024-01-20T10:30:00Z",
  "updated_at": "2024-01-20T10:30:00Z",
  "unreadCommentsCount": 2
}
```

Опционально: поле `unreadCommentsCount` для бейджа Team Chat.

**Назначение:**  
- Загрузка деталей при открытии `/suggestions/[id]`, все поля правой панели (Properties, Voting, автор, контент, статус, категория).

---

## 3.3 Обновление статуса

**Метод и путь:** `PATCH /api/v1/suggestions/:id`  
**Body:** `{ "lifecycle": { "status": "Open" } }` (частичное обновление). Альтернатива: `PATCH /api/v1/suggestions/:id/status` с телом `{ "status": "Open" }`.

**Переходы между статусами:** строгой машины состояний (State Machine) для статусов в данном контракте не задано. **Разрешены любые переходы** с любого статуса на любой (New → Rejected, Completed → Open и т.д.). Если позже потребуется ограничить переходы — описать допустимые в отдельном подпункте.

**Коды ответов:** 200 OK, 400 Bad Request (неверный статус), 404 Not Found, 401/403.

**Пример ответа 200:** обновлённый объект `Suggestion` (полностью).

**Назначение:**  
- Выбор статуса в детальной панели; тост "Discord Embed updated".  
- Массовая смена статуса в Bulk Actions (см. ниже).

---

## 3.4 Обновление категории

**Метод и путь:** `PATCH /api/v1/suggestions/:id`  
**Body:** `{ "content": { "category": "UI" } }`. Альтернатива: `PATCH /api/v1/suggestions/:id/category` с телом `{ "category": "UI" }`.

**Коды ответов:** 200 OK, 400 Bad Request (категория не из списка), 404 Not Found, 401/403.

**Пример ответа 200:** обновлённый объект `Suggestion`.

**Назначение:**  
- Выбор категории в детальной панели.

---

## 3.5 Создание предложения

**Метод и путь:** `POST /api/v1/suggestions`  
**Body:**  
`{ "title": "Add dark mode", "description": "...", "category": "UI", "isOfficial": false, "source": "web" }`  
Поле **source** опционально: если фронт не передаёт — бекенд по умолчанию ставит `'web'` для всех запросов с веб-приложения. Если предложение создаётся из интеграции (Discord и т.д.), бекенд может принять `source: "discord"` или выставить его сам. Категория должна быть из списка настроек. **Специфика официальных постов (isOfficial):** при `isOfficial === true` бекенд применяет другую логику: автор — системный (например `author: { id: "<system_user_id>", username: "Ninja Product Team", avatar_url: "...", isSystem: true }`), префикс ID — `prop-` (вместо `sug-`), статус по умолчанию — `Open` (вместо `New`), выставляются `type: "official_proposal"` и `isPinned: true`. Требуются права администратора (403 при отсутствии). Автор обычного предложения берётся из токена/сессии (author.id и username подставляются бекендом).

**Коды ответов:** 201 Created, 400 Bad Request (пустые title/description, неизвестная категория), 401 Unauthorized, 403 Forbidden (isOfficial без прав).

**Пример ответа 201:**

```json
{
  "id": "sug_8840",
  "source": "web",
  "author": { "id": "user_1", "username": "current_user", "avatar_url": "https://...", "isSystem": false },
  "content": { "title": "Add dark mode", "description": "...", "category": "UI" },
  "metrics": { "score": 0, "upvotes": 0, "downvotes": 0 },
  "lifecycle": { "status": "New" },
  "created_at": "2024-02-25T12:00:00Z"
}
```

**Назначение:**  
- Модалка "New Suggestion" / "Publish Proposal".

---

## 3.6 Голосование (Vote)

**Метод и путь:** `POST /api/v1/suggestions/:id/vote`  
**Body:** `{ "vote": "upvote" }` или `{ "vote": "downvote" }`. Допустимые значения: `upvote`, `downvote`. Один голос от пользователя на предложение; связь «пользователь — голос» хранится в БД ([02-models.md](02-models.md)#26a-связь-пользователя-и-голосов-таблица-votes).

**Жёсткая логика (Toggle):**

- Пользователь **не голосовал** → отправляет upvote или downvote → голос учитывается (upvotes/downvotes и score пересчитываются).
- Пользователь **уже поставил upvote** и снова отправляет **upvote** → голос **снимается** (upvotes −1, score −1).
- Пользователь **уже поставил downvote** и снова отправляет **downvote** → голос **снимается** (downvotes −1, score +1).
- Пользователь **уже поставил upvote** и отправляет **downvote** → голос **меняется** (upvotes −1, downvotes +1, score −2).
- Пользователь **уже поставил downvote** и отправляет **upvote** → голос **меняется** (downvotes −1, upvotes +1, score +2).

**Коды ответов:** 200 OK, 400 Bad Request (неверный vote), 404 Not Found, 401 Unauthorized (голосование только для авторизованных), 403 Forbidden (пользователь забанен, см. [05-endpoints-duplicates-config.md](05-endpoints-duplicates-config.md)#забаненные-пользователи).

**Пример ответа 200:** обновлённый объект `Suggestion` с пересчитанными `metrics` (score, upvotes, downvotes) или только `{ "metrics": { "score": 43, "upvotes": 46, "downvotes": 3 } }`.

**Назначение:**  
- Виджет/публичная страница: кнопки «За» и «Против» для голосования по предложению.

---

## 3.7 Удаление одного предложения

**Метод и путь:** `DELETE /api/v1/suggestions/:id`

**Политика удаления (согласовано с планом разработки, TASK-0.5):** в данном проекте используется **только Hard Delete** — физическое удаление записи из БД с каскадным удалением связанных голосов и комментариев (onDelete: Cascade). Soft delete не используется.

**Коды ответов:** 204 No Content (или 200 без тела), 404 Not Found, 401/403.

**Назначение:**  
- Действие "Delete" в меню действий на детальной панели.

---

## 3.8 Массовое удаление

**Метод и путь:** `POST /api/v1/suggestions/bulk/delete`  
**Body:** `{ "ids": ["sug_8821", "sug_8822"] }`.

**Политика удаления:** та же, что и для одиночного удаления (п. 3.7) — только Hard Delete (физическое удаление записей из БД с каскадом).

**Коды ответов:** 200 OK, 400 Bad Request (пустой ids), 401/403.

**Пример ответа 200:**

```json
{
  "deleted": 2,
  "failed": []
}
```

Опционально при частичном сбое: `"failed": [{ "id": "sug_9999", "error": "Not found" }]`.

**Назначение:**  
- Подтверждение удаления выбранных записей в списке.

---

## 3.9 Слияние одного предложения с другим (дубликат → оригинал)

**Метод и путь:** `POST /api/v1/suggestions/merge`  
**Body:** `{ "sourceId": "sug_8827", "targetId": "sug_8821" }`.  
Смысл: предложение sourceId помечается как Duplicate с merged_into = targetId; метрики target пересчитываются на бекенде.

**Коды ответов:** 200 OK, 400 Bad Request (sourceId = targetId, несуществующие id), 404 Not Found, 401/403.

**Пример ответа 200:**

```json
{
  "target": { "id": "sug_8821", "metrics": { "score": 47, "upvotes": 50, "downvotes": 3 }, ... },
  "source": { "id": "sug_8827", "lifecycle": { "status": "Duplicate", "merged_into": "sug_8821" }, ... }
}
```

Или только обновлённый target.

**Назначение:**  
- В детальной панели: вкладка Duplicates — кнопка "Merge" у кандидата (targetId = duplicate.id из GET duplicates).  
- Модалка Merge (одиночная): выбор "оригинала" и подтверждение слияния.

---

## 3.10 Массовое слияние (bulk merge)

**Метод и путь:** `POST /api/v1/suggestions/bulk/merge`  
**Body:** `{ "sourceIds": ["sug_8827", "sug_8828"], "targetId": "sug_8821" }`.  
Все sourceIds помечаются как Duplicate с merged_into = targetId; target обновляется (агрегация голосов и т.д.).

**Коды ответов:** 200 OK, 400 Bad Request (targetId в sourceIds, пустой sourceIds), 404 Not Found, 401/403.

**Пример ответа 200:** объект с полем `target` (обновлённый Suggestion) и опционально `sources` (массив обновлённых Suggestion).

**Назначение:**  
- Массовое действие "Merge" в таблице: выбор целевого из выбранных, подтверждение в BulkMergeSuggestionsDialog.

---

## 3.10a Массовое изменение статуса (Bulk Set Status)

**Метод и путь:** `POST /api/v1/suggestions/bulk/status`  
**Body:** `{ "ids": ["sug_8821", "sug_8822"], "status": "Planned" }`. Все переданные предложения переводятся в указанный статус (значение из SuggestionStatus).

**Коды ответов:** 200 OK, 400 Bad Request (пустой ids, неверный status), 404 Not Found (если хотя бы один id не найден — по соглашению возвращать 200 с полем `failed`), 401/403.

**Пример ответа 200:** `{ "updated": 2, "failed": [] }` или массив обновлённых Suggestion.

**Назначение:**  
- Панель массовых действий в таблице: кнопка "Set Status" и выбор нового статуса для выбранных строк.

---

## 3.10b Open in Widget (публичная ссылка / данные для виджета)

**Метод и путь:** `GET /api/v1/suggestions/:id/widget` или `GET /api/v1/suggestions/:id/public`  
Возвращает данные для отображения предложения во внешнем виджете (например на публичной странице). Либо возвращает **публичную ссылку** на предложение (если виджет открывается по URL), либо **JSON с полями**, достаточными для рендера карточки в виджете (title, description, category, metrics, author без чувствительных данных).

**Query (опционально):** `format=link` — вернуть только URL; без format или `format=json` — вернуть данные.

**Коды ответов:** 200 OK, 404 Not Found (предложение не найдено или скрыто).

**Пример ответа 200 (format=json):**

```json
{
  "id": "sug_8821",
  "content": { "title": "Добавить темную тему", "description": "...", "category": "UI" },
  "metrics": { "score": 42, "upvotes": 45, "downvotes": 3 },
  "author": { "id": "user_42", "username": "john_doe", "avatar_url": "https://..." },
  "created_at": "2024-01-20T10:30:00Z",
  "widgetUrl": "https://app.example.com/widget/suggestions/sug_8821"
}
```

**Пример ответа 200 (format=link):** `{ "url": "https://app.example.com/widget/suggestions/sug_8821" }`.

**Назначение:**  
- Кнопка "Open in Widget" в детальной панели: получение ссылки или данных для открытия предложения в публичном виджете.
