#!/usr/bin/env bash
set -euo pipefail

FILES=$(rg --files -g '*.js' -g '*.jsx' aggregator-service/src events-service auth-service dj-service venue-service gigfinder-app/src)

if [ -z "${FILES}" ]; then
  echo "No files found to lint."
  exit 0
fi

./node_modules/.bin/eslint --no-eslintrc --config .eslintrc.json ${FILES}
