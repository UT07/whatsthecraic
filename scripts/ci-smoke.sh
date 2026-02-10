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

docker compose down -v
