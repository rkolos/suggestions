# Эндпоинты: Team Chat, категории, счётчики, авторизация

Ссылки: [модели](02-models.md), [соглашения](03-conventions.md).

---

## 3.16 Team Chat (внутренние комментарии по предложению)

**Метод и путь:** `GET /api/v1/suggestions/:id/comments`  
**Query:** `limit` (по умолчанию 20), `cursor` (для следующей страницы) или `page` при offset-пагинации (см. [03-conventions.md](03-conventions.md)#пагинация).

**Коды ответов:** 200 OK, 404 Not Found, 401/403.

**Пример ответа 200:**

```json
{
  "items": [
    {
      "id": "msg_1",
      "author": { "id": "user_admin", "username": "admin", "avatar_url": "https://..." },
      "body": "Internal note text",
      "created_at": "2024-02-25T10:00:00Z",
      "updated_at": "2024-02-25T10:00:00Z"
    }
  ],
  "nextCursor": "eyJpZCI6Im1zZ18yIn0="
}
```

При отсутствии следующей страницы `nextCursor` не передаётся или пустая строка.

**Назначение:**  
- Вкладка Team Chat: список сообщений (пустое состояние "No messages yet", если items пустой).

---

**Метод и путь:** `POST /api/v1/suggestions/:id/comments`  
**Body:** `{ "body": "Add an internal note..." }`. Автор сообщения берётся из токена/сессии ([03-conventions.md](03-conventions.md)#аутентификация-и-текущий-пользователь).

**Коды ответов:** 201 Created, 400 Bad Request (пустой body), 404 Not Found, 401/403.

**Пример ответа 201:**

```json
{
  "id": "msg_2",
  "author": { "id": "user_admin", "username": "admin", "avatar_url": "https://..." },
  "body": "Add an internal note...",
  "created_at": "2024-02-25T12:00:00Z",
  "updated_at": "2024-02-25T12:00:00Z"
}
```

**Назначение:**  
- Поле "Add an internal note..." и кнопка отправки в Team Chat.

---

**Метод и путь:** `PATCH /api/v1/suggestions/comments/:commentId`  
**Body:** `{ "body": "Updated internal note text" }`. Редактирование комментария (только автор или админ). Используется плоский маршрут: `commentId` глобально уникален.

**Коды ответов:** 200 OK, 400 Bad Request, 403 Forbidden, 404 Not Found, 401.

**Пример ответа 200:** обновлённый объект `Message`.

---

**Метод и путь:** `DELETE /api/v1/suggestions/comments/:commentId`  
Удаление внутреннего комментария (только автор или админ). Плоский маршрут по `commentId`.

**Коды ответов:** 204 No Content (или 200), 403, 404, 401.

**Назначение:**  
- Редактирование и удаление сообщений в Team Chat (контекстное меню или кнопки у сообщения).

---

**Индикатор печати (Typing):** при real-time сценарии API может поддерживать передачу событий «пользователь печатает» в командном чате. Варианты: WebSocket (подписка на канал предложения, событие `typing` с `userId` и `suggestionId`) или REST: `POST /api/v1/suggestions/:id/comments/typing` с телом `{}` (факт «я печатаю»), TTL 3–5 сек; список печатающих возвращается в GET comments или отдельно `GET .../comments/typing`. В документации зафиксировать выбранный вариант при внедрении real-time.

---

## 3.17 Проверка возможности удаления категории

В модалке Settings при удалении категории фронт должен знать, есть ли предложения в этой категории. Варианты:

- **Вариант A:** в **GET** `/api/v1/suggestions/config` для каждой категории возвращать `suggestionCount` (или `canDelete: boolean`). Фронт не показывает кнопку удаления / дизейблит её при suggestionCount > 0.
- **Вариант B:** при **PUT** `/api/v1/suggestions/config` с удалённой категорией бекенд возвращает **409** с телом `{ code: "CATEGORY_IN_USE", message: "..." }`. Фронт обрабатывает 409 и показывает сообщение.

В документации зафиксировать один выбранный вариант и формат ответа/ошибки.

---

## 3.18 Счётчики по статусам и для сайдбара

**Назначение на фронте:**
- **Сайдбар** ([Sidebar](components/admin/Sidebar/index.tsx)): бейдж с количеством предложений со статусом **New** (`newSuggestionsCount`).
- **Карточный список** ([SuggestionsCardList](components/admin/SuggestionsCardList.tsx)): в выпадающем фильтре по статусам рядом с каждым статусом отображается количество предложений (`getStatusCount(status)`).

При пагинации списка эти цифры нельзя получить из одного ответа GET suggestions, поэтому нужен источник агрегации.

**Варианты реализации:**

- **Метод и путь:** `GET /api/v1/suggestions/counts` (или `/api/v1/suggestions/stats`)  
  **Коды ответов:** 200 OK, 401/403.  
  **Пример ответа 200:** `{ "byStatus": { "New": 5, "Open": 12, "Duplicate": 2, "Planned": 3, "In Progress": 1, "Completed": 4, "Rejected": 1 } }`.  
  Фронт использует для бейджа сайдбара (New) и для счётчиков в фильтре (все статусы).

- **Альтернатива:** в ответ **GET** `/api/v1/suggestions` добавить поле **facets** / **counts**: `{ byStatus: { New: number, Open: number, ... } }`, чтобы и список, и фильтр могли использовать один запрос.

- Для одного только счётчика New: разрешить **GET** `/api/v1/suggestions?status=New&limit=0` с заголовком **X-Total-Count** (или аналог) и использовать его для бейджа сайдбара.

В документации описать выбранный вариант и формат ответа.

---

## 3.19 Список категорий (отдельно, если нужен лёгкий эндпоинт)

**Метод и путь:** `GET /api/v1/suggestions/categories`  
**Коды ответов:** 200 OK, 401/403.  
**Пример ответа 200:** массив `SuggestionCategory[]`, например `[{ "id": "cat_1", "label": "UI", "color": "#3b82f6" }, ...]`.

Используется для фильтров, селекта категории при создании и в детали. Если категории приходят только из GET config — отдельный эндпоинт не обязателен.

---

## 3.20 Авторизация и права доступа (GET /me, проверка прав)

**Метод и путь:** `GET /api/v1/me` (или `GET /api/v1/users/me`, `/api/v1/auth/me`)  
Возвращает данные текущего пользователя и его роли/права, чтобы фронт мог скрывать настройки или кнопку «Post as Official» без лишних 403.

**Коды ответов:** 200 OK, 401 Unauthorized.

**Пример ответа 200:**

```json
{
  "id": "user_1",
  "username": "admin",
  "avatar_url": "https://...",
  "role": "Owner",
  "permissions": {
    "canManageSuggestionsConfig": true,
    "canPostOfficialProposal": true,
    "canBanUsers": true
  }
}
```

**Роль (role):** одно из значений `Admin`, `Manager`, `Owner`, `User`. Для доступа к настройкам Suggestions и «Post as Official» достаточно роль Admin, Manager или Owner (проверка на бекенде при вызове защищённых эндпоинтов).

**Назначение:**  
- Определение роли текущего пользователя (Admin/Manager/Owner) для скрытия/показа кнопки Settings и кнопки «Post as Official Proposal»; защищённые эндпоинты при недостаточных правах возвращают **403**.
