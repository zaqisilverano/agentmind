# Contributing

Thanks for helping. This is a small project; keep changes focused and easy to review. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need Node 24 LTS (see `.nvmrc`), pnpm 12 (the exact version is pinned in `packageManager` in `package.json`; `corepack enable` picks it up, and so does a globally installed pnpm), and Docker for the dev database (Postgres 18). pnpm settings, such as the `allowBuilds` list of dependencies whose install scripts may run, live in `pnpm-workspace.yaml`.

```sh
cp .env.example .env
docker compose -f docker/compose.dev.yml up -d   # Postgres only
pnpm install
pnpm db:migrate
pnpm dev                                       # http://localhost:3000
```

With `LLM_API_KEY` empty, the app runs on the local fallback, so you can work without any provider account. Optional: `sh scripts/install-hooks.sh` installs a pre-commit hook that blocks staged secrets. It is not installed automatically.

## Branches

Branch from `main`. Use a short prefix and a slug: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`, `test/<slug>`. Example: `fix/orbit-label-overlap`.

## Before you open a PR

Run these and make sure they pass:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

If you touched `engine/themes.ts` or `engine/layout.ts`, also run `pnpm gen:theme` and `pnpm build:export-layout`, then commit the result (see "Generated files"). Run `pnpm build` if you changed anything that affects the production build.

Include screenshots or a short recording for UI changes. Add a line under `## [Unreleased]` in `CHANGELOG.md` for user-visible changes.

## Commit messages

Plain messages in the imperative mood, with an optional type prefix as in the history (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). No AI co-author trailers and no "generated with" lines. Never commit `.env` files or keys.

## Where tests live

- `tests/unit/`: pure code (engine layout, LLM schemas, fallback, runner, exporters, store, identity).
- `tests/routes/`: API routes against an in-process Postgres (pglite) with the real migrations. No Postgres install needed.
- `tests/e2e/`: Playwright smoke test. Playwright starts its own dev server on port 3100, so no dev server is needed. It needs the dev Postgres (`docker compose -f docker/compose.dev.yml up -d`).

Fix a bug with a test that fails first. New LLM reply shapes need a schema test and a check that the fallback output passes the same schema.

## Architecture rules

`engine/`, `lib/llm`, `lib/agents`, `lib/export` and `lib/sample` import nothing from React, Next or `db/`. `engine/layout.ts` must not import `three`, because it is bundled into the 3D HTML export. Keep these layers pure.

## Generated files

`app/theme.generated.css` is generated from `engine/themes.ts` by `pnpm gen:theme`. `public/export/layout.js` is generated from `engine/layout.ts` by `pnpm build:export-layout` (it also runs as `prebuild`). Do not edit either by hand. Tests fail if the checked-in copies are stale.

## Adding a theme, mode or agent

Theme:
1. Add the id to `ThemeId` in `engine/types.ts`.
2. Add a token set to `THEMES` and the id to `THEME_IDS` in `engine/themes.ts`.
3. Add the id to the allowed list in `lib/prefs.ts`.
4. Run `pnpm gen:theme` and commit `app/theme.generated.css`.

Mode (layout):
1. Add the id to `Mode` in `engine/types.ts`.
2. Implement it in `computeTargets` and the ground height in `engine/layout.ts` (plain `{x,y,z}` records, no Three), and handle it in `engine/ground.ts`.
3. Add it to `MODES` in `components/panels/Toolbar.tsx` and to the allowed list in `lib/prefs.ts`.
4. Add layout tests in `tests/unit/layout.test.ts`, then run `pnpm build:export-layout`.

Agent:
1. Add the id to `AgentId` in `engine/types.ts`.
2. Add the roster entry (colour, shape, icon and eye paths, owned kinds, brief) to `lib/agents/roster.ts`. Agents run in roster order, `round % AGENTS.length`.
3. Add a template row for the agent to `F` in `lib/llm/fallback.ts`.
4. If it needs a new body shape, add it to `SHAPES` and `makeEyes` in `engine/agentShapes.ts`.
5. Run `pnpm typecheck`; the compiler lists what is left. Update or add tests in `tests/unit/agents.test.ts` and `tests/unit/runner.test.ts`.

## Reporting bugs and security issues

Use the issue templates for bugs and feature requests. For security problems, see [SECURITY.md](SECURITY.md) and do not open a public issue.
