# CLAUDE.md
Public open-source project by Zaqi Silverano (MIT). Spec: docs/superpowers/specs/. Plan: docs/superpowers/plans/. Prototype reference: docs/reference/prototype/ (where spec and prototype disagree on visuals or behaviour, the prototype wins).

## Layout
- `app/` routes and API (`app/api/{me,brains,llm,health}`), `components/` React UI, `engine/` Three.js scene and pure layout, `lib/` store, sync, llm, agents, export, sample, brains, `db/` Drizzle schema, client, migrations, `docker/`, `scripts/`, `tests/{unit,routes,e2e}`.
- `middleware.ts` sets the per-request CSP nonce for pages; `next.config.ts` sets the static headers.

## Boundary rule
engine/, lib/llm, lib/agents, lib/export, lib/sample import nothing from react, next or db/. engine/layout.ts must not import three (it is bundled into the 3D HTML export). ESLint enforces both (`eslint.config.mjs`; type-only imports are allowed), and `npm run lint` covers engine/, db/, scripts/ and tests/ too.

## Commands
- `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` (unit + route tests on pglite, no Postgres needed)
- `npm run test:e2e` Playwright; starts its own server on :3100 and migrates; needs the dev Postgres (`docker compose -f docker/compose.dev.yml up -d`)
- `npm run eval` prompt eval against the configured LLM provider (not in CI)
- `npm run db:generate` · `npm run db:migrate` · `npm run build` (runs `prebuild`) · `npm run gen:theme` · `npm run build:export-layout`
- `sh scripts/prod-smoke.sh` builds the production image and smoke-tests it against the dev Postgres.
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, build, gitleaks and the production-image smoke test.

## Generated files
`app/theme.generated.css` (from `engine/themes.ts`, `npm run gen:theme`) and `public/export/layout.js` (from `engine/layout.ts`, `npm run build:export-layout`) are generated. Never edit them by hand. Tests fail when the checked-in copies are stale, so regenerate and commit them after changing their sources.

## Git
Plain commit messages. No Co-Authored-By trailer, no "generated with" line. Never commit .env files.
