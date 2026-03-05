#!/usr/bin/env bash
set -euo pipefail

# Minimal end-to-end test for the 2-step approval flow:
# USER creates ticket + request, CHEFIA approves (scoped), FINAL approves (global).
#
# Required env vars:
#   BASE_URL
#   USER_COOKIE     e.g. "session_id=...; user_role=USER"
#   CHEFIA_COOKIE   session cookie of a user with scoped requests.approve for the request's service
#   FINAL_COOKIE    session cookie of a user with requests.final_approve (global) or ADMIN
#
# Optional:
#   TITLE, NOTES, DELIVERY
#
# Example:
# BASE_URL=http://localhost:3000 \
# USER_COOKIE='session_id=...; user_role=USER' \
# CHEFIA_COOKIE='session_id=...; user_role=USER' \
# FINAL_COOKIE='session_id=...; user_role=ADMIN' \
# bash scripts/test-approval-2step.sh

BASE_URL="${BASE_URL:-}"
USER_COOKIE="${USER_COOKIE:-}"
CHEFIA_COOKIE="${CHEFIA_COOKIE:-}"
FINAL_COOKIE="${FINAL_COOKIE:-}"

TITLE="${TITLE:-E2E approval flow}"
NOTES="${NOTES:-Pedido de teste e2e}"
DELIVERY="${DELIVERY:-Gabinete 1}"

if [[ -z "$BASE_URL" || -z "$USER_COOKIE" || -z "$CHEFIA_COOKIE" || -z "$FINAL_COOKIE" ]]; then
  echo "Missing required env vars: BASE_URL, USER_COOKIE, CHEFIA_COOKIE, FINAL_COOKIE"
  exit 1
fi

tmp_body="$(mktemp)"
trap 'rm -f "$tmp_body"' EXIT

request_json() {
  local method="$1"
  local url="$2"
  local cookie="$3"
  local payload="${4:-}"

  if [[ -n "$payload" ]]; then
    curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Cookie: $cookie" \
      --data "$payload"
  else
    curl -sS -o "$tmp_body" -w "%{http_code}" -X "$method" "$url" \
      -H "Cookie: $cookie"
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

echo "Testing 2-step approvals against: $BASE_URL"

echo "[1/6] Create ticket as USER"
code="$(request_json POST "$BASE_URL/api/tickets" "$USER_COOKIE" "{\"title\":\"$TITLE\",\"description\":\"$NOTES\",\"type\":\"REQUEST\",\"priority\":\"NORMAL\"}")"
expect_code "$code" "201" "create ticket"
ticket_id="$(cat "$tmp_body" | jq -r '.id // empty')"
if [[ -z "$ticket_id" ]]; then
  echo "FAIL [create ticket] missing ticket id"
  cat "$tmp_body"
  exit 1
fi

echo "[2/6] Create request via user-intake linked to ticket"
payload="$(jq -nc --arg title "$TITLE" --arg notes "$NOTES" --arg delivery "$DELIVERY" --arg ticketId "$ticket_id" '{title:$title,notes:$notes,deliveryLocation:$delivery,ticketId:$ticketId}')"
code="$(request_json POST "$BASE_URL/api/requests/user-intake" "$USER_COOKIE" "$payload")"
expect_code "$code" "201" "user-intake submit"
request_id="$(cat "$tmp_body" | jq -r '.id // empty')"
if [[ -z "$request_id" ]]; then
  echo "FAIL [user-intake submit] missing request id"
  cat "$tmp_body"
  exit 1
fi

echo "[3/6] CHEFIA approves (moves to awaiting final)"
code="$(request_json POST "$BASE_URL/api/workflows/requests/$request_id/action" "$CHEFIA_COOKIE" '{"targetStatus":"APPROVED","note":"e2e-chefia-approve"}')"
expect_code "$code" "200" "chefia approve"

echo "[4/6] FINAL approves (moves to approved)"
code="$(request_json POST "$BASE_URL/api/workflows/requests/$request_id/action" "$FINAL_COOKIE" '{"targetStatus":"APPROVED","note":"e2e-final-approve"}')"
expect_code "$code" "200" "final approve"

echo "[5/6] Ticket shows request link"
code="$(request_json GET "$BASE_URL/api/tickets/$ticket_id" "$USER_COOKIE")"
expect_code "$code" "200" "ticket details"
linked="$(cat "$tmp_body" | jq -r --arg rid "$request_id" '.requests[]? | select(.id==$rid) | .id' | head -n 1)"
if [[ "$linked" != "$request_id" ]]; then
  echo "FAIL [ticket details] request not linked"
  cat "$tmp_body"
  exit 1
fi

echo "[6/6] Request is approved"
code="$(request_json GET "$BASE_URL/api/requests/$request_id" "$FINAL_COOKIE")"
expect_code "$code" "200" "request details"
status="$(cat "$tmp_body" | jq -r '.status // empty')"
if [[ "$status" != "APPROVED" ]]; then
  echo "FAIL [request details] expected status APPROVED, got '$status'"
  cat "$tmp_body"
  exit 1
fi

echo "OK: 2-step approval flow passed"

