#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@gmail.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-12345678}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/stockly_admin_cookie.txt}"

rm -f "$COOKIE_JAR"

echo "[1/5] Login admin..."
curl -sS -c "$COOKIE_JAR" -H 'content-type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$BASE_URL/api/auth/login" >/dev/null

echo "[2/5] List users..."
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/admin/users" | jq 'length // .total // 0' >/dev/null

echo "[3/5] List IP allowlist..."
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/admin/allowed-ips" | jq 'length // .total // 0' >/dev/null

echo "[4/5] Dry-run storage reorg..."
curl -sS -b "$COOKIE_JAR" -H 'content-type: application/json' \
  -d '{"dryRun":true,"limit":20}' \
  "$BASE_URL/api/admin/storage/reorganize" | jq '.dryRun' >/dev/null

echo "[5/5] Notifications check..."
curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/notifications?limit=5" | jq '.items | length' >/dev/null

echo "OK: admin workflows smoke test passed"
