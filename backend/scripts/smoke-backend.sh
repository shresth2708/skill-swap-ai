#!/usr/bin/env bash
set -euo pipefail

# Smoke test runner for SkillSwap backend APIs using curl.
# Requirements:
# - backend server running (default http://localhost:5001)
# - DATABASE_URL points to a migrated DB with seed data OR allow creating test users
#
# Usage:
#   BASE_URL=http://localhost:5001 bash backend/scripts/smoke-backend.sh

BASE_URL="${BASE_URL:-http://localhost:5001}"

json() {
  curl -sS -H "Content-Type: application/json" "$@"
}

auth_json() {
  local token="$1"; shift
  curl -sS -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" "$@"
}

auth_json_status() {
  local token="$1"; shift
  curl -sS -w "\n%{http_code}\n" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" "$@"
}

echo "==> BASE_URL=${BASE_URL}"

echo "==> Health"
curl -sS "${BASE_URL}/" | jq .

EMAIL="smoke_$(date +%s)@example.com"
PASS="password123"

echo "==> Register"
json -X POST "${BASE_URL}/api/auth/register" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"displayName\":\"Smoke Test\"}" | jq .

echo "==> Login"
LOGIN_RES="$(json -X POST "${BASE_URL}/api/auth/login" -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")"
echo "${LOGIN_RES}" | jq .

ACCESS_TOKEN="$(echo "${LOGIN_RES}" | jq -r '.data.accessToken // empty')"
REFRESH_TOKEN="$(echo "${LOGIN_RES}" | jq -r '.data.refreshToken // empty')"

if [[ -z "${ACCESS_TOKEN}" ]]; then
  echo "ERROR: accessToken missing from login response" >&2
  exit 1
fi

echo "==> Refresh token (should succeed)"
if [[ -n "${REFRESH_TOKEN}" ]]; then
  json -X POST "${BASE_URL}/api/auth/refresh" -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}" | jq .
fi

echo "==> /api/users/me (before logout)"
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/users/me" | jq .

echo "==> Socket.io smoke (connect + NOT_FOUND join)"
TOKEN="${ACCESS_TOKEN}" BASE_URL="${BASE_URL}" node scripts/smoke-socket.js

echo "==> Update notification preferences"
auth_json "${ACCESS_TOKEN}" -X PUT "${BASE_URL}/api/users/me/notification-preferences" \
  -d '{"notifyEmail":true,"notifyPush":true,"notifyInApp":true}' | jq .

echo "==> Notifications list (empty ok)"
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/notifications?page=1&limit=10" | jq .

echo "==> Notifications unread-count"
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/notifications/unread-count" | jq .

echo "==> Notifications read-all"
auth_json "${ACCESS_TOKEN}" -X PUT "${BASE_URL}/api/notifications/read-all" | jq .

echo "==> Chat unread-count"
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/chats/unread-count" | jq .

echo "==> Matches stats"
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/matches/stats" | jq .

echo "==> Matches list (may be empty / needs skills)"
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/matches?strategy=skill&page=1&limit=10" | jq .

echo "==> Swaps stats/history/active"
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/swaps/stats" | jq .
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/swaps/history?page=1&limit=5" | jq .
auth_json "${ACCESS_TOKEN}" "${BASE_URL}/api/swaps/active" | jq .

echo "==> Swap create (expected 400 validation error, must not be 500)"
RESP="$(auth_json_status "${ACCESS_TOKEN}" -X POST "${BASE_URL}/api/swaps" -d '{"matchId":"bad","offeredSkillId":"bad","requestedSkillId":"bad"}')"
BODY="$(echo "${RESP}" | sed '$d')"
STATUS="$(echo "${RESP}" | tail -n 1)"
echo "${BODY}" | jq .
if [[ "${STATUS}" == "500" ]]; then
  echo "ERROR: swap create returned 500 (should be validation 4xx)" >&2
  exit 1
fi

echo "==> Auth logout (last; revokes refresh token)"
auth_json "${ACCESS_TOKEN}" -X POST "${BASE_URL}/api/auth/logout" | jq .

echo "==> Done (basic smoke passed)."

