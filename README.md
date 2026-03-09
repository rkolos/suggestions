# Suggestions

Микросервис Suggestions — бекенд для модуля предложений и голосований (интеграция с Discord, AI-группировка, Team Chat и др.).

## Разработка

### Окружение для разработки и E2E

Для запуска приложения и E2E-тестов нужны **PostgreSQL** и **Redis**. Удобнее всего поднять их через Docker Compose из корня репозитория:

```bash
# Из корня репозитория (suggestions/)
docker compose up -d
```

Сервисы:
- **PostgreSQL** — порт `5432`, БД `suggestions_db`, пользователь/пароль `postgres/postgres`.
- **Redis** — порт `6379`.

В `app/.env` должны быть заданы (значения по умолчанию уже подходят для локального запуска):

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/suggestions_db?schema=public`
- `REDIS_URL=redis://localhost:6379`

Перед первым запуском приложения или E2E выполните миграции и при необходимости seed (из каталога `app/`):

```bash
cd app
npx prisma migrate deploy
npx prisma db seed   # опционально: системный пользователь и тестовые компании
```

После этого:
- запуск приложения: `npm run start:dev` (из `app/`);
- E2E-тесты: `npm run test:e2e` (из `app/`).

Остановка окружения:

```bash
docker compose down
```

- **Линтинг и форматирование:** `npm run lint`, `npm run format`, `npm run format:check` (в `app/`).
- **Коммиты:** Conventional Commits (`fix:`, `feat:`, `chore:` и т.д.). Husky + lint-staged проверяют код до коммита.

## Развёртывание

**КРИТИЧНО: порядок запуска**

1. **СНАЧАЛА** выполнить миграции БД: `npx prisma migrate deploy` (в `app/`).
2. **ПОСЛЕ** — запуск приложения (`node dist/main.js` или контейнер).

Миграции должны выполняться **строго до** старта новых контейнеров (отдельный шаг CI/CD, init-container в Kubernetes или скрипт `pre-start.sh`).

**Запрещено** использовать `prisma db push` в production.

**Сборка Docker-образа:**

```bash
docker build -t suggestions ./app
```

Пример скрипта `pre-start.sh` для Docker/Kubernetes:

```bash
#!/bin/sh
npx prisma migrate deploy
exec node dist/main.js
```

## Документация

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — архитектурные паттерны: Trusted Internal API, Multi-tenancy, DDD, Discord Sharding.
- **[TECH_STACK.md](TECH_STACK.md)** — утверждённый технологический стек (NestJS, TypeScript, PostgreSQL, Prisma, Redis, BullMQ, discord.js) и политика версий.
- **[suggestions-api/](suggestions-api/)** — документация API: обзор, модели, эндпоинты, соглашения, привязка к экранам.
