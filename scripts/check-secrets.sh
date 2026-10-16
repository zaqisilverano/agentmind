#!/bin/sh
# Pre-commit secret scan. Reads staged changes; exits 1 and prints file:line on a hit.
# Install: sh scripts/install-hooks.sh
set -u

fail=0

# 1. Staged files named .env or .env.* (except .env.example)
for f in $(git diff --cached --name-only --diff-filter=ACMR); do
  base=$(basename "$f")
  case "$base" in
    .env.example) ;;
    .env|.env.*)
      echo "check-secrets: refusing to commit env file: $f"
      fail=1
      ;;
  esac
done

# 2. Added lines matching secret patterns
patterns='sk-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|LLM_API_KEY=[^[:space:]]+'

hits=$(git diff --cached -U0 --no-color --diff-filter=ACMR | awk '
  /^\+\+\+ / { file = substr($0, 7); if (file == "/dev/null") file = ""; next }
  /^@@ / {
    # @@ -a,b +c,d @@  -> c is the first added line
    split($0, parts, " ")
    plus = parts[3]; sub(/^\+/, "", plus); split(plus, nums, ",")
    line = nums[1] + 0
    next
  }
  /^\+/ {
    text = substr($0, 2)
    if (file != "" && file != "scripts/check-secrets.sh") print file ":" line ": " text
    line++
  }
' | grep -E -- "$patterns")

if [ -n "$hits" ]; then
  echo "check-secrets: possible secret in staged changes:"
  echo "$hits"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "check-secrets: commit blocked. Remove the secret, or bypass knowingly with --no-verify."
  exit 1
fi
exit 0
