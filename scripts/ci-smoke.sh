#!/usr/bin/env bash
set -euo pipefail

created_env=false
if [ ! -f .env ]; then
  cp .env.example .env
  created_env=true
fi

cleanup() {
  if [ "${created_env}" = true ]; then
    rm -f .env
  fi
}
trap cleanup EXIT

wait_for_health() {
  local container="$1"
  local attempts=60
  local sleep_time=2
  for _ in $(seq 1 ${attempts}); do
    local status
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "${container}" 2>/dev/null || echo "missing")
    if [ "${status}" = "healthy" ]; then
      return 0
    fi
    sleep "${sleep_time}"
  done
  echo "Container ${container} failed to become healthy" >&2
  docker ps --format "table {{.Names}}\t{{.Status}}"
  return 1
}

docker compose up -d --build

wait_for_health aggregator_service
wait_for_health events_service
wait_for_health dj_service
wait_for_health venue_service
wait_for_health auth_service

curl -fsS http://localhost:4000/health >/dev/null
curl -fsS http://localhost:4003/health >/dev/null
curl -fsS http://localhost:4002/health >/dev/null
curl -fsS http://localhost:4001/health >/dev/null
curl -fsS http://localhost:3001/health >/dev/null

curl -fsS http://localhost:4000/metrics >/dev/null
curl -fsS http://localhost:4003/metrics >/dev/null
curl -fsS http://localhost:4002/metrics >/dev/null
curl -fsS http://localhost:4001/metrics >/dev/null
curl -fsS http://localhost:3001/metrics >/dev/null

echo "Running end-to-end API checks..."

EMAIL="ci+$(date +%s)@example.com"
PASS="Test12345!"

curl -fsS -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"CI User\",\"email\":\"${EMAIL}\",\"password\":\"${PASS}\",\"role\":\"organizer\"}" >/dev/null

LOGIN_JSON=$(curl -fsS -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")

TOKEN=$(python3 -c 'import json, sys; print(json.loads(sys.argv[1]).get("token",""))' "${LOGIN_JSON}")

if [ -z "${TOKEN}" ]; then
  echo "Failed to obtain auth token" >&2
  exit 1
fi

curl -fsS "http://localhost:4000/v1/events/search?city=Dublin&from=2024-01-01&to=2027-12-31" >/tmp/events.json
EVENT_ID=$(python3 - <<'PY'
import json, sys
data = json.load(open("/tmp/events.json"))
events = data.get("events") or []
print(events[0]["id"] if events else "")
PY)

if [ -z "${EVENT_ID}" ]; then
  echo "No events returned from search" >&2
  exit 1
fi

curl -fsS -X POST http://localhost:4000/v1/events/${EVENT_ID}/save \
  -H "Authorization: Bearer ${TOKEN}" >/dev/null

curl -fsS -X POST http://localhost:4000/v1/events/${EVENT_ID}/hide \
  -H "Authorization: Bearer ${TOKEN}" >/dev/null

curl -fsS http://localhost:4000/v1/users/me/hidden \
  -H "Authorization: Bearer ${TOKEN}" >/dev/null

curl -fsS -X DELETE http://localhost:4000/v1/events/${EVENT_ID}/hide \
  -H "Authorization: Bearer ${TOKEN}" >/dev/null

curl -fsS -X POST http://localhost:3001/auth/preferences \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"preferred_genres":["techno"],"preferred_artists":["Bicep"],"preferred_cities":["Dublin"],"night_preferences":["weekend"]}' >/dev/null

curl -fsS http://localhost:4000/v1/users/me/feed \
  -H "Authorization: Bearer ${TOKEN}" >/dev/null

curl -fsS -X POST http://localhost:4000/v1/alerts \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"artist_name":"Bicep","city":"Dublin"}' >/dev/null

curl -fsS http://localhost:4000/v1/alerts/notifications \
  -H "Authorization: Bearer ${TOKEN}" >/dev/null

echo "End-to-end checks passed."

docker compose down -v
