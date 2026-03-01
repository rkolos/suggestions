# Вопросы и несоответствия: план разработки (about) и API (suggestions-api)

Документ фиксирует неточности, расхождения и недостаточно описанные моменты между тасками в `about/` и спецификацией в `suggestions-api/`. Ссылки даны по номерам тасок и файлам API.

**См. также:** [ENDPOINTS_COVERAGE.md](ENDPOINTS_COVERAGE.md) — привязка эндпоинтов API к задачам плана; [0_5.md](0_5.md) (TASK-0.5) — сводная задача по согласованию путей и форматов и обновлению плана/API.

**Статус:** Все перечисленные ниже пункты разрешены; эталонные решения зафиксированы в [0_5.md](0_5.md). План и suggestions-api приведены в соответствие с этими решениями.

---

## Оглавление

1. [Блок 0: Стек и архитектура](#блок-0-стек-и-архитектура)
2. [Блок 1: Инфраструктура и схема БД](#блок-1-инфраструктура-и-схема-бд)
3. [Блок 2: Ядро бизнес-логики](#блок-2-ядро-бизнес-логики)
4. [Блок 3: REST API](#блок-3-rest-api)
5. [Блок 4: Discord](#блок-4-discord)
6. [Блок 5: AI и пользователи](#блок-5-ai-и-пользователи)
7. [Блок 6: E2E и Corde](#блок-6-e2e-и-corde)
8. [Сводная таблица](#сводная-таблица)

---

## Блок 0: Стек и архитектура

### TASK-0.1 ([about/0_1.md](0_1.md)) — Решено: см. 0_5 (описание и политики)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 0.1.1 | В DoD перечислены технологии (NestJS, TypeScript, PostgreSQL, Prisma, Redis, BullMQ, discord.js); в suggestions-api нет отдельного раздела про стек. | Нужна ли в suggestions-api явная привязка к этому стеку (например в README или 01-overview)? | — |

### TASK-0.2 ([about/0_2.md](0_2.md))

Нет выявленных несоответствий с suggestions-api (архитектура не дублируется в API-доках).

### TASK-0.3 ([about/0_3.md](0_3.md))

Нет вопросов к API (стандарты кода).

### TASK-0.4 ([about/0_4.md](0_4.md))

Нет вопросов к API (CI/CD и деплой).

---

## Блок 1: Инфраструктура и схема БД

### TASK-1.1 – TASK-1.4 ([about/1_1.md](1_1.md) – [about/1_4.md](1_4.md))

Инициализация репозитория, Docker, конфигурация, Prisma — вопросов к контракту suggestions-api нет (инфраструктура и схема до моделей).

### TASK-1.5 ([about/1_5.md](1_5.md)) и TASK-1.6 ([about/1_6.md](1_6.md)) vs [02-models.md](../suggestions-api/02-models.md) — Решено: см. 0_5 (форматы, структура, CompanyConfig)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 1.5.1 | В плане — модель **CompanyConfig** (таблица `companies_config`) с полями companyId, discordGuildId, suggestionsChannelId, categories, notificationTemplates. В API — **SuggestionsConfig** (categories, notifications, version). | Одна и та же сущность (настройки компании) или разное назначение? Нужно ли в API явно указать соответствие CompanyConfig ↔ SuggestionsConfig? | 02-models.md §2.3 |
| 1.6.1 | Статусы в плане: Enum `SuggestionStatus` — `NEW`, `OPEN`, `DUPLICATE`, `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`, `REJECTED` (UPPER_SNAKE). В API: `'New' \| 'Open' \| ...` (Title Case). | Какой формат считать эталонным в REST-ответах (UPPER_SNAKE в JSON vs Title Case)? Нужна ли явная конвенция в 03-conventions? | 02-models.md §2.1 SuggestionStatus |
| 1.6.2 | В плане есть статус **CLOSED**; в 02-models перечислены статусы без CLOSED. | Добавить CLOSED в API или убрать из плана? | 02-models.md §2.1 |
| 1.6.3 | В плане Suggestion — плоские поля (title, description, category, status, mergedIntoId). В API — вложенные объекты: **content**, **lifecycle**, **metrics**, **author**. | Какой формат ответа REST считать эталонным (плоская модель из БД vs вложенная из API)? Нужна ли явная схема маппинга БД → JSON в плане или в API? | 02-models.md §2.1 |
| 1.6.4 | В API у Suggestion есть поля **ai_summary**, **type** (`'official_proposal'`), **isPinned**; в схеме БД плана (1.6) этих полей нет. | Нужно ли дополнять описание схемы в плане (TASK-1.6 или отдельная таска) или достаточно описания только в API? | 02-models.md §2.1 |

### TASK-1.7 ([about/1_7.md](1_7.md)) vs [03-conventions.md](../suggestions-api/03-conventions.md) — Решено: см. 0_5 (формат ошибки)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 1.7.1 | Формат ошибки в плане: `{ "code", "message", "timestamp", "path" }`. В API: `{ "error": { "code", "message", "details" } }` (вложенный объект, без timestamp и path). | Какой контракт считать эталонным? Нужно ли в плане добавить details и/или в API — timestamp и path? | 03-conventions.md «Формат ошибок» |

### TASK-1.8 ([about/1_8.md](1_8.md)) vs [03-conventions.md](../suggestions-api/03-conventions.md) — Решено: см. 0_5 (Trusted API)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 1.8.1 | План: Trusted Internal API — микросервис опирается на заголовки **X-Company-Id**, **X-User-Id** (Gateway проводит аутентификацию). API: «Идентификация пользователя: по заголовку Authorization: Bearer \<token\> или cookie сессии». | Как согласовать: считать ли, что Gateway после проверки токена/сессии подставляет X-Company-Id и X-User-Id, и в 03-conventions явно описать эту схему? | 03-conventions.md «Аутентификация и текущий пользователь» |

---

## Блок 2: Ядро бизнес-логики

### TASK-2.1 ([about/2_1.md](2_1.md)) vs [03-conventions.md](../suggestions-api/03-conventions.md), [04-endpoints-suggestions.md](../suggestions-api/04-endpoints-suggestions.md) — Решено: см. 0_5 (пагинация, Hard delete)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 2.1.1 | Ответ списка в плане: `{ items, total, page, limit }`. В 03-conventions: `{ items, total }` с опциональными page, limit в ответе. | Нужно ли в плане или в API явно требовать возврат page и limit в теле ответа для консистентности пагинации? | 03-conventions.md «Пагинация» |
| 2.1.2 | В плане — физическое удаление (delete) и каскад из TASK-1.6. В API 04 (п. 3.7, 3.8) допускаются Soft Delete (is_deleted / deleted_at) и Hard Delete. | Зафиксировать ли в плане единую политику (только hard delete с каскадом) или оставить выбор, как в API? | 04-endpoints-suggestions.md §3.7, §3.8 |

### TASK-2.2 ([about/2_2.md](2_2.md))

Нет прямых несоответствий с API (события внутренние).

### TASK-2.3 ([about/2_3.md](2_3.md))

Нет расхождений по контракту голосования (toggle описан и в плане, и в API).

### TASK-2.4 ([about/2_4.md](2_4.md)) — Решено: см. 0_5, 02-models (author.id = "system")

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 2.4.1 | При слиянии в плане создаётся технический комментарий с **автором id = "system"**; запись с таким id должна существовать в таблице users (Seed или Lazy Create). | Нужно ли описать системного пользователя "system" в 02-models или в отдельном разделе API (например, зарезервированные author.id)? | — |

### TASK-2.5 ([about/2_5.md](2_5.md))

Нет расхождений по поведению банов; последствия бана описаны в API 05.

---

## Блок 3: REST API

### TASK-3.1 ([about/3_1.md](3_1.md)) vs [05-endpoints-duplicates-config.md](../suggestions-api/05-endpoints-duplicates-config.md), [07-endpoints-summary.md](../suggestions-api/07-endpoints-summary.md) — Решено: см. 0_5 (путь config)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 3.1.1 | План: ConfigController с роутом **`api/v1/config`** (GET /, PUT /). API: **GET/PUT `/api/v1/suggestions/config`**. | Какой базовый путь считать эталонным: `/api/v1/config` или `/api/v1/suggestions/config`? | 05-endpoints-duplicates-config.md §3.13; 07-endpoints-summary.md |

### TASK-3.2 ([about/3_2.md](3_2.md)) vs [04-endpoints-suggestions.md](../suggestions-api/04-endpoints-suggestions.md) — Решено: см. 0_5 (page/limit, официальные посты в 2.1/3.2)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 3.2.1 | План: GetSuggestionsFilterDto — **limit, offset**. API 04: пагинация **page, limit** (offset-based). | Привести ли плановый DTO к page+limit для единообразия с API? | 04-endpoints-suggestions.md §3.1, 03-conventions «Пагинация» |
| 3.2.2 | Официальные посты (isOfficial): в API — системный автор, префикс id **prop-** , **type: "official_proposal"**, **isPinned: true**. В плане 2.1 — только isOfficial и статус OPEN. | Нужно ли в плане (TASK-2.1 или 3.2) явно описать prop-, isPinned и type для официальных постов? | 04-endpoints-suggestions.md §3.5; 02-models §2.1 |

### TASK-3.3 ([about/3_3.md](3_3.md)) vs [04-endpoints-suggestions.md](../suggestions-api/04-endpoints-suggestions.md), [07-endpoints-summary.md](../suggestions-api/07-endpoints-summary.md) — Решено: см. 0_5 (путь bulk)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 3.3.1 | План: BulkController с базой **`api/v1/bulk`** (POST /delete, /status, /merge). API: **POST `/api/v1/suggestions/bulk/delete`**, **bulk/status**, **bulk/merge**. | Уточнить единый путь: оставить ли в плане `api/v1/bulk` или привести к `api/v1/suggestions/bulk/*`? | 04-endpoints-suggestions.md §3.8, §3.10, §3.10a; 07-endpoints-summary.md |

### TASK-3.4 ([about/3_4.md](3_4.md)) vs [05-endpoints-duplicates-config.md](../suggestions-api/05-endpoints-duplicates-config.md), [06-endpoints-team-config.md](../suggestions-api/06-endpoints-team-config.md) — Решено: см. 0_5 (путь bans)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 3.4.1 | План: BansController с роутом **`api/v1/bans`** (GET /, POST /, DELETE /:userId). API: **GET/POST/DELETE `/api/v1/suggestions/bans`** (алиас `/banned-users`). | Какой путь использовать в реализации: `api/v1/bans` или `api/v1/suggestions/bans` (и алиасы)? | 05-endpoints-duplicates-config.md §3.15; 07-endpoints-summary.md |
| 3.4.2 | Комментарии: план — вложенный ресурс `api/v1/suggestions/:suggestionId/comments`. API 06 — `GET/POST .../suggestions/:id/comments`. Совпадает. Для PATCH/DELETE см. 3.5. | — | 06-endpoints-team-config.md §3.16 |

### TASK-3.5 ([about/3_5.md](3_5.md)) vs [04-endpoints-suggestions.md](../suggestions-api/04-endpoints-suggestions.md), [06-endpoints-team-config.md](../suggestions-api/06-endpoints-team-config.md), [07-endpoints-summary.md](../suggestions-api/07-endpoints-summary.md) — Решено: см. 0_5 (comments плоский маршрут, vote body, stats)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 3.5.1 | План: редактирование/удаление комментария по **плоскому** маршруту **`PATCH/DELETE /api/v1/comments/:commentId`**. API 06: **`PATCH/DELETE /api/v1/suggestions/:id/comments/:commentId`**. | Выбрать один вариант и зафиксировать в плане и в API. | 06-endpoints-team-config.md §3.16; 07-endpoints-summary.md |
| 3.5.2 | План: VoteDto с полем **type: 1 \| -1**. API 04: тело **`{ "vote": "upvote" \| "downvote" }`**. | Привести к одному контракту (числовой type vs строковый vote) в плане и в API. | 04-endpoints-suggestions.md §3.6 |
| 3.5.3 | План: **GET `/api/v1/stats`**. API 06/07: **GET `/api/v1/suggestions/counts`** или **`/stats`**. | Уточнить путь: `/api/v1/stats` или `/api/v1/suggestions/counts` / `/api/v1/suggestions/stats`? | 06-endpoints-team-config.md §3.18; 07-endpoints-summary.md |

### TASK-3.6 ([about/3_6.md](3_6.md))

Нет расхождений (userVote, images описаны в плане; в API можно явно добавить userVote и images в примеры ответа Suggestion при необходимости).

### TASK-3.7 ([about/3_7.md](3_7.md)) vs [06-endpoints-team-config.md](../suggestions-api/06-endpoints-team-config.md) — Решено: см. 0_5 (контракт /me с role и permissions)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 3.7.1 | План: GET `/api/v1/users/me` возвращает **`{ id, username?, avatarUrl? }`**. API 06: GET **/api/v1/me** (или /users/me, /auth/me) плюс **role**, **permissions** (canManageSuggestionsConfig, canPostOfficialProposal, canBanUsers). | Нужно ли в плане требовать возврат role и permissions для GET /users/me или оставить минимальный контракт (id, username, avatarUrl)? | 06-endpoints-team-config.md §3.20 |

---

## Блок 4: Discord

Эндпоинты Discord-бота в плане не дублируются в suggestions-api. В API описан только **GET .../discord-preview** ([05-endpoints-duplicates-config.md](../suggestions-api/05-endpoints-duplicates-config.md) §3.12a).

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 4.x.1 | Эндпоинт **GET (или POST) .../discord-preview** описан в API; в плане разработки (блок 3) отдельная таска под него не выделена. | Считать ли его покрытым TASK-3.1 (Config) или TASK-3.2 (Suggestions), или добавить в план явное упоминание (например в TASK-3.2)? **Решено: см. 0_5 — покрыт в TASK-3.2.** | 05-endpoints-duplicates-config.md §3.12a; 08-screens-mapping.md |

---

## Блок 5: AI и пользователи

### TASK-5.1 ([about/5_1.md](5_1.md))

Нет вопросов к контракту API (фоновый RAG sync).

### TASK-5.2 ([about/5_2.md](5_2.md)) vs [05-endpoints-duplicates-config.md](../suggestions-api/05-endpoints-duplicates-config.md), [04-endpoints-suggestions.md](../suggestions-api/04-endpoints-suggestions.md) — Решено: см. 0_5 (оба эндпоинта, разграничение в TASK-5.2)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 5.2.1 | План: эндпоинт **POST `/api/v1/suggestions/similar`** с телом **`{ text }`** — поиск похожих по произвольному тексту. API 05: **GET `/api/v1/suggestions/:id/duplicates`** — дубликаты для **конкретного** предложения по id (по тексту этого предложения). Разная семантика. | Нужны ли оба эндпоинта: (1) POST /similar — по произвольному тексту для модалки создания; (2) GET /:id/duplicates — для вкладки Duplicates по текущему предложению? Как разграничить в плане и в API? | 05-endpoints-duplicates-config.md §3.11; 04-endpoints-suggestions.md |

### TASK-5.3 ([about/5_3.md](5_3.md))

Нет контрактных расхождений с API (Lazy Sync — внутренняя реализация).

---

## Блок 6: E2E и Corde

### TASK-6.1 ([about/6_1.md](6_1.md))

Нет вопросов к API (тестовый teardown).

### TASK-6.2 ([about/6_2.md](6_2.md)) vs [04-endpoints-suggestions.md](../suggestions-api/04-endpoints-suggestions.md) — Решено: см. 0_5 (vote: "upvote"/"downvote"; в 6_2 уже используется)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 6.2.1 | В тесте тело голоса: **`{ "type": 1 }`**. В API 04: **`{ "vote": "upvote" }`** (или "downvote"). | Привести E2E к контракту API (vote: "upvote"/"downvote") или зафиксировать в API поддержку type: 1|-1. | 04-endpoints-suggestions.md §3.6 |

### TASK-6.3 ([about/6_3.md](6_3.md))

Нет расхождений по путям комментариев и банов.

### TASK-6.4 ([about/6_4.md](6_4.md)) vs [04-endpoints-suggestions.md](../suggestions-api/04-endpoints-suggestions.md), [07-endpoints-summary.md](../suggestions-api/07-endpoints-summary.md) — Решено: см. 0_5 (путь bulk; оба сценария /similar и /duplicates в 5.2)

| # | Описание | Вопрос | Ссылка API |
|---|----------|--------|------------|
| 6.4.1 | В тесте вызывается **POST `/api/v1/bulk/status`**. В API — **POST `/api/v1/suggestions/bulk/status`**. | Уточнить в плане (TASK-6.4) полный путь для bulk/status, чтобы E2E соответствовал API. | 04-endpoints-suggestions.md §3.10a; 07-endpoints-summary.md |
| 6.4.2 | В тесте — **POST `/api/v1/suggestions/similar`** с телом `{ "text": "..." }`. В API описан GET `.../duplicates` по :id. | Если в итоге делается только GET /:id/duplicates, нужно ли в E2E менять сценарий (например, вызывать GET /suggestions/:id/duplicates после создания предложения)? | 05-endpoints-duplicates-config.md §3.11 |

### TASK-6.5 ([about/6_5.md](6_5.md))

Нет вопросов к API (Corde — тесты бота).

---

## Недостаточно описанные моменты

Эти пункты не привязаны к одной таске; они касаются плана и API в целом.

| # | Описание | Вопрос |
|---|----------|--------|
| N.1 | **Soft vs Hard delete:** API 04 (3.7, 3.8) оставляет выбор за бекендом; в плане (2.1, 3.3) — физическое удаление и каскад. | **Решено: см. 0_5.** В API 04 зафиксирована политика только Hard delete; план 2.1 уже явно описывает её. |
| N.2 | **Эндпоинты API без явной таски в плане:** GET :id/duplicates, POST :id/dismiss-duplicates, GET :id/discord-preview, GET config/defaults, GET/PUT settings/notifications, GET categories, GET /me с role/permissions, опционально typing для комментариев. | **Решено: см. 0_5, ENDPOINTS_COVERAGE.md.** Все перечисленные эндпоинты привязаны к таскам (3.1, 3.2, 3.4, 3.5, 3.7, 5.2). |
| N.3 | **Официальные посты (isOfficial):** в API — системный автор, префикс id prop-, type, isPinned; в плане 2.1 — только isOfficial и статус OPEN. | **Решено: см. 0_5.** В плане TASK-2.1 и TASK-3.2 явно описаны prop-, isPinned, type. |

---

## Сводная таблица (все пункты разрешены — эталон в [0_5.md](0_5.md))

| Тип | TASK | Документ API | Вопрос |
|-----|------|--------------|--------|
| Путь | 3.1 | 05, 07 | Config: `/api/v1/config` vs `/api/v1/suggestions/config`? |
| Путь | 3.3 | 04, 07 | Bulk: `/api/v1/bulk/*` vs `/api/v1/suggestions/bulk/*`? |
| Путь | 3.4 | 05, 07 | Bans: `/api/v1/bans` vs `/api/v1/suggestions/bans`? |
| Путь | 3.5 | 06, 07 | Comments PATCH/DELETE: `/api/v1/comments/:commentId` vs `.../suggestions/:id/comments/:commentId`? |
| Путь | 3.5 | 06, 07 | Stats: `/api/v1/stats` vs `/api/v1/suggestions/counts` или `/stats`? |
| Путь | 6.4 | 04, 07 | E2E bulk/status: полный путь `.../suggestions/bulk/status`? |
| Формат | 1.6 | 02 | Статусы: UPPER_SNAKE vs Title Case в JSON? |
| Формат | 1.6 | 02 | CLOSED: есть в плане, нет в API — добавить или убрать? |
| Формат | 1.6 | 02 | Ответ Suggestion: плоские поля vs content/lifecycle/metrics/author? |
| Формат | 1.6 | 02 | Поля ai_summary, type, isPinned: добавить в схему БД в плане? |
| Формат | 1.7 | 03 | Ошибка: `code, message, timestamp, path` vs `error: { code, message, details }`? |
| Формат | 3.5 | 04 | Голос: body `type: 1|-1` vs `vote: "upvote"|"downvote"`? |
| Формат | 6.2 | 04 | E2E vote body: привести к vote upvote/downvote или поддержать type? |
| Описание | 0.1 | — | Нужна ли в suggestions-api привязка к стеку? |
| Описание | 1.5/1.6 | 02 | CompanyConfig vs SuggestionsConfig — одна сущность? |
| Описание | 1.8 | 03 | Trusted Internal API: явно описать подстановку X-Company-Id, X-User-Id после проверки токена? |
| Описание | 2.1 | 03, 04 | Ответ списка: всегда возвращать page, limit? Soft/Hard delete — зафиксировать в плане? |
| Описание | 2.4 | — | Системный пользователь "system" — описать в API? |
| Описание | 3.2 | 04, 02 | Официальные посты: в плане описать prop-, isPinned, type? |
| Описание | 3.7 | 06 | GET /me: в плане требовать role и permissions? |
| Описание | 4.x | 05, 08 | Discord Preview — явно включить в одну из тасок блока 3? |
| Описание | 5.2 | 05, 04 | POST /similar vs GET /:id/duplicates — оба эндпоинта, разграничение? |
| Описание | N.1 | 04 | Политика удаления (soft/hard) в плане? |
| Описание | N.2 | 04–08 | Эндпоинты без таски: добавить подпункты или пометки о покрытии? |
