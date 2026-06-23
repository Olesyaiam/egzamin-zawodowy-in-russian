#!/usr/bin/env bash
# Одноразовая активация защиты ветки release в текущем клоне.
#
# Конфиг git (core.hooksPath, merge.ours.driver) живёт в .git/config и НЕ
# коммитится — поэтому на каждой новой машине его надо включить вручную.
# Сами файлы защиты (.gitattributes + .githooks/pre-commit) уже в репозитории.
#
# Что включаем:
#   core.hooksPath=.githooks  → git начинает исполнять наш .githooks/pre-commit
#                               (запрет прямых коммитов в release и попадания
#                                docker-compose.override.yaml в release)
#   merge.ours.driver=true    → активирует драйвер `ours` из .gitattributes,
#                               чтобы dev-override не втекал в release при merge
set -euo pipefail
cd "$(dirname "$0")/.."

git config core.hooksPath .githooks
git config merge.ours.driver true

echo "=> Хуки активированы для этого клона:"
echo "   core.hooksPath    = $(git config core.hooksPath)"
echo "   merge.ours.driver = $(git config merge.ours.driver)"
