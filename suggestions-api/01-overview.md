# Обзор модуля и экранов

Модуль состоит из:

- **Список** (`/suggestions`) — таблица предложений, фильтры, поиск, массовые действия, кнопки Refresh / Settings / New Suggestion.
- **Детали** (`/suggestions/[id]`) — левая колонка (карточный список с теми же фильтрами), правая панель: заголовок, статус/категория, вкладки Team Chat / Duplicates, боковая панель (Properties, Voting), действия Ban User / Delete.
- **Модалки**: Create Suggestion, Settings (Categories / Notifications / Banned Users), Bulk Merge, Delete confirmation.
- **Специальные страницы**: not-found и error для детальной страницы.

**Примечание по данным:** Сущность **SuggestionsConfig** (настройки категорий, уведомлений и т.д.) в API соответствует таблице **`companies_config`** (модель CompanyConfig) в БД; маппинг выполняется на уровне бекенда.

Ниже — полный перечень методов API и моделей данных, необходимых для реализации всего этого функционала. Они описаны в остальных документах:

- [Модели данных](02-models.md)
- [Соглашения API](03-conventions.md)
- [Эндпоинты: предложения](04-endpoints-suggestions.md)
- [Эндпоинты: дубликаты и конфиг](05-endpoints-duplicates-config.md)
- [Эндпоинты: Team Chat и прочее](06-endpoints-team-config.md)
- [Сводная таблица эндпоинтов](07-endpoints-summary.md)
- [Привязка по экранам](08-screens-mapping.md)
