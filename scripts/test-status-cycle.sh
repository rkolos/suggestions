#!/usr/bin/env bash
# Скрипт: создание предложения и проход по всем статусам
# Требует: запущенный API (npm run start:dev) и Redis

set -e
BASE_URL="${BASE_URL:-http://localhost:4000}"
COMPANY_ID="${COMPANY_ID:-00000000-0000-0000-0000-000000000001}"
USER_ID="${USER_ID:-test-user-123}"

H="-H 'Content-Type: application/json' -H 'X-Company-Id: $COMPANY_ID' -H 'X-User-Id: $USER_ID'"

echo "=== 1. Создание предложения (статус NEW) ==="
RESP=$(curl -s -X POST "$BASE_URL/api/v1/suggestions" \
  -H "Content-Type: application/json" \
  -H "X-Company-Id: $COMPANY_ID" \
  -H "X-User-Id: $USER_ID" \
  -d '{"title":"Тестовая идея для проверки статусов","description":"Описание тестовой идеи","category":"Улучшения"}')
echo "$RESP" | head -c 500
echo ""

SUG_ID=$(echo "$RESP" | node -e "try{const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.id||'')}catch(e){console.log('')}" 2>/dev/null || echo "")

if [ -z "$SUG_ID" ]; then
  echo "Ошибка: не удалось получить id предложения"
  exit 1
fi
echo "Создано предложение: $SUG_ID"
echo ""

echo "=== 2. Перевод в OPEN (публикация в Discord) ==="
curl -s -X PATCH "$BASE_URL/api/v1/suggestions/$SUG_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Company-Id: $COMPANY_ID" \
  -d '{"status":"OPEN"}' | head -c 300
echo ""
echo ""

echo "=== 3. Перевод в IN_PROGRESS ==="
curl -s -X PATCH "$BASE_URL/api/v1/suggestions/$SUG_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Company-Id: $COMPANY_ID" \
  -d '{"status":"IN_PROGRESS"}' | head -c 300
echo ""
echo ""

echo "=== 4. Перевод в PLANNED ==="
curl -s -X PATCH "$BASE_URL/api/v1/suggestions/$SUG_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Company-Id: $COMPANY_ID" \
  -d '{"status":"PLANNED"}' | head -c 300
echo ""
echo ""

echo "=== 5. Перевод в COMPLETED ==="
curl -s -X PATCH "$BASE_URL/api/v1/suggestions/$SUG_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Company-Id: $COMPANY_ID" \
  -d '{"status":"COMPLETED"}' | head -c 300
echo ""
echo ""

echo "=== 6. Получение финального состояния ==="
curl -s -X GET "$BASE_URL/api/v1/suggestions/$SUG_ID" \
  -H "X-Company-Id: $COMPANY_ID" | node -e "
let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
  const j=JSON.parse(d);
  console.log('ID:', j.id);
  console.log('Title:', j.content?.title);
  console.log('Status:', j.lifecycle?.status);
});
"
echo ""
echo "=== Готово ==="
