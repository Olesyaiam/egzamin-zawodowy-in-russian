#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

sudo mkdir -p server/storage/logs server/storage/ramdisk_tmpfs
sudo chown -R 33:33 server/storage
sudo chmod -R u+rwX,g+rwX server/storage

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(docker-compose)
fi

"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps
echo ""
echo "=> APP: http://localhost:8081/translations/stats"
