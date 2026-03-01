# Исходный код (src)

Структура по Domain-Driven Design (см. [ARCHITECTURE.md](../ARCHITECTURE.md)):

- **modules/suggestions/** — модуль предложений
- **modules/votes/** — модуль голосования
- **modules/discord/** — интеграция с Discord-ботом
- **common/** — Guards, Interceptors, фильтры ошибок, утилиты (в т.ч. контекст tenant по `X-Company-Id`)
