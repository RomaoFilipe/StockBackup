#!/usr/bin/env bash
set -euo pipefail

# Integration checks for /api/requests/user-intake.
# Usage:
#   BASE_URL=http://localhost:3000 \
#   USER_COOKIE='session_id=...; user_role=USER' \
#   ADMIN_COOKIE='session_id=...; user_role=ADMIN' \
#   bash scripts/test-user-intake.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_COOKIE="${USER_COOKIE:-}"
ADMIN_COOKIE="${ADMIN_COOKIE:-}"

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT

status_code() {
  local method="$1"
  local url="$2"
  local cookie="${3:-}"
  local data="${4:-}"

  if [[ -n "$data" ]]; then
    curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      ${cookie:+-H "Cookie: $cookie"} \
      --data "$data"
  else
    curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
      ${cookie:+-H "Cookie: $cookie"}
  fi
}

expect_code() {
  local got="$1"
  local expected="$2"
  local label="$3"
  if [[ "$got" != "$expected" ]]; then
    echo "FAIL [$label] expected HTTP $expected, got $got"
    echo "Body:"
    cat "$tmp_body"
    exit 1
  fi
  echo "OK   [$label] HTTP $got"
}

echo "Testing against: $BASE_URL"

code="$(status_code GET "$BASE_URL/api/requests/user-intake")"
expect_code "$code" "401" "GET without session"

if [[ -n "$ADMIN_COOKIE" ]]; then
  code="$(status_code GET "$BASE_URL/api/requests/user-intake" "$ADMIN_COOKIE")"
  expect_code "$code" "403" "GET with admin session"
else
  echo "SKIP [GET with admin session] set ADMIN_COOKIE to run"
fi

if [[ -n "$USER_COOKIE" ]]; then
  code="$(status_code GET "$BASE_URL/api/requests/user-intake" "$USER_COOKIE")"
  expect_code "$code" "200" "GET with user session"

  payload='{"title":"Teste intake","deliveryLocation":"Gabinete 1","notes":"Pedido de teste automatizado"}'
  code="$(status_code POST "$BASE_URL/api/requests/user-intake" "$USER_COOKIE" "$payload")"
  expect_code "$code" "201" "POST with user session"
else
  echo "SKIP [USER flow] set USER_COOKIE to run GET/POST checks"
fi

echo "All requested checks passed."
