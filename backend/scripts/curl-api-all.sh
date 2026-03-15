#!/usr/bin/env bash
# Hit every HTTP route with curl. Fails on HTTP 500 (or wrong auth where documented).
# Requires: server running, jq, DATABASE_URL (migrated DB). Optional: SEED for richer paths.
#
#   cd backend && bash scripts/curl-api-all.sh
#   BASE_URL=http://localhost:5001 SEED=1 bash scripts/curl-api-all.sh
#
# SEED=1: login as alice@seed.skillswap.local / Password123! (expects seed data).

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5001}"
USE_SEED="${SEED:-0}"

die500() {
  local code="$1" name="$2"
  if [[ "${code}" == "500" ]]; then
    echo "FAIL: ${name} → HTTP ${code} (server error)" >&2
    exit 1
  fi
}

req() {
  # req NAME METHOD URL [curl-extra-args...]
  local name="$1" method="$2" url="$3"
  shift 3
  local out code
  out="$(mktemp)"
  code="$(curl -sS -o "${out}" -w "%{http_code}" -X "${method}" -H "Content-Type: application/json" "$@" "${url}")" || true
  echo "  [${code}] ${method} ${url}  (${name})"
  die500 "${code}" "${name}"
  if [[ -s "${out}" ]]; then
    if command -v jq >/dev/null 2>&1; then
      jq -c . "${out}" 2>/dev/null | head -c 200 || head -c 120 "${out}"
    else
      head -c 120 "${out}"
    fi
    echo ""
  fi
  rm -f "${out}"
  echo "${code}"
}

authreq() {
  # authreq NAME TOKEN METHOD URL [curl-extra-args...]
  local name="$1" token="$2" method="$3" url="$4"
  shift 4
  local out code
  out="$(mktemp)"
  code="$(curl -sS -o "${out}" -w "%{http_code}" -X "${method}" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" "$@" "${url}")" || true
  echo "  [${code}] ${method} ${url}  (${name})"
  die500 "${code}" "${name}"
  if [[ -s "${out}" ]]; then
    if command -v jq >/dev/null 2>&1; then
      jq -c . "${out}" 2>/dev/null | head -c 200 || head -c 120 "${out}"
    else
      head -c 120 "${out}"
    fi
    echo ""
  fi
  rm -f "${out}"
  echo "${code}"
}

echo "==> Public / health"
H="$(curl -sS -o /tmp/hl.json -w "%{http_code}" "${BASE_URL}/health")" || true
echo "  [${H}] GET ${BASE_URL}/health"
[[ "${H}" == "200" ]] || { echo "FAIL: /health not 200" >&2; exit 1; }
H="$(curl -sS -o /tmp/hr.json -w "%{http_code}" "${BASE_URL}/")" || true
echo "  [${H}] GET ${BASE_URL}/"
[[ "${H}" =~ ^(200|404)$ ]] || { echo "FAIL: / unexpected" >&2; exit 1; }

echo "==> Auth (unauthenticated + register + login)"
req "forgot-password" POST "${BASE_URL}/api/auth/forgot-password" \
  -d '{"email":"nobody@example.com"}' >/dev/null
req "reset-password (mock flow)" POST "${BASE_URL}/api/auth/reset-password" \
  -d '{"token":"mock","newPassword":"Password123!"}' >/dev/null

EMAIL="curl_all_$(date +%s)@example.com"
PASS="Password123!"

R="$(curl -sS -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"displayName\":\"Curl All\"}" "${BASE_URL}/api/auth/register")"
echo "${R}" | jq -c . 2>/dev/null | head -c 200; echo
ACCESS_TOKEN="$(echo "${R}" | jq -r '.data.accessToken // .accessToken // empty')"
if [[ -z "${ACCESS_TOKEN}" || "${ACCESS_TOKEN}" == "null" ]]; then
  echo "register response missing accessToken, trying login…"
fi

L="$(curl -sS -H "Content-Type: application/json" -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}" "${BASE_URL}/api/auth/login")"
echo "${L}" | jq -c . 2>/dev/null | head -c 200; echo
ACCESS_TOKEN="$(echo "${L}" | jq -r '.data.accessToken // .accessToken // empty')"
REFRESH_TOKEN="$(echo "${L}" | jq -r '.data.refreshToken // .refreshToken // empty')"
[[ -n "${ACCESS_TOKEN}" && "${ACCESS_TOKEN}" != "null" ]] || { echo "FAIL: no access token" >&2; exit 1; }

req "auth refresh" POST "${BASE_URL}/api/auth/refresh" -d "{\"refreshToken\":\"${REFRESH_TOKEN}\"}" >/dev/null

if [[ "${USE_SEED}" == "1" ]]; then
  echo "==> Re-login as seed user (SEED=1)"
  L="$(curl -sS -H "Content-Type: application/json" \
    -d '{"email":"alice@seed.skillswap.local","password":"Password123!"}' "${BASE_URL}/api/auth/login")" || true
  AT2="$(echo "${L}" | jq -r '.data.accessToken // empty')"
  if [[ -n "${AT2}" && "${AT2}" != "null" ]]; then
    ACCESS_TOKEN="${AT2}"
    echo "  using alice seed token for remaining calls"
  else
    echo "  WARN: seed login failed, continuing with new user token only"
  fi
fi

ME_ID="$(curl -sS -H "Authorization: Bearer ${ACCESS_TOKEN}" "${BASE_URL}/api/users/me" | jq -r '.data.id // .id // empty' 2>/dev/null || true)"
if [[ -z "${ME_ID}" || "${ME_ID}" == "null" ]]; then
  ME_ID="00000000-0000-0000-0000-000000000001"
fi

echo "==> Users (self)"
authreq "GET /me" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/users/me" >/dev/null
authreq "PUT /me" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/users/me" \
  -d '{"displayName":"Curl All","bio":"smoke"}' >/dev/null
authreq "search" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/users/search?q=skill&page=1&limit=3" >/dev/null
authreq "notification-prefs" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/users/me/notification-preferences" \
  -d '{"notifyEmail":true,"notifyPush":true,"notifyInApp":true}' >/dev/null

# Skills: by name to avoid hard-coded UUIDs
authreq "add skill" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/users/me/skills" \
  -d '{"name":"CurlTestSkill","type":"offer","proficiencyLevel":"INTERMEDIATE"}' >/dev/null
SKILL_JSON="$(curl -sS -H "Authorization: Bearer ${ACCESS_TOKEN}" "${BASE_URL}/api/users/me")"
USER_SKILL_ID="$(echo "${SKILL_JSON}" | jq -r '.data.skills[0].id // empty' 2>/dev/null || true)"
if [[ -n "${USER_SKILL_ID}" && "${USER_SKILL_ID}" != "null" ]]; then
  authreq "update skill" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/users/me/skills/${USER_SKILL_ID}" \
    -d '{"proficiencyLevel":"ADVANCED"}' >/dev/null
fi
FAKE_US="00000000-0000-0000-0000-0000000000aa"
authreq "public profile 404" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/users/${FAKE_US}" >/dev/null
authreq "public profile self" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/users/${ME_ID}" >/dev/null
authreq "online" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/users/${ME_ID}/online" >/dev/null
authreq "user reviews" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/users/${ME_ID}/reviews" >/dev/null

# Availability (valid ISO times)
SLOT_START="$(date -u +%Y-%m-%d)T15:00:00.000Z"
SLOT_END="$(date -u +%Y-%m-%d)T16:00:00.000Z"
authreq "availability post" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/users/me/availability" \
  -d "{\"dayOfWeek\":1,\"slotStart\":\"${SLOT_START}\",\"slotEnd\":\"${SLOT_END}\",\"isRecurring\":false}" >/dev/null
SLOT_ID="$(curl -sS -H "Authorization: Bearer ${ACCESS_TOKEN}" "${BASE_URL}/api/users/me" | jq -r '.data.availabilitySlots[0].id // empty' 2>/dev/null || true)"
if [[ -n "${SLOT_ID}" && "${SLOT_ID}" != "null" ]]; then
  authreq "availability delete" "${ACCESS_TOKEN}" DELETE "${BASE_URL}/api/users/me/availability/${SLOT_ID}" >/dev/null
fi
authreq "availability bulk" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/users/me/availability" \
  -d '{"availability":{"1":["09:00-10:00"]}}' >/dev/null

if [[ -n "${USER_SKILL_ID}" && "${USER_SKILL_ID}" != "null" ]]; then
  authreq "remove skill" "${ACCESS_TOKEN}" DELETE "${BASE_URL}/api/users/me/skills/${USER_SKILL_ID}" >/dev/null
fi

echo "==> Matching"
authreq "match stats" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/matches/stats" >/dev/null
authreq "match list" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/matches?strategy=skill&page=1&limit=5" >/dev/null
FAKE_MATCH="00000000-0000-0000-0000-0000000000bb"
authreq "match by id" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/matches/${FAKE_MATCH}" >/dev/null
authreq "match explain" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/matches/${FAKE_MATCH}/explain" >/dev/null
authreq "decline fake" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/matches/${FAKE_MATCH}/decline" >/dev/null
authreq "accept fake" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/matches/${FAKE_MATCH}/accept" >/dev/null

echo "==> Swaps"
authreq "swaps active" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/swaps/active" >/dev/null
authreq "swaps history" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/swaps/history?page=1&limit=5" >/dev/null
authreq "swaps stats" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/swaps/stats" >/dev/null
authreq "swaps sessions upcoming" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/swaps/sessions/upcoming" >/dev/null
authreq "swaps root list" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/swaps?page=1&limit=3" >/dev/null
authreq "swap by id" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/swaps/${FAKE_MATCH}" >/dev/null
authreq "swap create invalid" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/swaps" \
  -d "{\"matchId\":\"${FAKE_MATCH}\",\"offeredSkillId\":\"${FAKE_MATCH}\",\"requestedSkillId\":\"${FAKE_MATCH}\"}" >/dev/null
for action in accept decline start complete cancel complete-confirm; do
  authreq "swap ${action}" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/swaps/${FAKE_MATCH}/${action}" -d '{}' >/dev/null
done
authreq "swap session schedule" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/swaps/${FAKE_MATCH}/sessions" \
  -d '{"scheduledAt":"2099-06-10T20:00:00.000Z","durationMins":60}' >/dev/null
authreq "swap session reschedule" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/swaps/${FAKE_MATCH}/sessions/${FAKE_MATCH}/reschedule" \
  -d '{"scheduledAt":"2099-06-11T21:00:00.000Z"}' >/dev/null
authreq "swap reviews get" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/swaps/${FAKE_MATCH}/reviews" >/dev/null
authreq "swap review post" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/swaps/${FAKE_MATCH}/reviews" \
  -d '{"rating":5,"comment":"curl","isPublic":true}' >/dev/null

echo "==> Reviews (top-level edit)"
authreq "review edit" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/reviews/${FAKE_MATCH}" -d '{"rating":4,"comment":"x"}' >/dev/null

echo "==> Chats"
authreq "chat unread" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/chats/unread-count" >/dev/null
authreq "chat messages" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/chats/${FAKE_MATCH}/messages" >/dev/null
authreq "delete message" "${ACCESS_TOKEN}" DELETE "${BASE_URL}/api/chats/${FAKE_MATCH}/messages/${FAKE_MATCH}" >/dev/null

echo "==> Notifications"
authreq "notifications" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/notifications?page=1&limit=10" >/dev/null
authreq "notifications unread" "${ACCESS_TOKEN}" GET "${BASE_URL}/api/notifications/unread-count" >/dev/null
authreq "notifications read all" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/notifications/read-all" >/dev/null
authreq "notification read" "${ACCESS_TOKEN}" PUT "${BASE_URL}/api/notifications/${FAKE_MATCH}/read" >/dev/null

echo "==> Admin (non-admin: expect 403, not 500)"
A="$(curl -sS -o /tmp/a.json -w "%{http_code}" -H "Authorization: Bearer ${ACCESS_TOKEN}" "${BASE_URL}/api/admin/match-analytics")" || true
echo "  [${A}] GET ${BASE_URL}/api/admin/match-analytics"
die500 "${A}" "admin match-analytics"
if [[ "${A}" != "403" && "${A}" != "401" ]]; then
  echo "  (ok if 403/401; got ${A})"
fi
A="$(curl -sS -o /tmp/a2.json -w "%{http_code}" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{}' "${BASE_URL}/api/admin/reviews/${FAKE_MATCH}/flag")" || true
echo "  [${A}] POST ${BASE_URL}/api/admin/reviews/.../flag"
die500 "${A}" "admin flag review"

echo "==> Auth logout (last: revokes refresh token)"
L="$(authreq "logout" "${ACCESS_TOKEN}" POST "${BASE_URL}/api/auth/logout" | tail -1)"
[[ "${L}" =~ ^(200|204)$ ]] || echo "  note: logout HTTP ${L}"

echo "==> All curl checks finished (no 500s)."
