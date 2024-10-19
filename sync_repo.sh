#!/bin/bash
script_dir=$(dirname "$0")
cd "$script_dir" || exit
git pull
chmod 777 server/storage/translations.json
git add server/storage/translations.json
git commit -m "translations updated"
git push
