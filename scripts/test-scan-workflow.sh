#!/usr/bin/env bash
set -euo pipefail

# API-level regression checks for /scan unit workflow.
# Required env vars:
#   BASE_URL                e.g. http://localhost:3000
#   UNIT_CODE               UUID of a test unit
#   ADMIN_SESSION_COOKIE    value for session_id cookie of an admin
# Optional:
#   USER_SESSION_COOKIE     value for session_id cookie of a regular user (to validate 403 for scrap/lost)
#
# Example:
# BASE_URL=http://localhost:3000 \
# UNIT_CODE=00000000-0000-0000-0000-000000000000 \
# ADMIN_SESSION_COOKIE=... \
# USER_SESSION_COOKIE=... \
# bash scripts/test-scan-workflow.sh

BASE_URL="${BASE_URL:-}"
UNIT_CODE="${UNIT_CODE:-}"
ADMIN_SESSION_COOKIE="${ADMIN_SESSION_COOKIE:-}"
USER_SESSION_COOKIE="${USER_SESSION_COOKIE:-}"

request_json() {
  local method="$1"
  local url="$2"
  local cookie="$3"
  local data="${4:-}"
  local body_file
  body_file="$(mktemp)"

  local status
  if [[ -n "$data" ]]; then
    status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -H "Cookie: session_id=${cookie}" \
      -d "$data" \
      "$url")"
  else
    status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" \
      -H "Cookie: session_id=${cookie}" \
      "$url")"
  fi

  RESPONSE_STATUS="$status"
  RESPONSE_BODY="$(cat "$body_file")"
  rm -f "$body_file"
}

json_get() {
  local json="$1"
  local path="$2"
  node -e '
    const data = JSON.parse(process.argv[1]);
    const path = process.argv[2].split(".");
    let cur = data;
    for (const part of path) {
      if (cur === null || cur === undefined || !(part in cur)) {
        process.exit(2);
      }
      cur = cur[part];
    }
    if (typeof cur === "object") process.stdout.write(JSON.stringify(cur));
    else process.stdout.write(String(cur));
  ' "$json" "$path"
}

assert_status() {
  local expected="$1"
  local label="$2"
  if [[ "$RESPONSE_STATUS" != "$expected" ]]; then
    echo "FAIL ${label}: expected HTTP ${expected}, got ${RESPONSE_STATUS}"
    echo "Body: ${RESPONSE_BODY}"
    exit 1
  fi
}

assert_json_eq() {
  local path="$1"
  local expected="$2"
  local label="$3"
  local actual
  if ! actual="$(json_get "$RESPONSE_BODY" "$path" 2>/dev/null)"; then
    echo "FAIL ${label}: missing JSON path '${path}'"
    echo "Body: ${RESPONSE_BODY}"
    exit 1
  fi
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL ${label}: path '${path}' expected '${expected}', got '${actual}'"
    echo "Body: ${RESPONSE_BODY}"
    exit 1
  fi
}

assert_json_has() {
  local path="$1"
  local label="$2"
  if ! json_get "$RESPONSE_BODY" "$path" >/dev/null 2>&1; then
    echo "FAIL ${label}: missing JSON path '${path}'"
    echo "Body: ${RESPONSE_BODY}"
    exit 1
  fi
}

if [[ -z "$BASE_URL" || -z "$UNIT_CODE" || -z "$ADMIN_SESSION_COOKIE" ]]; then
  echo "Missing required env vars: BASE_URL, UNIT_CODE, ADMIN_SESSION_COOKIE"
  exit 1
fi

echo "==> Lookup unit"
request_json "GET" "${BASE_URL}/api/units/lookup?code=${UNIT_CODE}" "${ADMIN_SESSION_COOKIE}"
assert_status "200" "lookup initial"
assert_json_eq "code" "$UNIT_CODE" "lookup initial"
assert_json_has "status" "lookup initial"
echo "OK lookup"

echo "==> Acquire unit"
request_json "POST" "${BASE_URL}/api/units/acquire" "${ADMIN_SESSION_COOKIE}" "{\"code\":\"${UNIT_CODE}\",\"reason\":\"scan-regression\"}"
assert_status "200" "acquire"
assert_json_eq "kind" "ok" "acquire"
assert_json_eq "unit.code" "$UNIT_CODE" "acquire"
assert_json_eq "unit.status" "ACQUIRED" "acquire"
assert_json_has "product.quantity" "acquire"
echo "OK acquire"

echo "==> Repair-out unit"
request_json "POST" "${BASE_URL}/api/units/repair-out" "${ADMIN_SESSION_COOKIE}" "{\"code\":\"${UNIT_CODE}\",\"reason\":\"scan-regression\"}"
assert_status "200" "repair-out"
assert_json_eq "kind" "ok" "repair-out"
assert_json_eq "unit.code" "$UNIT_CODE" "repair-out"
assert_json_eq "unit.status" "IN_REPAIR" "repair-out"
echo "OK repair-out"

echo "==> Repair-in unit"
request_json "POST" "${BASE_URL}/api/units/repair-in" "${ADMIN_SESSION_COOKIE}" "{\"code\":\"${UNIT_CODE}\",\"reason\":\"scan-regression\"}"
assert_status "200" "repair-in"
assert_json_eq "kind" "ok" "repair-in"
assert_json_eq "unit.code" "$UNIT_CODE" "repair-in"
assert_json_eq "unit.status" "IN_STOCK" "repair-in"
echo "OK repair-in"

echo "==> Acquire + Return unit"
request_json "POST" "${BASE_URL}/api/units/acquire" "${ADMIN_SESSION_COOKIE}" "{\"code\":\"${UNIT_CODE}\",\"reason\":\"scan-regression\"}"
assert_status "200" "acquire before return"
assert_json_eq "unit.status" "ACQUIRED" "acquire before return"
request_json "POST" "${BASE_URL}/api/units/return" "${ADMIN_SESSION_COOKIE}" "{\"code\":\"${UNIT_CODE}\",\"reason\":\"scan-regression\"}"
assert_status "200" "return"
assert_json_eq "kind" "ok" "return"
assert_json_eq "unit.code" "$UNIT_CODE" "return"
assert_json_eq "unit.status" "IN_STOCK" "return"
echo "OK return"

if [[ -n "$USER_SESSION_COOKIE" ]]; then
  echo "==> Validate non-admin is forbidden on scrap/lost"
  request_json "POST" "${BASE_URL}/api/units/scrap" "${USER_SESSION_COOKIE}" "{\"code\":\"${UNIT_CODE}\"}"
  assert_status "403" "non-admin scrap forbidden"
  assert_json_eq "error" "Forbidden: admin only" "non-admin scrap forbidden"
  request_json "POST" "${BASE_URL}/api/units/lost" "${USER_SESSION_COOKIE}" "{\"code\":\"${UNIT_CODE}\"}"
  assert_status "403" "non-admin lost forbidden"
  assert_json_eq "error" "Forbidden: admin only" "non-admin lost forbidden"
  echo "OK non-admin forbidden checks"
fi

echo "==> Fetch recent movements for unit"
request_json "GET" "${BASE_URL}/api/units/lookup?code=${UNIT_CODE}" "${ADMIN_SESSION_COOKIE}"
assert_status "200" "lookup final"
assert_json_eq "code" "$UNIT_CODE" "lookup final"
assert_json_eq "status" "IN_STOCK" "lookup final"
echo "OK workflow regression"
