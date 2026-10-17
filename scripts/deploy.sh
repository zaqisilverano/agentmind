#!/usr/bin/env bash
# Runs on the server, piped over SSH by .github/workflows/deploy.yml:
#   ssh user@host 'bash -s -- <commit>' < scripts/deploy.sh
# Without an argument it deploys origin/main. Expects ~/apps/agentmind to be a clone with an `origin` remote on
# GitHub and a production .env, and an existing reverse proxy (docker/compose.proxy.yml).
set -euo pipefail

ref=${1:-origin/main}
cd ~/apps/agentmind

git fetch --all -q
git reset -q --hard "$ref"
echo "deploy: at $(git log -1 --format='%h %s')"

# The server's snap Docker cannot do BuildKit registry lookups; the base images are preloaded, so use the classic builder.
export DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0
docker compose --env-file .env -f docker/compose.yml -f docker/compose.proxy.yml up -d --build

echo "deploy: waiting up to 90 s for agentmind to be healthy"
status=unknown
for _ in $(seq 1 45); do
  status=$(docker inspect --format '{{.State.Health.Status}}' agentmind 2>/dev/null || echo missing)
  [ "$status" = healthy ] && break
  sleep 2
done
docker ps --filter 'name=^agentmind$'
if [ "$status" != healthy ]; then
  echo "deploy: agentmind is $status after 90 s"
  docker logs --tail 50 agentmind || true
  exit 1
fi

docker image prune -f
echo "deploy: done"
