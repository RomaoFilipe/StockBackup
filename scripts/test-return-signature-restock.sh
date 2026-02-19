#!/usr/bin/env bash
set -euo pipefail

# End-to-end API check for RETURN flow:
# 1) unit return creates RETURN request (no immediate restock)
# 2) cannot force FULFILLED before pickup signature
# 3) pickup signature finalizes request and restocks unit
#
# Required env vars:
#   BASE_URL            e.g. http://localhost:3000
#   ADMIN_EMAIL         admin login email
#   ADMIN_PASSWORD      admin login password
#   UNIT_CODE           UUID code of an ACQUIRED test unit
#
# Optional:
#   COOKIE_JAR          cookie jar path (default: /tmp/stockly_return_cookie.txt)
#
# Example:
# BASE_URL=http://localhost:3000 \
# ADMIN_EMAIL=admin@gmail.com \
# ADMIN_PASSWORD=12345678 \
# UNIT_CODE=00000000-0000-0000-0000-000000000000 \
# bash scripts/test-return-signature-restock.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
UNIT_CODE="${UNIT_CODE:-}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/stockly_return_cookie.txt}"

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" || -z "$UNIT_CODE" ]]; then
  echo "Missing required env vars: ADMIN_EMAIL, ADMIN_PASSWORD, UNIT_CODE"
  exit 1
fi

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT
rm -f "$COOKIE_JAR"

request_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local status

  if [[ -n "$data" ]]; then
    status="$(curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -d "$data" \
      "$url")"
  else
    status="$(curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" \
      -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      "$url")"
  fi

  RESPONSE_STATUS="$status"
  RESPONSE_BODY="$(cat "$tmp_body")"
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

assert_jq_eq() {
  local jq_expr="$1"
  local expected="$2"
  local label="$3"
  local actual
  actual="$(echo "$RESPONSE_BODY" | jq -r "$jq_expr")"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL ${label}: expected ${jq_expr}='${expected}', got '${actual}'"
    echo "Body: ${RESPONSE_BODY}"
    exit 1
  fi
}

assert_jq_nonempty() {
  local jq_expr="$1"
  local label="$2"
  local actual
  actual="$(echo "$RESPONSE_BODY" | jq -r "$jq_expr")"
  if [[ -z "$actual" || "$actual" == "null" ]]; then
    echo "FAIL ${label}: expected non-empty ${jq_expr}"
    echo "Body: ${RESPONSE_BODY}"
    exit 1
  fi
}

echo "[1/9] Login admin..."
request_json "POST" "${BASE_URL}/api/auth/login" "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}"
assert_status "200" "admin login"

echo "[2/9] Ensure unit is ACQUIRED before return..."
request_json "GET" "${BASE_URL}/api/units/lookup?code=${UNIT_CODE}"
assert_status "200" "lookup before"
current_status="$(echo "$RESPONSE_BODY" | jq -r '.status')"
if [[ "$current_status" == "IN_STOCK" ]]; then
  request_json "POST" "${BASE_URL}/api/units/acquire" "{\"code\":\"${UNIT_CODE}\",\"reason\":\"return-flow-test\"}"
  assert_status "200" "acquire prep"
  assert_jq_eq '.unit.status' "ACQUIRED" "acquire prep"
elif [[ "$current_status" != "ACQUIRED" ]]; then
  echo "FAIL setup: unit status must be IN_STOCK or ACQUIRED, got '${current_status}'"
  echo "Body: ${RESPONSE_BODY}"
  exit 1
fi

echo "[3/9] Create RETURN request via /units/return..."
request_json "POST" "${BASE_URL}/api/units/return" "{\"code\":\"${UNIT_CODE}\",\"reason\":\"return-flow-test\"}"
assert_status "200" "units/return"
assert_jq_eq '.kind' "ok" "units/return kind"
assert_jq_eq '.unit.code' "${UNIT_CODE}" "units/return unit code"
assert_jq_eq '.unit.status' "ACQUIRED" "units/return status (no immediate restock)"
assert_jq_nonempty '.linkedRequest.id' "units/return linked request id"
assert_jq_nonempty '.linkedRequest.gtmiNumber' "units/return linked request number"
request_id="$(echo "$RESPONSE_BODY" | jq -r '.linkedRequest.id')"

echo "[4/9] Validate created request payload..."
request_json "GET" "${BASE_URL}/api/requests/${request_id}"
assert_status "200" "request detail after create"
assert_jq_eq '.requestType' "RETURN" "request type"
assert_jq_eq '.status' "SUBMITTED" "request status"
assert_jq_eq '.pickupSignedAt' "null" "pickup signature absent"
assert_jq_eq '.items[0].role' "OLD" "return item role"
assert_jq_eq '.items[0].destination' "${UNIT_CODE}" "return item destination"

echo "[5/9] Approve request..."
request_json "PATCH" "${BASE_URL}/api/requests/${request_id}" '{"status":"APPROVED"}'
assert_status "200" "approve request"
assert_jq_eq '.status' "APPROVED" "approved status"

echo "[6/9] Ensure FULFILLED is blocked before pickup signature..."
request_json "PATCH" "${BASE_URL}/api/requests/${request_id}" '{"status":"FULFILLED"}'
assert_status "400" "fulfilled blocked"
assert_jq_nonempty '.error' "fulfilled blocked error"

echo "[7/9] Sign pickup (auto-finalize expected)..."
request_json "PATCH" "${BASE_URL}/api/requests/${request_id}" '{"pickupSign":{"name":"Teste QA","title":"Operador","signatureDataUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9N0l8AAAAASUVORK5CYII="}}'
assert_status "200" "pickup sign"
assert_jq_eq '.status' "FULFILLED" "pickup sign auto-fulfill"
assert_jq_nonempty '.pickupSignedAt' "pickup signed at"

echo "[8/9] Validate request finalized..."
request_json "GET" "${BASE_URL}/api/requests/${request_id}"
assert_status "200" "request detail finalized"
assert_jq_eq '.status' "FULFILLED" "final status"
assert_jq_nonempty '.pickupSignedAt' "final pickup signed at"

echo "[9/9] Validate unit returned to stock..."
request_json "GET" "${BASE_URL}/api/units/lookup?code=${UNIT_CODE}"
assert_status "200" "lookup final"
assert_jq_eq '.status' "IN_STOCK" "unit restocked"

echo "OK: RETURN flow with signature gate + restock passed"
