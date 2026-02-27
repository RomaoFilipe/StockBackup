#!/usr/bin/env bash
set -euo pipefail

# Validates scoped RBAC against workflow transitions.
#
# Required env vars:
#   BASE_URL
#   WORKFLOW_SESSION_COOKIE       session_id of user expected to have scoped permission
#   ALLOWED_REQUEST_ID            request inside allowed scope
#   DENIED_REQUEST_ID             request outside allowed scope
#
# Optional:
#   FORBIDDEN_SESSION_COOKIE      session_id without permission (expect 403 on allowed request)
#
# Example:
# BASE_URL=http://localhost:3000 \
# WORKFLOW_SESSION_COOKIE=... \
# ALLOWED_REQUEST_ID=<uuid> \
# DENIED_REQUEST_ID=<uuid> \
# FORBIDDEN_SESSION_COOKIE=... \
# bash scripts/test-rbac-workflow-scope.sh

BASE_URL="${BASE_URL:-}"
WORKFLOW_SESSION_COOKIE="${WORKFLOW_SESSION_COOKIE:-}"
ALLOWED_REQUEST_ID="${ALLOWED_REQUEST_ID:-}"
DENIED_REQUEST_ID="${DENIED_REQUEST_ID:-}"
FORBIDDEN_SESSION_COOKIE="${FORBIDDEN_SESSION_COOKIE:-}"

if [[ -z "$BASE_URL" || -z "$WORKFLOW_SESSION_COOKIE" || -z "$ALLOWED_REQUEST_ID" || -z "$DENIED_REQUEST_ID" ]]; then
  echo "Missing required env vars: BASE_URL, WORKFLOW_SESSION_COOKIE, ALLOWED_REQUEST_ID, DENIED_REQUEST_ID"
  exit 1
fi

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT

request_json() {
  local method="$1"
  local url="$2"
  local session_cookie="$3"
  local payload="${4:-}"

  if [[ -n "$payload" ]]; then
    curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Cookie: session_id=${session_cookie}" \
      --data "$payload"
  else
    curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
      -H "Cookie: session_id=${session_cookie}"
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

echo "Testing workflow RBAC scope against: $BASE_URL"

echo "[1/4] Scoped user can view allowed workflow instance"
code="$(request_json GET "$BASE_URL/api/workflows/requests/$ALLOWED_REQUEST_ID/action" "$WORKFLOW_SESSION_COOKIE")"
expect_code "$code" "200" "allowed workflow GET"

echo "[2/4] Scoped user can transition allowed request"
code="$(request_json POST "$BASE_URL/api/workflows/requests/$ALLOWED_REQUEST_ID/action" "$WORKFLOW_SESSION_COOKIE" '{"targetStatus":"APPROVED","note":"scope-test"}')"
expect_code "$code" "200" "allowed workflow POST"

echo "[3/4] Scoped user is blocked outside scope"
code="$(request_json POST "$BASE_URL/api/workflows/requests/$DENIED_REQUEST_ID/action" "$WORKFLOW_SESSION_COOKIE" '{"targetStatus":"APPROVED","note":"scope-test"}')"
expect_code "$code" "403" "denied workflow POST"

if [[ -n "$FORBIDDEN_SESSION_COOKIE" ]]; then
  echo "[4/4] User without transition permission is blocked"
  code="$(request_json POST "$BASE_URL/api/workflows/requests/$ALLOWED_REQUEST_ID/action" "$FORBIDDEN_SESSION_COOKIE" '{"targetStatus":"APPROVED","note":"scope-test"}')"
  expect_code "$code" "403" "forbidden workflow POST"
else
  echo "[4/4] SKIP forbidden user check (set FORBIDDEN_SESSION_COOKIE to run)"
fi

echo "OK: workflow RBAC scope checks passed"
