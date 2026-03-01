# Suggestions

Микросервис Suggestions — бекенд для модуля предложений и голосований (интеграция с Discord, AI-группировка, Team Chat и др.).

## Разработка

- **Линтинг и форматирование:** `npm run lint`, `npm run format`, `npm run format:check` (в `app/`).
- **Коммиты:** Conventional Commits (`fix:`, `feat:`, `chore:` и т.д.). Husky + lint-staged проверяют код до коммита.

## Документация

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — архитектурные паттерны: Trusted Internal API, Multi-tenancy, DDD, Discord Sharding.
- **[TECH_STACK.md](TECH_STACK.md)** — утверждённый технологический стек (NestJS, TypeScript, PostgreSQL, Prisma, Redis, BullMQ, discord.js) и политика версий.
- **[suggestions-api/](suggestions-api/)** — документация API: обзор, модели, эндпоинты, соглашения, привязка к экранам.
