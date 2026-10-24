#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Marcel Petrick
# SPDX-License-Identifier: GPL-3.0-or-later
# Build and smoke-test the production image, or pull one supplied as argument.
# Requires Docker, curl and Node.js; local builds also use Git.
# Uses a random loopback port and always removes its test container and temp files.
set -euo pipefail
cd "$(dirname "$0")/.."
check_dir=$(mktemp -d)
cleanup() {
  if test -s "$check_dir/container-id"; then
    docker rm -f "$(cat "$check_dir/container-id")" >/dev/null
  fi
  rm -rf "$check_dir"
}
trap cleanup EXIT
if test "$#" -gt 0; then
  docker pull "$1"
  docker image inspect --format '{{.Id}}' "$1" > "$check_dir/image-id"
else
  version=$(node -p 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8")).version')
  revision=$(git rev-parse --verify HEAD)
  docker build --build-arg "VERSION=$version" --build-arg "REVISION=$revision" \
    --iidfile "$check_dir/image-id" --tag dercoolezoo:local .
fi
docker run --detach --cidfile "$check_dir/container-id" --read-only \
  --tmpfs /tmp:rw,nosuid,noexec,size=16m --cap-drop ALL \
  --security-opt no-new-privileges --publish 127.0.0.1::8080 \
  "$(cat "$check_dir/image-id")" >/dev/null
container_id=$(cat "$check_dir/container-id")
port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' "$container_id")
origin="http://127.0.0.1:$port"
ready=false
for ((attempt = 0; attempt < 30; attempt++)); do
  if curl --fail --silent --connect-timeout 2 --max-time 5 "$origin/health" > "$check_dir/health"; then
    ready=true
    break
  fi
  sleep 1
done
if test "$ready" != true; then
  docker logs "$container_id"
  exit 1
fi
test "$(cat "$check_dir/health")" = ok
curl --fail --silent --show-error --connect-timeout 2 --max-time 10 "$origin/" > "$check_dir/index.html"
asset_path=$(node -e '
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[1], "utf8");
const match = html.match(/<script[^>]+src="([^"]+\.js)"/);
if (!match) process.exit(1);
console.log(new URL(match[1], process.argv[2]).pathname);
' "$check_dir/index.html" "$origin/")
curl --fail --silent --show-error --connect-timeout 2 --max-time 10 "$origin$asset_path" > "$check_dir/app.js"
test -s "$check_dir/app.js"
curl --fail --silent --show-error --connect-timeout 2 --max-time 10 "$origin/LICENSE" > "$check_dir/LICENSE"
cmp LICENSE "$check_dir/LICENSE"
test "$(docker inspect --format '{{.Config.User}}' "$container_id")" = 101:101
test "$(curl --silent --connect-timeout 2 --max-time 10 --output /dev/null --write-out '%{http_code}' "$origin/assets/missing.js")" = 404
printf 'Docker check passed: health, HTML, JavaScript, license, non-root user, missing-asset handling.\n'
