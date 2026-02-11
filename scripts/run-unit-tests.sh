#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=test

install_deps() {
  local service_dir="$1"
  echo "Installing dependencies in ${service_dir}..."
  (cd "${service_dir}" && npm install --no-audit --no-fund)
}

install_deps aggregator-service
install_deps events-service
install_deps dj-service
install_deps venue-service
install_deps auth-service

node --test aggregator-service/test/health.test.js
node --test events-service/test/health.test.js
node --test dj-service/test/health.test.js
node --test venue-service/test/health.test.js
node --test auth-service/test/health.test.js
