# Привязка по экранам и элементам

- **Список:** GET suggestions с параметрами сортировки (sort=id|category|score|status|created, order), AI Grouping (grouped=true или GET /clusters); фильтры; Bulk Actions: POST bulk/delete, POST bulk/status, Bulk Merge; кнопки New Suggestion, Settings. GET counts/stats или facets — для сайдбара и счётчиков в фильтре.
- **Деталь:** GET suggestions/:id; PATCH status/category; Actions → Ban (POST bans), Delete; **Open in Widget** → GET .../widget или /public; **Discord Preview** → GET .../discord-preview; вкладки Team Chat (GET/POST/PATCH/DELETE comments, опционально typing) и Duplicates (GET duplicates с Match Score, подтверждение дубликата = POST merge, dismiss).
- **Виджет/публичная страница:** GET .../widget или /public для отображения; POST .../vote (upvote/downvote) для голосования.
- **Create modal:** POST suggestions с флагом isOfficial (официальный пост: системный автор, prop-, Open). GET /me — проверка прав для показа «Post as Official».
- **Settings:** GET/PUT config; GET/PUT settings/notifications для шаблонов; GET config/defaults → Reset to Default; GET bans (поиск ?search=), DELETE bans/:userId (Unban), POST bans (Ban). Алиасы путей: /banned-users, /banned-users/:id.
- **Bulk:** POST bulk/delete (массовое удаление), POST bulk/status (массовое изменение статуса), POST bulk/merge.
- **Not-found / Error:** GET suggestions/:id → 404; обработка 5xx и сетевых ошибок → error boundary.
- **Права доступа:** GET /me — роль (Admin/Manager/Owner) и permissions (canManageSuggestionsConfig, canPostOfficialProposal, canBanUsers) для скрытия/показа Settings и «Post as Official»; защищённые эндпоинты возвращают 403.
