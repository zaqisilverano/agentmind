# CLAUDE.md
agentmind (github.com/zaqisilverano/agentmind, brand written lowercase): public open-source project by Zaqi Silverano (MIT). Spec: docs/superpowers/specs/. Plan: docs/superpowers/plans/. Prototype reference: docs/reference/prototype/ (where spec and prototype disagree on visuals or behaviour, the prototype wins).

## Layout
- `app/` routes and API (`app/api/{me,brains,llm,health}`), `components/` React UI, `engine/` Three.js scene and pure layout, `lib/` store, sync, llm, agents, export, sample, brains, `db/` Drizzle schema, client, migrations, `docker/`, `scripts/`, `tests/{unit,routes,e2e}`.
- `proxy.ts` sets the per-request CSP nonce for pages; `next.config.ts` sets the static headers.

## Boundary rule
engine/, lib/llm, lib/agents, lib/export, lib/sample import nothing from react, next or db/. engine/layout.ts must not import three (it is bundled into the 3D HTML export). ESLint enforces both (`eslint.config.mjs`; type-only imports are allowed), and `pnpm lint` (`eslint .`) covers the whole repo, engine/, db/, scripts/ and tests/ included.

## Commands
- Node 24 LTS (`.nvmrc`). Package manager: pnpm 12 (version pinned in `packageManager`; settings such as `allowBuilds` live in `pnpm-workspace.yaml`, not package.json). Install with `pnpm install --frozen-lockfile`; never add a package-lock.json.
- `pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` (unit + route tests on pglite, no Postgres needed)
- `pnpm test:e2e` Playwright; starts its own server on :3100 and migrates; needs the dev Postgres (`docker compose -f docker/compose.dev.yml up -d`)
- `pnpm eval` prompt eval against the configured LLM provider (not in CI)
- `pnpm db:generate` · `pnpm db:migrate` · `pnpm build` (runs `prebuild`) · `pnpm gen:theme` · `pnpm build:export-layout`
- `sh scripts/prod-smoke.sh` builds the production image and smoke-tests it against the dev Postgres.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, build, gitleaks and the production-image smoke test. `.github/workflows/deploy.yml` then deploys main to the VPS with `scripts/deploy.sh` (secrets DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS, DEPLOY_DOMAIN).

## Generated files
`app/theme.generated.css` (from `engine/themes.ts`, `pnpm gen:theme`) and `public/export/layout.js` (from `engine/layout.ts`, `pnpm build:export-layout`) are generated. Never edit them by hand. Tests fail when the checked-in copies are stale, so regenerate and commit them after changing their sources.

## Git
Plain commit messages. No Co-Authored-By trailer, no "generated with" line. Never commit .env files.

## Agent instruction files

`CLAUDE.md` and `AGENTS.md` hold the same rules. Edit both together; `tests/unit/agents-md.test.ts` fails if they differ.
