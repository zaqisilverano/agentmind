# Agentic Brainstorm

Type an idea. Five agents grow it into a 3D map you can orbit, edit and export.

[![CI](https://github.com/zaqisilverano/agentic-brainstorm/actions/workflows/ci.yml/badge.svg)](https://github.com/zaqisilverano/agentic-brainstorm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![Screenshot](docs/media/screenshot.png)

![Demo](docs/media/demo.gif)

(record before release: `docs/media/screenshot.png` and `docs/media/demo.gif` do not exist yet)

## What it does

**The map.** You type an idea. An LLM splits it into five or six branches, each with a few sub-ideas, and the app draws them as a 3D map in Three.js. You can orbit and zoom, switch between three layouts (Constellation, Orbit, Terrain) and three themes (Atlas, Observatory, Blueprint), click a node to read or edit it, add your own notes, expand a node, or delete it with its branches.

**The agents.** Five animated agents (Researcher, Builder, Customer, Skeptic, Strategist) take turns for 5, 10 or 20 rounds. Each round one agent picks a thin spot, walks to it, adds sub-ideas, and may draw a link between two branches. At the end the Strategist writes a Key takeaway and the map highlights the strongest path from the idea to one leaf.

**Persistence.** Every brain is saved in Postgres under an anonymous signed cookie. There are no accounts. Returning visitors see their own brains again, and a "Your ID" line with a Restore ID field lets you recover them on another browser. You can download a brain as Markdown, JSON or a standalone 3D HTML file.

Without an LLM API key the app still works: it falls back to a local keyword parser and template ideas, so you can try everything offline.

Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, three, Zustand, Zod, Drizzle with Postgres 16, Vitest with pglite, Playwright, Docker Compose with Caddy. Node 22.

## Quick start

Requirements: Node 22, npm, Docker.

```sh
cp .env.example .env
docker compose -f docker/compose.dev.yml up -d   # Postgres only
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000. With `LLM_API_KEY` empty you get the offline fallback.

Optional: `sh scripts/install-hooks.sh` installs a pre-commit hook that blocks staged secrets. It is manual on purpose.

## Configuration

Copy `.env.example` to `.env`. The environment is validated on first use; the container exits at the migrate step if it is invalid.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://atlas:atlas@localhost:5432/atlas` | Postgres connection string. Under `docker/compose.yml` use the service name: `postgres://atlas:atlas@db:5432/atlas`. |
| `COOKIE_SECRET` | example value in `.env.example` | Signs the `ab_uid` cookie. At least 32 characters. The app refuses the example value in production. Generate one with `openssl rand -hex 32`. |
| `LLM_BASE_URL` | `https://api.ifm.ai/v1` | Any OpenAI-compatible endpoint. The app calls `<LLM_BASE_URL>/chat/completions`. |
| `LLM_MODEL` | `IFM/K2-Horizon-375B-A23B` | Model id sent to the endpoint. |
| `LLM_API_KEY` | empty | Bearer token for the provider. Empty means the offline fallback. |
| `LLM_REASONING_EFFORT` | unset | Optional: `low`, `medium` or `high`. Sent as `chat_template_kwargs.reasoning_effort` only when set. |
| `RATE_LIMIT_PER_HOUR` | `60` | LLM requests per hour, applied per user and per client IP. Kept in process memory. |
| `DOMAIN` | `brainstorm.example.com` | Production only. Public host name that Caddy serves and gets a TLS certificate for. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `atlas`, `atlas`, `atlas` | Production only. Credentials for the Postgres container in `docker/compose.yml`. Not in `.env.example`; set them in `.env` if you change them, and keep `DATABASE_URL` in step. |

## Run with K2 Horizon

Create an API key at https://platform.ifm.ai and use the model id as listed there.

```sh
LLM_BASE_URL=https://api.ifm.ai/v1
LLM_MODEL=IFM/K2-Horizon-375B-A23B
```

Then set `LLM_API_KEY` in `.env` to your key.

## Run with Ollama

```sh
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=<your model>
```

Set `LLM_API_KEY` to any non-empty value, for example `ollama`. Ollama ignores it, but an empty key makes the app use the offline fallback. The model has to follow JSON instructions well; replies that fail validation are retried once, then replaced by the fallback. Run `npm run eval` to see how a model does.

## How it works

```
 browser                                     server
 ───────                                     ──────
 idea text ──► POST /api/llm/map ──► LLM (or local fallback)
                                      │
                         Zod validate; retry once; else fallback
                                      │
 store (Zustand) ◄────────────────────┘
      │
      └──► POST /api/brains ──► Postgres (Drizzle)

 agent run: runner ──► scene events ──► Three.js scene
                │       plan · travel · think · spawn · link · done
                └──► POST /api/brains/:id/rounds   (once per round)
```

- **Create a brain.** The idea goes to `POST /api/llm/map`. The reply is validated with Zod. On failure the route retries once, then returns the local fallback. The result goes into the store first, then to `POST /api/brains`, which saves it in Postgres.
- **Run agents.** The runner picks an agent and a target node, then emits scene events (plan, travel, think, spawn, link, done). The scene animates them. Each round is saved with `POST /api/brains/:id/rounds` in one transaction. If a save fails, the run pauses and the UI shows "Not saved · Retry".
- **Identity.** An anonymous signed httpOnly cookie, `ab_uid`. The left panel shows "Your ID" and a Restore ID field. There are no accounts.

LLM routes do not touch the database. All mutations apply to the client store first, then sync to the API.

## Project structure

```
app/             Next.js App Router: page, layout, API routes
  api/me/        identity, restore
  api/brains/    brains, nodes, links, rounds, takeaway
  api/llm/       map, expand, agent-round, takeaway
  api/health/    health check
components/      React UI: atlas canvas, panels, small UI parts
engine/          Three.js scene, layout, nodes, agents, labels, themes (no React)
lib/
  llm/           provider client, prompts, Zod schemas, offline fallback
  agents/        roster, runner, target picking
  export/        Markdown, JSON and 3D HTML exporters
  sample/        the sample "Tool Library" brain
  brains/        database access for brains
  store.ts, sync.ts, controller.ts   client state and sync
  identity.ts, rateLimit.ts, env.ts, securityHeaders.ts
db/              Drizzle schema, client, migrations, migrate script
docker/          Dockerfile, compose.yml (production), compose.dev.yml (Postgres only), Caddyfile
scripts/         theme and export bundlers, eval, secrets hook
tests/           unit/ and routes/ (Vitest), e2e/ (Playwright)
docs/            design spec, plan, prototype reference
middleware.ts    per-request CSP nonce
```

`engine/`, `lib/llm`, `lib/agents`, `lib/export` and `lib/sample` import nothing from React, Next or `db/`. `app/theme.generated.css` and `public/export/layout.js` are generated; do not edit them by hand.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on port 3000. |
| `npm run build` | Production build. Runs `prebuild` first, which writes `public/export/layout.js`. |
| `npm start` | Serves the production build. |
| `npm run lint` | ESLint via `next lint`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Vitest, once. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:e2e` | Playwright tests. |
| `npm run db:generate` | Generate a Drizzle migration from `db/schema.ts`. |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL`. |
| `npm run gen:theme` | Regenerate `app/theme.generated.css` from `engine/themes.ts`. |
| `npm run build:export-layout` | Regenerate `public/export/layout.js` from `engine/layout.ts`. |
| `npm run build:migrate` | Bundle the migrator into `.next/standalone/db/` (used by the Dockerfile). |
| `npm run eval` | Run the prompt eval against the configured provider. |

## Testing

- `npm test`: unit and route tests. Routes run on pglite (in-process Postgres with the real migrations), so no database is needed.
- `npm run test:e2e`: Playwright. Starts its own dev server on port 3100 (no dev server needed, port 3000 can stay in use) and applies the migrations itself. Needs the dev Postgres: `docker compose -f docker/compose.dev.yml up -d`.
- `npm run eval`: sends the prompts in `scripts/eval-prompts.json` to the configured provider and prints source, attempts and latency per call. It reads `.env` and is not part of CI.
- `sh scripts/prod-smoke.sh`: builds the production Docker image, runs it against the dev Postgres (published on port 3200 on macOS) and checks health, the anonymous cookie and one write behind a proxy-style `Host` header.

CI runs lint, typecheck, `npm test`, `npm run build` and gitleaks on every push and pull request, and the same production-image smoke test against a Postgres 16 service.

## Deployment

The production stack is Docker Compose: the app, Postgres 16 and Caddy.

```sh
cp .env.example .env
# edit .env: set COOKIE_SECRET, DOMAIN, LLM_*, and DATABASE_URL=postgres://atlas:atlas@db:5432/atlas
docker compose --env-file .env -f docker/compose.yml up -d --build
```

- Pass `--env-file .env`. Compose reads `${DOMAIN}` and the Postgres variables from it for interpolation.
- Caddy listens on ports 80 and 443 and gets a TLS certificate for `DOMAIN`. Point the domain's DNS at the server first.
- Migrations run when the app container starts, under a Postgres advisory lock.
- `DATABASE_URL` must use the service name `db`, not `localhost`.
- Caddy overwrites `X-Forwarded-For`, and the rate limiter trusts the first value. If you put another proxy in front, make sure it does the same.
- Caddy forwards the `Host` (and `X-Forwarded-Host`) the browser used. Write requests must carry an `Origin` whose host matches it, so another proxy in front must pass the original host through too.
- Caddy refuses request bodies over 300 KB; the app caps JSON bodies at 256 KB.
- Limits for anonymous users: new sessions per client IP per hour are half of the `RATE_LIMIT_PER_HOUR` setting (at least 10), each user can keep 100 brains, and a brain holds up to 300 nodes.
- The rate limiter lives in process memory, so run a single app instance.

Backup:

```sh
docker compose --env-file .env -f docker/compose.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

Pass `--env-file .env` on every compose command for this stack. The command reads the Postgres user and database from the container's own environment, and `-T` keeps the dump free of terminal control characters.

## Privacy

There are no accounts and no analytics. The app sets one cookie, `ab_uid`, which holds a random id signed with `COOKIE_SECRET`.

Stored on the server: your brains (title, summary, nodes, notes, links, agent log), your anonymous id, and a last-seen timestamp. Preferences (layout, theme, rounds, panel visibility) and a copy of your id for display stay in your browser's `localStorage`.

Sent to the LLM provider you configure: the idea text, and node names and notes where the prompt needs them (expanding a node, agent rounds, the takeaway). With no `LLM_API_KEY`, nothing is sent anywhere.

Treat your anonymous ID like a password. It is a bearer credential: anyone who has it can open your brains with Restore ID.

Deleting data:
- Delete a node and its branches from the node card.
- Delete a whole brain from the Second brain menu → Delete this brain (click twice to confirm). It removes the brain with its nodes, notes, links and agent log from the database.
- Clearing the cookie and `localStorage` cuts the link between you and your data, but does not remove it from the database. Note your ID first if you want to come back.
- To purge everything stored under your id, email zaqisilverano@gmail.com with the id.

If you run your own instance, you are the operator of that data.

## Security

- Content Security Policy with a per-request nonce on pages (`middleware.ts`), and a strict static CSP on API routes. Also `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and a restrictive `Permissions-Policy`.
- Rate limits on LLM routes, per user and per IP.
- JSON bodies are capped at 256 KB and validated with Zod.
- JSON POST routes require `application/json` and reject a cross-origin `Origin` header.
- The cookie is signed with HMAC-SHA256, httpOnly, SameSite=Lax, and Secure in production. The anonymous ID itself is a bearer credential (Restore ID accepts it without further proof), so keep it private.
- `scripts/check-secrets.sh` is an optional pre-commit hook, and CI runs gitleaks.

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Roadmap

Not in v0.1:

- Accounts and email
- Sharing brains by URL
- Multi-model comparison
- Streaming partial JSON
- Mobile layout below 900 px width (the minimum supported viewport is 900×540)
- Internationalisation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE), copyright 2026 Zaqi Silverano.
