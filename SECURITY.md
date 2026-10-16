# Security policy

## Supported versions

Only the `main` branch is supported. Fixes land on `main`.

## Reporting a vulnerability

Report privately by email to zaqisilverano@gmail.com. Please do not open a public issue for a security problem.

Include what you found, how to reproduce it, and the commit you tested. I acknowledge reports within 72 hours and will tell you when a fix is planned.

## Scope

In scope: the app in this repository, its Docker and Compose files, and its CI configuration. Out of scope: third-party services such as your LLM provider, and instances that someone else runs with their own configuration.

## Never commit secrets

`.env` files are gitignored. `scripts/check-secrets.sh` is an optional pre-commit hook (`sh scripts/install-hooks.sh`) and CI runs gitleaks. If you find a secret in the history, report it the same way.
