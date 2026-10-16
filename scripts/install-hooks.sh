#!/bin/sh
# Symlink scripts/check-secrets.sh as the git pre-commit hook. Safe to re-run.
set -eu
root=$(git rev-parse --show-toplevel)
hooks=$(git rev-parse --git-path hooks)
mkdir -p "$hooks"
chmod +x "$root/scripts/check-secrets.sh"
ln -sf "$root/scripts/check-secrets.sh" "$hooks/pre-commit"
echo "installed pre-commit hook -> scripts/check-secrets.sh"
