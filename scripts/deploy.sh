#!/usr/bin/env bash
# Runs on the server, piped over SSH by .github/workflows/deploy.yml:
#   ssh user@host 'bash -s -- <commit>' < scripts/deploy.sh
# Without an argument it deploys origin/main. Expects ~/apps/agentmind to be a clone with an `origin` remote on
# GitHub and a production .env, and an existing reverse proxy (docker/compose.proxy.yml).
set -euo pipefail

# The whole script is a function so bash parses it completely before running anything: when piped over
# `bash -s`, a child that reads stdin (docker, git) could otherwise swallow the rest of the script.

main() {
  ref=${1:-origin/main}
  cd ~/apps/agentmind

  git fetch --all -q </dev/null
  git reset -q --hard "$ref"
  echo "deploy: at $(git log -1 --format='%h %s')"

  docker compose --env-file .env -f docker/compose.yml -f docker/compose.proxy.yml up -d --build </dev/null

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
    docker logs --tail 50 agentmind </dev/null || true
    exit 1
  fi

  docker image prune -f </dev/null
  echo "deploy: done"
}

main "$@"
