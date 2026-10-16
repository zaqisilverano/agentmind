#!/bin/sh
# Production-image smoke test: build docker/Dockerfile, run it against a real Postgres, then check health, identity
# and one write through the same-origin check with a proxy-style Host header (the standalone server binds 0.0.0.0).
#
# Needs a migrated-or-empty Postgres with user, password and database "atlas" (the container migrates on start):
#   CI (Linux):  a postgres:16 service on 127.0.0.1:5432; the container uses --network host and port 3000.
#   macOS:       docker compose -f docker/compose.dev.yml up -d; the container publishes 3200 and reaches the
#                database through host.docker.internal.
# Overrides: SMOKE_IMAGE (default ab:ci), SMOKE_SKIP_BUILD=1, SMOKE_PORT, SMOKE_DATABASE_URL.
set -eu

image=${SMOKE_IMAGE:-ab:ci}
name="ab-smoke-$$"
tmp=$(mktemp -d)

if [ "$(uname -s)" = "Linux" ]; then
  port=${SMOKE_PORT:-3000}
  db_url=${SMOKE_DATABASE_URL:-postgres://atlas:atlas@127.0.0.1:5432/atlas}
  net="--network host"
else
  port=${SMOKE_PORT:-3200}
  db_url=${SMOKE_DATABASE_URL:-postgres://atlas:atlas@host.docker.internal:5432/atlas}
  net="-p ${port}:3000"
fi
base="http://127.0.0.1:${port}"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "prod-smoke: FAILED, container logs:"
    docker logs "$name" 2>&1 | tail -50 || true
  fi
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT

step() { echo "prod-smoke: $*"; }

if [ "${SMOKE_SKIP_BUILD:-0}" != "1" ]; then
  step "building $image"
  docker build -q -f docker/Dockerfile -t "$image" .
fi

# A fresh random cookie secret per run; nothing secret is written down.
cookie_secret=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')

step "starting $image ($net)"
# shellcheck disable=SC2086 # $net is two words on purpose
docker run -d --name "$name" $net \
  -e DATABASE_URL="$db_url" \
  -e COOKIE_SECRET="$cookie_secret" \
  -e LLM_API_KEY= \
  -e NODE_ENV=production \
  "$image" >/dev/null

step "waiting for $base/api/health to report the database"
i=0
until curl -fsS "$base/api/health" 2>/dev/null | grep -q '"db":true'; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "prod-smoke: health never reported db:true"
    exit 1
  fi
  sleep 1
done
curl -fsS "$base/api/health"
echo

step "GET /api/me mints an anonymous user"
curl -fsS -D "$tmp/me.headers" -o "$tmp/me.json" "$base/api/me"
cookie=$(grep -i '^set-cookie: ab_uid=' "$tmp/me.headers" | sed 's/^[^:]*: //; s/;.*//' | tr -d '\r')
[ -n "$cookie" ] || { echo "prod-smoke: no ab_uid cookie"; exit 1; }
grep -q '"brains":\[{' "$tmp/me.json" || { echo "prod-smoke: no sample brain"; cat "$tmp/me.json"; exit 1; }
echo "ok: cookie set, sample brain listed"

step "POST /api/llm/map behind a proxy Host answers from the fallback"
code=$(curl -sS -o "$tmp/map.json" -D "$tmp/map.headers" -w '%{http_code}' -X POST \
  -H "Cookie: $cookie" \
  -H 'Host: brainstorm.example.com' \
  -H 'Origin: https://brainstorm.example.com' \
  -H 'content-type: application/json' \
  -d '{"idea":"A night market"}' \
  "$base/api/llm/map")
[ "$code" = "200" ] || { echo "prod-smoke: expected 200, got $code"; cat "$tmp/map.json"; exit 1; }
grep -q '"source":"fallback"' "$tmp/map.json" || { echo "prod-smoke: not a fallback reply"; cat "$tmp/map.json"; exit 1; }
if grep -qi '^set-cookie:' "$tmp/map.headers"; then echo "prod-smoke: the cookie was not accepted"; exit 1; fi
echo "ok: 200, source fallback, same user"

step "a cross-origin write is refused"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "Cookie: $cookie" \
  -H 'Host: brainstorm.example.com' \
  -H 'Origin: https://evil.example' \
  -H 'content-type: application/json' \
  -d '{"idea":"A night market"}' \
  "$base/api/llm/map")
[ "$code" = "403" ] || { echo "prod-smoke: expected 403, got $code"; exit 1; }
echo "ok: 403"

step "passed"
