<div align="center">

<img src="docs/media/hero.png" width="100%" alt="agentmind — A team of agents for every idea. Type an idea. Five agents grow it into a 3D map you can orbit, edit and export.">

<br><br>

**[Try it live](https://agentmind.zaqi.build)** · **[Quick start](#quick-start)** · **[Agents](#meet-the-agents)** · **[Configuration](#configuration)** · **[How it works](#how-it-works)** · **[Deployment](#deployment)** · **[Privacy](#privacy)**

<br>

[![CI](https://github.com/zaqisilverano/agentmind/actions/workflows/ci.yml/badge.svg)](https://github.com/zaqisilverano/agentmind/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-1B1A17.svg)](LICENSE)
![Node 24](https://img.shields.io/badge/node-24-00C46A.svg)
![Next.js 16](https://img.shields.io/badge/Next.js-16-1B1A17.svg)
![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6.svg)
![three.js](https://img.shields.io/badge/three.js-r186-1E7BFF.svg)
![Postgres 18](https://img.shields.io/badge/Postgres-18-8B5CF6.svg)

<br>

![Screenshot](docs/media/screenshot.png)

</div>

## What it does

Type an idea and press **Run agents**. agentmind breaks it into a 3D map of branches and sub-ideas, then five agents (Researcher, Builder, Customer, Skeptic and Strategist) take turns growing it: each picks a thin spot, adds ideas and links related branches, and the Strategist closes with a key takeaway and the strongest path. Orbit the map in three layouts and three themes, click any node to read it, add your own notes or let the agents expand just that branch, then download it as Markdown, JSON or a standalone 3D page. It runs on K2 Horizon by default or any OpenAI-compatible model, saves your brains under an anonymous ID with no account, works on phones, and still runs offline without an API key.

## Meet the agents

| | Agent | Shape | Works on |
|:-:|---|---|---|
| <img src="docs/media/agent-researcher.svg" width="32"> | **Researcher** | Blue hexagon | Problem and People branches |
| <img src="docs/media/agent-builder.svg" width="32"> | **Builder** | Green rounded square | Mechanism |
| <img src="docs/media/agent-customer.svg" width="32"> | **Customer** | Orange flower | Value |
| <img src="docs/media/agent-skeptic.svg" width="32"> | **Skeptic** | Black ghost | Risk |
| <img src="docs/media/agent-strategist.svg" width="32"> | **Strategist** | Purple star | Next step and the Key takeaway |

Each round: **plan → travel → think → spawn → link → done**.

<img src="docs/media/demo.gif" width="100%" alt="agentmind demo: type an idea, press Run agents, five agents grow a 3D map, switch views and themes, export">

## Views and themes

| Layouts | Themes |
|---|---|
| **Constellation**: branches as stars on a sphere | **Atlas**: paper, ink, red accent |
| **Orbit**: each branch circles the core idea | **Observatory**: night sky, amber accent |
| **Terrain**: branches rise as peaks on a landscape | **Blueprint**: cobalt, yellow accent |

## Stack

Next.js 16 (App Router, Turbopack), React 19.3, TypeScript 6, Tailwind v4, three r186, Zustand, Zod, Drizzle with Postgres 18, ESLint 9, Vitest with pglite, Playwright, Docker Compose with Caddy 2.11. Node 24 LTS, pnpm 12.

ESLint stays on 9 until eslint-plugin-react, eslint-plugin-import and eslint-plugin-jsx-a11y support ESLint 10, and TypeScript stays on 6.0 until typescript-eslint supports TypeScript 7.

## Quick start

Requirements: Node 24, pnpm 12 (the exact version is pinned in `packageManager`), Docker.

```sh
cp .env.example .env
docker compose -f docker/compose.dev.yml up -d   # Postgres only
pnpm install
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000. The first visit starts with an empty map; type an idea and press Enter to map your first brain. With `LLM_API_KEY` empty you get the offline fallback.

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
| `UMAMI_SCRIPT_URL` | empty | Optional. URL of the tracker script on your own [Umami](https://umami.is) server, for example `https://stats.example.com/script.js`. Must be https in production. Set it together with `UMAMI_WEBSITE_ID`, or leave both empty for no analytics: no script, no CSP change, no network calls. When set, page CSP `connect-src` also allows the script's origin, where the tracker posts events. See [Privacy](#privacy). |
| `UMAMI_WEBSITE_ID` | empty | Optional. The website's UUID from the Umami dashboard, sent as `data-website-id`. |
| `DOMAIN` | `agentmind.zaqi.build` | Production only. Public host name that Caddy serves and gets a TLS certificate for. With Umami configured, a plain host name here is also sent as `data-domains`, so only visits to that host are counted. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `atlas`, `atlas`, `atlas` | Production only. Credentials for the Postgres container in `docker/compose.yml`. Not in `.env.example`; set them in `.env` if you change them, and keep `DATABASE_URL` in step. |

<details>
<summary><b>Run with K2 Horizon</b></summary>



Create an API key at https://platform.ifm.ai and use the model id as listed there.

```sh
LLM_BASE_URL=https://api.ifm.ai/v1
LLM_MODEL=IFM/K2-Horizon-375B-A23B
```

Then set `LLM_API_KEY` in `.env` to your key.

</details>

<details>
<summary><b>Run with Ollama</b></summary>



```sh
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=<your model>
```

Set `LLM_API_KEY` to any non-empty value, for example `ollama`. Ollama ignores it, but an empty key makes the app use the offline fallback. The model has to follow JSON instructions well; replies that fail validation are retried once, then replaced by the fallback. Run `pnpm eval` to see how a model does.

</details>

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
  sample/        the "Tool Library" sample brain (tests and dev pages only)
  brains/        database access for brains
  store.ts, sync.ts, controller.ts   client state and sync
  identity.ts, rateLimit.ts, env.ts, securityHeaders.ts
db/              Drizzle schema, client, migrations, migrate script
docker/          Dockerfile, compose.yml (production), compose.dev.yml (Postgres only), Caddyfile
scripts/         theme and export bundlers, eval, secrets hook, prod smoke test, deploy
tests/           unit/ and routes/ (Vitest), e2e/ (Playwright)
docs/            design spec, plan, prototype reference
proxy.ts         per-request CSP nonce (Next.js proxy, formerly middleware)
```

`engine/`, `lib/llm`, `lib/agents`, `lib/export` and `lib/sample` import nothing from React, Next or `db/`. `app/theme.generated.css` and `public/export/layout.js` are generated; do not edit them by hand.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server on port 3000. |
| `pnpm build` | Production build. Runs `prebuild` first, which writes `public/export/layout.js`. |
| `pnpm start` | Serves the production build. |
| `pnpm lint` | ESLint over the whole repository (`eslint .`). |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm test` | Vitest, once. |
| `pnpm test:watch` | Vitest in watch mode. |
| `pnpm test:e2e` | Playwright tests. |
| `pnpm db:generate` | Generate a Drizzle migration from `db/schema.ts`. |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL`. |
| `pnpm gen:theme` | Regenerate `app/theme.generated.css` from `engine/themes.ts`. |
| `pnpm build:export-layout` | Regenerate `public/export/layout.js` from `engine/layout.ts`. |
| `pnpm build:migrate` | Bundle the migrator into `.next/standalone/db/` (used by the Dockerfile). |
| `pnpm eval` | Run the prompt eval against the configured provider. |

## Testing

- `pnpm test`: unit and route tests. Routes run on pglite (in-process Postgres with the real migrations), so no database is needed.
- `pnpm test:e2e`: Playwright. Starts its own dev server on port 3100 (no dev server needed, port 3000 can stay in use) and applies the migrations itself. Needs the dev Postgres: `docker compose -f docker/compose.dev.yml up -d`.
- `pnpm eval`: sends the prompts in `scripts/eval-prompts.json` to the configured provider and prints source, attempts and latency per call. It reads `.env` and is not part of CI.
- `sh scripts/prod-smoke.sh`: builds the production Docker image, runs it against the dev Postgres (published on port 3200 on macOS) and checks health, the anonymous cookie and one write behind a proxy-style `Host` header.

CI runs lint, typecheck, `pnpm test`, `pnpm build` and gitleaks on every push and pull request, and the same production-image smoke test against a Postgres 18 service. A green CI run on `main` triggers the deploy workflow (see [Continuous deployment](#continuous-deployment)).

## Deployment

The production stack is Docker Compose: the app, Postgres 18 and Caddy. The server needs Docker Engine with the Compose plugin.

```sh
cp .env.example .env
# edit .env: set COOKIE_SECRET, DOMAIN, LLM_*, and DATABASE_URL=postgres://atlas:atlas@db:5432/atlas
docker compose --env-file .env -f docker/compose.yml up -d --build
```

- Pass `--env-file .env`. Compose reads `${DOMAIN}` and the Postgres variables from it for interpolation.
- The Compose project is named `agentmind`, so the containers are `agentmind-app-1`, `agentmind-db-1` and `agentmind-caddy-1`, and the database volume is `agentmind_ab_pg18` (mounted at `/var/lib/postgresql`, the layout the Postgres 18 image expects). The Postgres 16 volume `agentmind_ab_pg` is no longer used.
- Caddy listens on ports 80 and 443 and gets a TLS certificate for `DOMAIN`. Point the domain's DNS at the server first.
- Migrations run when the app container starts, under a Postgres advisory lock.
- `DATABASE_URL` must use the service name `db`, not `localhost`.
- Caddy overwrites `X-Forwarded-For`, and the rate limiter trusts the first value. If you put another proxy in front, make sure it does the same.
- Caddy forwards the `Host` (and `X-Forwarded-Host`) the browser used. Write requests must carry an `Origin` whose host matches it, so another proxy in front must pass the original host through too.
- Caddy refuses request bodies over 300 KB; the app caps JSON bodies at 256 KB.
- Limits for anonymous users: new sessions per client IP per hour are half of the `RATE_LIMIT_PER_HOUR` setting (at least 10), each user can keep 100 brains, and a brain holds up to 300 nodes.
- The rate limiter lives in process memory, so run a single app instance.

Behind an existing reverse proxy, skip the bundled Caddy and attach the app to the proxy's Docker network instead. Set `PROXY_NETWORK` in `.env` to that network's name, then:

```sh
docker compose --env-file .env -f docker/compose.yml -f docker/compose.proxy.yml up -d --build
```

The app container is then named `agentmind` and the proxy reaches it at `http://agentmind:3000`. The proxy must forward `Host` and `X-Forwarded-Host`, set `X-Forwarded-Proto`, and set `X-Forwarded-For` to the real client IP.

Backup:

```sh
install -d -m 700 ~/backups
(umask 077; docker compose --env-file .env -f docker/compose.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > ~/backups/agentmind-$(date +%F).sql)
```

Keep dumps outside the clone (`*.sql` and `backups/` are also in `.gitignore` and `.dockerignore`). Pass `--env-file .env` on every compose command for this stack. The command reads the Postgres user and database from the container's own environment, and `-T` keeps the dump free of terminal control characters.

### Continuous deployment

`.github/workflows/deploy.yml` deploys to the VPS after every green CI run on a push to `main`. It installs an SSH key, pipes `scripts/deploy.sh` to the server over SSH with the commit CI tested, then checks `https://<DEPLOY_DOMAIN>/api/health` for `"db":true`. Deploys run one at a time. On the server, `scripts/deploy.sh` resets `~/apps/agentmind` (a clone with an `origin` remote on GitHub and a production `.env`) to that commit, rebuilds and restarts the stack with `docker/compose.yml` and `docker/compose.proxy.yml`, waits up to 90 s for the `agentmind` container to report healthy, and prunes dangling images.

The workflow needs these repository secrets:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | Server host name or IP for SSH. |
| `DEPLOY_USER` | SSH user that owns `~/apps/agentmind` and can run `docker`. |
| `DEPLOY_SSH_KEY` | Private key (ed25519) whose public key is in that user's `authorized_keys`. |
| `DEPLOY_KNOWN_HOSTS` | The server's host key line(s), for example from `ssh-keyscan -t ed25519 <host>`. Check the fingerprint. |
| `DEPLOY_DOMAIN` | Public host name for the health check, for example `agentmind.zaqi.build`. |

> [!IMPORTANT]
> First deploy on a server that ran the old `agentic-brainstorm` stack: stop the old compose project (`docker compose -p docker … down`), point your reverse proxy at `agentmind:3000`, make sure `~/apps/agentmind` is a clone with an `origin` remote on GitHub, and copy the Postgres volume from `docker_ab_pg` to `agentmind_ab_pg` if you want to keep existing brains.

#### Moving from Postgres 16 to 18

Postgres 18 uses a new volume, `agentmind_ab_pg18`, and the old `agentmind_ab_pg` is left alone. A normal deploy would start the app on the new, empty database, and the migrator would create the schema there, so a restore afterwards would conflict. Move the data by hand, with deploys paused:

1. On your machine, pause deploys, then push:

   ```sh
   gh workflow disable Deploy
   git push
   ```

2. On the server, in `~/apps/agentmind` (still on the old commit, Postgres 16 running), stop the app so nothing is written after the dump, then dump the old database outside the clone:

   ```sh
   cd ~/apps/agentmind
   docker compose --env-file .env -f docker/compose.yml -f docker/compose.proxy.yml stop app
   install -d -m 700 ~/backups
   (umask 077; docker compose --env-file .env -f docker/compose.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > ~/backups/agentmind-pg16.sql)
   chmod 600 ~/backups/agentmind-pg16.sql
   ```

3. Update the checkout, start only the new `db` service and restore into it:

   ```sh
   git fetch -q && git reset -q --hard origin/main
   docker compose --env-file .env -f docker/compose.yml -f docker/compose.proxy.yml up -d --wait db
   docker compose --env-file .env -f docker/compose.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' < ~/backups/agentmind-pg16.sql
   docker compose --env-file .env -f docker/compose.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB" -tAc "select count(*) from brains"'
   ```

   The commands read the Postgres user and database from the container's environment (set from `.env`), so no password goes on a command line. Compare the count with the old database before going on.

4. Deploy and check health:

   ```sh
   bash scripts/deploy.sh origin/main
   curl -fsS https://<DOMAIN>/api/health   # expect "db":true
   ```

5. On your machine, turn deploys back on: `gh workflow enable Deploy`.

To roll back, check out the previous commit and run `up -d --build`: the app goes back to `agentmind_ab_pg` as it was at the dump. Anything written after the cutover exists only in the Postgres 18 volume and is lost in a rollback.

## Privacy

There are no accounts. The app sets one cookie, `ab_uid`, which holds a random id signed with `COOKIE_SECRET`.

Analytics: when the operator configures [Umami](https://umami.is) (`UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID`; the public instance at agentmind.zaqi.build does), page views and four events are counted with Umami, a self-hosted, cookie-less analytics tool. The events carry only fixed labels and counts:
- `map`: a new brain was mapped, with `source` (`model` or `fallback`) and `nodes` (how many).
- `run`: a full agent run started, with `rounds`.
- `expand`: a scoped run started from a node, with `rounds` and `focus` (`yes` or `no`, never the focus text).
- `download`: an export was saved, with `format` (`markdown`, `json` or `html3d`).

Umami sets no cookies and stores no personal data: it does not keep IP addresses, only the page, the referrer, and the browser, OS, device type and country of a visit. No idea text, node names, notes, your anonymous id or anything else you type is sent. Browsers with Do Not Track turned on are not counted. The stats live on the operator's own Umami server, not with a third party. With both settings empty (the default) the app loads no tracker and makes no analytics calls.

Stored on the server: your brains (title, summary, nodes, notes, links, agent log), your anonymous id, and a last-seen timestamp. A first visit stores only the anonymous id; no brain or sample data is stored until you map an idea. Preferences (layout, theme, rounds, panel visibility) and a copy of your id for display stay in your browser's `localStorage`.

Sent to the LLM provider you configure: the idea text, and node names and notes where the prompt needs them (expanding a node, agent rounds, the takeaway). With no `LLM_API_KEY`, nothing is sent anywhere.

Treat your anonymous ID like a password. It is a bearer credential: anyone who has it can open your brains with Restore ID.

Deleting data:
- Delete a node and its branches from the node card.
- Delete a whole brain from the Second brain menu → Delete this brain (click twice to confirm). It removes the brain with its nodes, notes, links and agent log from the database.
- Clearing the cookie and `localStorage` cuts the link between you and your data, but does not remove it from the database. Note your ID first if you want to come back.
- To purge everything stored under your id, email zaqisilverano@gmail.com with the id.

If you run your own instance, you are the operator of that data.

## Security

- Content Security Policy with a per-request nonce on pages (`proxy.ts`), and a strict static CSP on API routes. With Umami configured, the page policy adds only the tracker's origin to `connect-src`; the tracker script carries the nonce. Also `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and a restrictive `Permissions-Policy`.
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
- Internationalisation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE), copyright 2026 Zaqi Silverano.

<div align="center">
<br>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/mark-dark.svg">
  <img src="docs/media/mark-light.svg" width="28" alt="">
</picture>
<br>
<sub>agent<i>mind</i> · your second brain, mapped</sub>
</div>
