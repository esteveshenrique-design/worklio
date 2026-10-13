#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo 'Install Node.js 24 LTS from https://nodejs.org, then run this file again.'
  exit 1
fi
if [ ! -f dist/index.html ]; then
  npm ci
  npm run build
fi
printf '\nOpen http://localhost:3000 in your browser.\n'
npm start
