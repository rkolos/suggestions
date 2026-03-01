# Эндпоинты: дубликаты, конфиг, шаблоны, баны

Ссылки: [модели](02-models.md), [соглашения](03-conventions.md).

---

## 3.10c Поиск похожих по тексту (форма создания)

**Метод и путь:** `POST /api/v1/suggestions/similar`  
**Body:** `{ "text": "Заголовок или описание новой идеи..." }`. Поиск похожих предложений по произвольному тексту (для формы создания, до сохранения). Ответ — массив полных объектов Suggestion (или кандидатов с matchScore), в порядке релевантности.

**Коды ответов:** 200 OK, 400 Bad Request, 401/403.

**Назначение:**  
- Модалка создания: проверка «похожих идей» до отправки формы. При недоступности AI-сервиса бекенд возвращает 200 и пустой массив `[]` (Graceful Degradation).

---

## 3.11 Похожие / дубликаты для вкладки Duplicates (AI-анализ)

**Метод и путь:** `GET /api/v1/suggestions/:id/duplicates`

**Коды ответов:** 200 OK, 404 Not Found (suggestion не найден), 401/403.

**Пример ответа 200:**

```json
[
  {
    "id": "sug_8821",
    "title": "Добавить темную тему в админ-панель",
    "status": "Open",
    "matchScore": 98,
    "excerpt": "Было бы здорово иметь возможность переключаться между светлой и темной темой...",
    "upvotes": 45,
    "downvotes": 3
  }
]
```

У каждого элемента **id** — ID целевого suggestion (target). **Подтверждение дубликата:** чтобы пометить текущее предложение как дубликат другого (автоматическая смена статуса на Duplicate и привязка к родительскому ID), используется **POST /api/v1/suggestions/merge** ([04-endpoints-suggestions.md](04-endpoints-suggestions.md)#39-слияние-одного-предложения-с-другим-дубликат--оригинал): `sourceId` — текущее предложение, `targetId` — id из списка дубликатов. После POST dismiss-duplicates при следующем GET — пустой массив `[]` или `{ "dismissed": true, "items": [] }`. При асинхронном анализе — опционально 202 или поле `status: "pending"` с повторным GET.

**Назначение:**  
- Вкладка Duplicates: запуск AI-анализа по тексту предложения, возврат списка похожих с Match Score; кнопка Merge = подтверждение дубликата через POST merge.

---

## 3.12 Отклонение блока "похожие" (dismiss similar)

**Метод и путь:** `POST /api/v1/suggestions/:id/dismiss-duplicates`  
**Body:** пустое или `{}`.

**Коды ответов:** 204 No Content (или 200), 404 Not Found, 401/403.

**Назначение:**  
- Кнопка "Похожих нет" в модалке Merge; при следующем GET duplicates бекенд возвращает пустой массив или dismissed: true.

---

## 3.12a Discord Preview (предпросмотр в Discord)

**Метод и путь:** `GET /api/v1/suggestions/:id/discord-preview` или `POST /api/v1/suggestions/:id/discord-preview`  
Возвращает тело (payload) для Discord webhook или embed — как предложение будет выглядеть в Discord при отправке уведомления (например при смене статуса). Используется для кнопки «Discord Preview» в админке.

**Коды ответов:** 200 OK, 404 Not Found, 401/403.

**Пример ответа 200:** объект в формате Discord API (embed или webhook payload), например:

```json
{
  "embeds": [{
    "title": "#sug_8821 — Добавить темную тему",
    "description": "Было бы здорово иметь...",
    "color": 3447003,
    "fields": [
      { "name": "Status", "value": "Open", "inline": true },
      { "name": "Score", "value": "42", "inline": true }
    ],
    "footer": { "text": "Suggestions" }
  }]
}
```

**Назначение:**  
- Модалка/блок «Discord Preview» в детальной панели: предпросмотр вида предложения в Discord.

---

## 3.13 Настройки Suggestions (Categories + Notifications)

**Метод и путь:** `GET /api/v1/suggestions/config`

**Коды ответов:** 200 OK, 401/403.

**Пример ответа 200:**

```json
{
  "categories": [
    { "id": "cat_1", "label": "UI", "color": "#3b82f6", "suggestionCount": 12 }
  ],
  "notifications": {
    "ticket_created": "Привет, {{user}}! Твоя идея №{{id}} принята в работу.",
    "ticket_approved": "Отличные новости! Идея {{title}} одобрена.",
    "ticket_rejected": "К сожалению, мы не будем это реализовывать."
  },
  "version": "v2.0"
}
```

Опционально у категории: `suggestionCount` или `canDelete` (см. [06-endpoints-team-config.md](06-endpoints-team-config.md)#проверка-возможности-удаления-категории).

**Назначение:**  
- Открытие модалки Settings: вкладки Categories и Notifications, загрузка списка категорий для фильтров и для селектов.

---

**Метод и путь:** `PUT /api/v1/suggestions/config`  
**Body:** полный объект `SuggestionsConfig` (categories, notifications). Валидация: label категории ≤ 30 символов, каждый шаблон уведомления ≤ 500 символов.

**Коды ответов:** 200 OK, 400 Bad Request (нарушение лимитов), 409 Conflict (CATEGORY_IN_USE — попытка удалить категорию с предложениями, см. [03-conventions.md](03-conventions.md)#формат-ошибок и раздел про удаление категории в [06-endpoints-team-config.md](06-endpoints-team-config.md)), 401/403.

**Пример ответа 200:** сохранённый объект `SuggestionsConfig` (как в GET).  
**Пример ответа 409:** см. раздел «Формат ошибок» в [03-conventions.md](03-conventions.md).

**Назначение:**  
- Кнопка "Save Changes" в модалке Settings (Categories + Notifications).

---

## 3.13a Шаблоны уведомлений (только notifications)

**Метод и путь:** `GET /api/v1/suggestions/settings/notifications`  
**Коды ответов:** 200 OK, 401/403.  
**Ответ:** объект `NotificationTemplates` (ticket_created, ticket_approved, ticket_rejected). Используется при смене статуса предложения для отправки сообщений пользователю.

**Метод и путь:** `PUT /api/v1/suggestions/settings/notifications`  
**Body:** `{ "ticket_created": "...", "ticket_approved": "...", "ticket_rejected": "..." }`. Валидация: каждый шаблон ≤ 500 символов.  
**Коды ответов:** 200 OK, 400 Bad Request, 401/403.

Альтернатива: шаблоны входят в общий GET/PUT config (п. 3.13); отдельные эндпоинты — если нужна точечная работа только с уведомлениями.

**Назначение:**  
- Вкладка Notifications в Settings: получение и редактирование шаблонов сообщений при смене статуса.

---

## 3.14 Дефолтный конфиг (Reset to Default для шаблонов)

**Метод и путь:** `GET /api/v1/suggestions/config/defaults`

**Коды ответов:** 200 OK, 401/403.

**Пример ответа 200:**

```json
{
  "notifications": {
    "ticket_created": "Привет, {{user}}! Твоя идея №{{id}} принята в работу.",
    "ticket_approved": "Отличные новости! Идея {{title}} одобрена.",
    "ticket_rejected": "К сожалению, мы не будем это реализовывать."
  }
}
```

При необходимости можно добавить `categories` для консистентности.

**Назначение:**  
- Кнопка "Reset to Default" у шаблонов уведомлений в Settings: фронт запрашивает дефолты и подставляет в форму.

---

## 3.15 Забаненные пользователи (Ban/Unban, модерация)

**Метод и путь:** `GET /api/v1/suggestions/bans` (алиас для админ-панели: `GET /api/v1/banned-users`).  
**Query:** `search` (поиск по username или id пользователя), `page`, `limit` (по умолчанию page=1, limit=20, см. [03-conventions.md](03-conventions.md)#пагинация).

**Коды ответов:** 200 OK, 401/403.

**Пример ответа 200:**

```json
{
  "items": [
    {
      "id": "user_123",
      "username": "spam_bot_99",
      "avatar_url": "https://...",
      "banned_at": "2024-01-10T14:30:00Z"
    }
  ],
  "total": 1
}
```

**Назначение:**  
- Вкладка Banned Users в Settings: список, поиск, отображение аватара, username, id, banned_at.

---

**Метод и путь:** `DELETE /api/v1/suggestions/bans/:userId` (алиас: `DELETE /api/v1/banned-users/:id`).

**Коды ответов:** 204 No Content (или 200), 404 Not Found, 401/403.

**Назначение:**  
- Кнопка "Unban" у каждого пользователя во вкладке Banned Users.

---

**Метод и путь:** `POST /api/v1/suggestions/bans` (алиас: `POST /api/v1/banned-users`)  
**Body:** `{ "userId": "user_456" }` (опционально `"reason": "..."`).

**Коды ответов:** 201 Created (или 200), 400 Bad Request, 404 Not Found, 401/403.

**Назначение:**  
- Действие "Ban User" в меню действий на детальной панели предложения (бекенд по автору предложения или по переданному userId банит пользователя).

**Последствия бана для API:** для забаненного пользователя (userId в списке bans) бекенд должен возвращать **403 Forbidden** при попытках: **создать предложение** (POST /suggestions), **проголосовать** (POST /suggestions/:id/vote), **написать комментарий** в Team Chat (POST /suggestions/:id/comments). Тело ошибки — единый формат ([03-conventions.md](03-conventions.md)#формат-ошибок), код например `USER_BANNED`. Уже созданные предложения забаненного пользователя: **остаются в системе** (не удаляются и не скрываются автоматически). При необходимости скрытия или пометки — описать отдельно (например флаг `author.isBanned` в ответах или исключение из публичных списков по политике бекенда).
