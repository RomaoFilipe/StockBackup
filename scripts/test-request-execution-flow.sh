#!/usr/bin/env bash
set -euo pipefail

# Minimal sanity flow for warehouse execution endpoint.
# Requires:
# - API_BASE (default http://localhost:3000/api)
# - SESSION_COOKIE (e.g. 'session=...; user_role=ADMIN; tenant=...')
# - REQUEST_ID (approved STANDARD request id)
#
# Optional:
# - DOC_REF (default AUTO-TEST-<timestamp>)

API_BASE="${API_BASE:-http://localhost:3000/api}"
SESSION_COOKIE="${SESSION_COOKIE:-}"
REQUEST_ID="${REQUEST_ID:-}"
DOC_REF="${DOC_REF:-AUTO-TEST-$(date +%s)}"

if [[ -z "$SESSION_COOKIE" ]]; then
  echo "SESSION_COOKIE is required" >&2
  exit 1
fi

if [[ -z "$REQUEST_ID" ]]; then
  echo "REQUEST_ID is required" >&2
  exit 1
fi

IDEMP="exec-test-$(date +%s)-$RANDOM"

echo "[1/3] Fetch execution options"
OPTIONS_JSON=$(curl -sS -f \
  -H "Cookie: $SESSION_COOKIE" \
  "$API_BASE/requests/$REQUEST_ID/execute")

echo "$OPTIONS_JSON" | head -c 400 && echo

echo "[2/3] Execute request"
EXEC_JSON=$(curl -sS -f -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  "$API_BASE/requests/$REQUEST_ID/execute" \
  --data "{\"idempotencyKey\":\"$IDEMP\",\"documentRef\":\"$DOC_REF\",\"note\":\"script flow\"}")

echo "$EXEC_JSON" | head -c 400 && echo

echo "[3/3] Retry same idempotency key (must be idempotent=true)"
IDEMP_JSON=$(curl -sS -f -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  "$API_BASE/requests/$REQUEST_ID/execute" \
  --data "{\"idempotencyKey\":\"$IDEMP\",\"documentRef\":\"$DOC_REF\",\"note\":\"script flow retry\"}")

echo "$IDEMP_JSON" | head -c 400 && echo

echo "Done"
