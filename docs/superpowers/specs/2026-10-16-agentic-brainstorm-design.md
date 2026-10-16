# Agentic Brainstorm — Design Spec

Date: 2026-10-16. Status: approved by Zaqi Silverano in brainstorming; implementation follows the plan in `docs/superpowers/plans/`.

## 1. Goal

A public, open-source web app. The user types an idea. An LLM breaks it into a tree of branches and sub-ideas rendered as a 3D map in Three.js. A team of five animated agents then works on the map in rounds, growing weak spots and linking branches, and ends with a Key takeaway and a highlighted strongest path. Every brain is saved on the server under an anonymous cookie identity, so returning visitors see their own brains again.

The visual design, interaction details and agent behaviour are fixed by the prototype in `docs/reference/prototype/`. This spec defines the production architecture that implements them. Where this spec and the prototype disagree on visuals or behaviour, the prototype wins.

## 2. Stack

- Next.js 15, App Router, TypeScript strict, React 19.
- Tailwind CSS v4 with CSS variables for theme tokens.
- Three.js (current release) with `OrbitControls` from `three/examples/jsm`.
- Zustand for client state.
- Zod for every contract (API bodies, LLM replies, env).
- Drizzle ORM with `postgres` driver; Postgres 16.
- Vitest for unit and route tests, `@electric-sql/pglite` for in-process Postgres in tests, Playwright for the smoke test.
- Docker Compose for production on the OVH VPS; Caddy for HTTPS.
- Package manager: npm. Node 22 LTS in the Dockerfile.

## 3. Project structure

```
agentic-brainstorm/
  app/
    layout.tsx            html[data-theme], fonts, ThemeProvider, store hydration
    page.tsx              the single screen: <Atlas/> + panels
    globals.css           Tailwind import, theme token tables
    api/
      me/route.ts
      me/restore/route.ts
      health/route.ts
      brains/route.ts
      brains/[id]/route.ts
      brains/[id]/nodes/route.ts
      brains/[id]/links/route.ts
      brains/[id]/rounds/route.ts
      brains/[id]/takeaway/route.ts
      llm/map/route.ts
      llm/expand/route.ts
      llm/agent-round/route.ts
      llm/takeaway/route.ts
  components/
    atlas/Atlas.tsx
    panels/LeftPanel.tsx, BrainDropdown.tsx, TakeawayCard.tsx, AgentTeam.tsx, Legend.tsx, IdentityLine.tsx
    panels/Toolbar.tsx, NodeCard.tsx, AgentLog.tsx, InputBar.tsx, FocusExit.tsx, Hint.tsx
    ui/Panel.tsx, Button.tsx, Pill.tsx, Dropdown.tsx, Textarea.tsx, TwoStepDelete.tsx, AgentIcon.tsx
  engine/
    AtlasScene.ts, layout.ts, nodes.ts, agents.ts, labels.ts, themes.ts, ground.ts, types.ts
  lib/
    store.ts, sync.ts, identity.ts, rateLimit.ts, env.ts, ids.ts
    llm/provider.ts, prompts.ts, schemas.ts, fallback.ts, extractJson.ts
    agents/roster.ts, runner.ts, pickTarget.ts
    export/markdown.ts, json.ts, html3d.ts
    sample/toolLibrary.ts
  db/
    schema.ts, client.ts, migrate.ts, migrations/
  docker/
    Dockerfile, compose.yml, compose.dev.yml, Caddyfile
  scripts/
    check-secrets.sh, eval.ts
  tests/
    unit/..., routes/..., e2e/...
  docs/
    reference/prototype/..., superpowers/specs/..., superpowers/plans/...
  .github/workflows/ci.yml, ISSUE_TEMPLATE/, PULL_REQUEST_TEMPLATE.md
  README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, CHANGELOG.md, LICENSE, CLAUDE.md, .env.example
```

Boundary rule: `engine/`, `lib/llm`, `lib/agents`, `lib/export`, `lib/sample` import nothing from React, Next or the database. They are pure TypeScript and are unit-tested in isolation. `engine/layout.ts` is also bundled into the 3D HTML export, so it must not import Three (it works on plain `{x,y,z}` records).

## 4. Data model

### 4.1 Domain types (`engine/types.ts`)

```ts
export type Kind = 'Core' | 'Problem' | 'People' | 'Mechanism' | 'Value' | 'Risk' | 'Next step';
export type AgentId = 'researcher' | 'builder' | 'customer' | 'skeptic' | 'strategist';
export type Mode = 'constellation' | 'orbit' | 'terrain';
export type ThemeId = 'atlas' | 'observatory' | 'blueprint';

export interface IdeaNode { id: string; name: string; note: string; userNote: string; kind: Kind; parent: string | null; depth: number; color: string; by: AgentId | null; critic: boolean; position: number; }
export interface CrossLink { a: string; b: string; why: string; by: AgentId; }
export interface LogEntry { seq: number; agent: AgentId; text: string; node: string; tag: string; }
export interface Takeaway { path: string[]; verdict: string; brief: string; }
export interface Brain { id: string; number: number; title: string; summary: string; round: number; synth: Takeaway | null; nodes: IdeaNode[]; links: CrossLink[]; log: LogEntry[]; createdAt: string; updatedAt: string; }
```

Node ids keep the prototype scheme: root `n0`, branches `b0`…`b5`, generated children `<parentId>x<base36 stamp><index>`. Depth-1 nodes are branches; deeper nodes inherit their branch's `kind` and `color`. Kind colours: Problem `#E0482B`, People `#2F5BD8`, Mechanism `#3E8E5A`, Value `#D49A1E`, Risk `#9B3FB5`, Next step `#1A8C8C`. The core's colour is the theme ink.

### 4.2 Tables (`db/schema.ts`)

| Table | Columns | Keys |
|---|---|---|
| `users` | id uuid, created_at, last_seen_at | pk id |
| `brains` | id uuid, user_id, number int, title, summary, round int default 0, synth jsonb null, created_at, updated_at | pk id; unique (user_id, number); index user_id |
| `nodes` | brain_id, id text, name, note, user_note default '', kind, parent_id text null, depth int, color, by text null, critic bool default false, position int | pk (brain_id, id); index (brain_id, parent_id) |
| `links` | brain_id, a, b, why, by | pk (brain_id, a, b) |
| `log_entries` | brain_id, seq int, agent, text, node_id, tag | pk (brain_id, seq) |

`brains.number` is assigned on insert as `max(number)+1` for that user inside a transaction. Deleting a brain cascades. All reads and writes are scoped by `user_id` from the cookie.

## 5. Identity

Anonymous only. No accounts in v1.

- Cookie name `ab_uid`. Value `<uuid>.<hmac-sha256 hex>` signed with `COOKIE_SECRET`. Flags: httpOnly, SameSite=Lax, Path=/, Max-Age 1 year, Secure when `NODE_ENV=production`.
- `lib/identity.ts` exports `sign(uuid)`, `verify(value) → uuid | null`, and `requireUser(req) → { userId, setCookie?: string }`. A missing or invalid cookie creates a new `users` row and returns a `Set-Cookie` header for the route to attach. Every API route uses `requireUser`.
- `GET /api/me` returns `{ user: { id, createdAt }, brains: [{ id, number, title, nodeCount, updatedAt }] }` and sets the cookie on first visit. It never creates brains: a new user gets `brains: []`, and their first mapped idea becomes brain № 001.
- Empty state (no brain open and no saved brains: a first visit, or after deleting the last brain): the canvas shows only the ground; the left panel shows the "Second brain — ▾" dropdown (its menu holds only "+ New second brain"), the title "Your second brain", the summary "Type an idea below. The map, the agents and the takeaway grow from there.", the idle agent team and the ID line, with no takeaway or legend; the hidden-panel tab reads "» Your second brain". The input is focused, "Map it →" is enabled and "▶ Run agents" is disabled, and the status line reads "Type an idea to map your first second brain." The "Tool Library" sample (`lib/sample/toolLibrary.ts`, a verbatim port of the prototype sample) is kept for tests, fixtures and the dev pages only.
- Recovery: the left panel shows "Your ID: <first 8 chars>" with a copy button that copies the full uuid. A "Restore ID" input posts the uuid to `POST /api/me/restore`; the server verifies the uuid exists in `users` and re-issues the signed cookie. There is no other recovery path.
- The uuid is mirrored to `localStorage['ab_uid_display']` for the panel only. The server never trusts it.

## 6. API

All routes: JSON only, bodies validated with Zod, body size capped at 256 KB, responses `{ data } | { error: string }`. Brain routes require ownership and return 404 for brains that belong to someone else.

| Route | Purpose |
|---|---|
| `GET /api/me` | identity + brain list (empty for a new user) |
| `POST /api/me/restore` | `{ id }` → re-issue cookie if user exists |
| `GET /api/brains` | list |
| `POST /api/brains` | `{ title, summary, nodes, links? }` → create brain with next number, return full Brain |
| `GET /api/brains/:id` | full Brain |
| `PATCH /api/brains/:id` | `{ title?, summary?, round?, synth? }` |
| `DELETE /api/brains/:id` | delete brain |
| `POST /api/brains/:id/nodes` | `{ nodes: IdeaNode[] }` insert (used by expand) |
| `PATCH /api/brains/:id/nodes` | `{ id, name?, note?, userNote? }` |
| `DELETE /api/brains/:id/nodes` | `{ id }` delete subtree; refuses `n0` |
| `POST /api/brains/:id/links` | `{ links: CrossLink[] }` upsert |
| `POST /api/brains/:id/rounds` | `{ round, nodes, links, log }` applied in one transaction |
| `POST /api/brains/:id/takeaway` | `{ synth, log }` sets synth and appends the log entry in one transaction |
| `POST /api/llm/map` | `{ idea }` |
| `POST /api/llm/expand` | `{ title, summary, path, existing, question? }` |
| `POST /api/llm/agent-round` | `{ agent, idea, mapLines, links, target }` |
| `POST /api/llm/takeaway` | `{ idea, mapLines, links }` |

LLM routes never touch the database. LLM routes are rate-limited per user: token bucket in process memory, `RATE_LIMIT_PER_HOUR` default 60, 429 with `Retry-After` when exhausted.

## 7. LLM layer

- `lib/llm/provider.ts`: `chat({ system, user }) → { text, ms, model }` against `${LLM_BASE_URL}/chat/completions` with Bearer `LLM_API_KEY`, `temperature 0.4`, `response_format: {type:'json_object'}`, and `chat_template_kwargs: { reasoning_effort }` only when `LLM_REASONING_EFFORT` is set. Default base URL `https://api.ifm.ai/v1`, default model `IFM/K2-Horizon-375B-A23B`. Any OpenAI-compatible endpoint works.
- `lib/llm/schemas.ts`: Zod for the four reply shapes. Map: 5–6 branches, kinds from the six non-core kinds, each kind at most once, 2–4 children each, names ≤ 60 chars, notes ≤ 300 chars. Expand: 3–4 children (hard cap 5). Agent round: `thought` one sentence, 2–3 children, 0–1 links with `a` and `b` as existing node ids. Takeaway: `leaf` existing node id, `verdict`, `brief`.
- `lib/llm/extractJson.ts`: substring from first `{` to last `}`, strip code fences first.
- Flow in each route: call → extract → parse. On failure, retry once with the user message plus "Your previous output was invalid: <issues>. Return corrected JSON only." On second failure, provider error, or no `LLM_API_KEY`: return the fallback result with `meta: { source: 'fallback' }`. Success returns `meta: { source: 'model', model, ms, attempts }`.
- `lib/llm/fallback.ts`: ports the prototype's `localParse` keyword parser for maps, its template children for expand, the agent template children table `F` for rounds (critique templates for the Skeptic), a random cross-branch link, and the takeaway heuristic (score = depth + 1.5 if linked + 0.5 if Next step, highest wins). The output of the fallback must itself pass the Zod schemas; a unit test asserts this.
- `lib/llm/prompts.ts` holds the four system prompts and user-message builders exactly as written in `AGENTS-SPEC.md` §7 and `IMPLEMENTATION.md`. Map lines format: `id | name | kind | parent`.

## 8. Agent runner

`lib/agents/roster.ts` defines the five agents with id, name, colour, shape, owned kinds, brief and `critic` flag (Skeptic only), as in `AGENTS-SPEC.md` §7.

`lib/agents/runner.ts` is a class with `start(brainId, rounds)`, `pause()`, and an `EventEmitter`-style `on(event, handler)` for the scene and UI. It depends on an injected `api` (the four LLM calls plus the two persistence calls) and the store. Events, in order per round:

1. `phase('plan')`, `agentPlan({ agent, target })` — target from `pickTarget(agent, nodes)`: nodes at depth 1–3 in the agent's kinds, sorted by (child count asc, depth asc), ties random; if none, the core.
2. `agentTravel({ agent, path })` — path is the list of node ids from `n0` through the branch to the target. The runner awaits the promise the scene returns.
3. `phase('diverge')`, `agentThink({ agent, target })` — runner starts the LLM call and `sleep(1200)` together and awaits both.
4. `agentSpawn({ agent, target, children })` — children built by `makeKids`: ids `<target>x<stamp><k>`, kind and colour inherited (Skeptic children are kind Risk, `critic: true`; children of the core cycle through the six kinds), depth `target.depth + 1`, `by: agent`.
5. `phase('connect')`, `agentLink({ link })` for each valid link (both ids exist, different branches, not already present).
6. `log({ entry })` with tag `R{round} · +{count}`.
7. Persist via `POST /api/brains/:id/rounds` with the new round number. On failure the store marks `syncError` and the run pauses.
8. `agentDone({ agent })`.

Agent order is `round % 5` over `[researcher, builder, customer, skeptic, strategist]`. After the configured rounds: `phase('takeaway')`, Strategist pops in at `n0`, thinks (min 1200 ms), `POST /api/llm/takeaway`, the store sets `synth` with `path` from `n0` to the chosen leaf, the log gets a `Takeaway` entry, `POST /api/brains/:id/takeaway` persists, the takeaway card opens, path highlight turns on.

A run is bound to the brain id it started on. `pause()`, switching brains, deleting the brain, or a sync error stops it after the current step. No agent is visible while nothing runs.

## 9. 3D engine

Port of the prototype scene into modules under `engine/`. Numbers are the prototype's.

- `AtlasScene.ts`: `WebGLRenderer({ antialias, alpha })`, pixel ratio ≤ 2, `Fog(bg, 24, 52)`, `PerspectiveCamera(38, aspect, 0.1, 200)` at `(15, 9, 18)`, `OrbitControls` with damping, min 5, max 48, `autoRotate` at 0.35 when nothing is selected and no run is active. Public API: `mount(el, labelLayer, agentLabelLayer)`, `setBrain(brain)`, `setMode(mode)`, `setTheme(theme)`, `select(id | null)`, `setShowPath(bool)`, `onPick(cb)`, `agent(event, payload) → Promise<void>`, `dispose()`. Resize via `ResizeObserver`. The loop uses `renderer.setAnimationLoop` and is stopped in `dispose()`, which also disposes every geometry and material and removes document listeners.
- `layout.ts` (pure): `computeTargets(nodes, mode) → Record<id, {x,y,z}>`. Constellation: branches on a Fibonacci sphere radius 6.8, y scaled to 4.4. Orbit: branch i on a tilted ring R = 3.6 + i·1.35, angular speed ∝ 1/R, time-dependent. Terrain: Gaussian height field σ² ≈ 2.1, core peak 1.7, branch peaks `1.5 + children·0.55` at alternating radii 5.2 and 7.4; `heightAt(x, z)` exported. Depth ≥ 2 nodes sit in a cone away from the grandparent at radius `2.2·0.72^(depth−2)`. Ground y per mode: −5.8, −3.2, 0.
- `ground.ts`: rings r = 2…14 and 24 spokes as line segments; in terrain mode, 46 ridgelines of 110 columns clipped to a 14-unit circle; orbit rings fade in for orbit mode. Ground y eases between modes.
- `nodes.ts`: flat `MeshBasicMaterial` spheres with a larger back-face sphere as outline. Core r 0.85 ink fill, panel outline, rotating accent torus. Branch r 0.42 kind fill, ink outline. Leaf r 0.17 shrinking by depth, panel fill, thick outline in branch colour. One `LineSegments` buffer for parent→child links rewritten each frame; drop lines from core and branches to the ground with a cross marker; dashed accent arcs for cross-links; strongest path highlighted in accent when enabled; pulsing accent reticle billboarded to the camera on the selected node. Positions lerp with `k = 1 − exp(−dt/260)`; new nodes spawn at their parent with delay `depth·260 + index·25` ms and scale in. Materials recolour in place on theme change. Rebuild diffs by node id and disposes removed objects.
- `agents.ts`: five flat characters from `ShapeGeometry` (hexagon, rounded square, five-petal flower, ghost, five-point star) with the eye variants from the prototype, no outline, always facing the camera. Hidden by default; pop in 0 → 1.25 → 1.15 scale, shrink out. Idle: squash-and-stretch bob, slight wobble, blink every ~3.6 s (eye scale.y 0.15 for 130 ms), pupil drift. Thought bubble with three animated dots. Travel along a polyline of node positions at constant speed. HTML name tag "Researcher · eyeing Pickup lockers" positioned per frame; verbs by phase: eyeing, sprouting ideas on, linking from, pondering.
- `labels.ts`: one `<div>` per node in an overlay layer, projected each frame, offset right of the node. Core: serif italic 19 px in an accent pill with `#1B1A17` text and 1 px ink border. Branch: 9 px mono kind tag above serif 20 px. Leaf: mono 10.5 px uppercase, fading with distance. Placement in priority order (selected, then by depth) with AABB collision: colliding leaf hides, colliding branch fades to 15%. When a node is selected, labels outside its ancestors and descendants dim to 22%. The overlay sits below the UI panels in z-order so labels never cover them.
- `themes.ts`: the token table from `AGENTS-SPEC.md` §5 for the three themes, used by both the engine and `app/globals.css` (the CSS file is generated from this table by `scripts/gen-theme-css.ts` so the two cannot drift).

`components/atlas/Atlas.tsx` creates the scene on mount, subscribes to the store (brain, mode, theme, selection, showPath) and pushes changes into the scene, forwards picks to the store, registers the runner's events to `scene.agent(...)`, and disposes on unmount.

## 10. Client state and sync

`lib/store.ts` (Zustand): `user`, `brains` (list), `brain` (current, full), `selected`, `mode`, `theme`, `settings { rounds: 5|10|20 }`, `run { active, paused, round, total, phase, agent, status }`, `ui { leftHidden, focus, takeawayOpen, logOpen, openDropdown }`, `syncError`.

`lib/sync.ts`: every mutation applies to the store first, then calls the API. Mutations: `createBrain`, `selectBrain`, `deleteBrain`, `editNode`, `saveUserNote`, `deleteSubtree`, `addChildren`, `addLinks`, `applyRound`, `setTakeaway`, `renameBrain`. Each API call retries once on network error. On final failure, `syncError` holds the failed mutation; the UI shows a "Not saved · Retry" chip in the status line; retry re-sends. No silent rollback.

Mode, theme, settings and panel visibility are persisted in `localStorage` (`ab_prefs`), since they are preferences, not data.

## 11. UI

Tailwind v4. Tokens as CSS variables on `html[data-theme]`: `--bg --panel --ink --muted --soft --faint --accent --hot --rule --rule2 --shadow5 --shadow3`. Tailwind utilities use them via `@theme` mapping, so no component hard-codes a colour. Fonts via `next/font/google`: Instrument Serif (regular, italic) and JetBrains Mono.

Layout follows `AGENTS-SPEC.md` §4 exactly: full-screen canvas; double hairline frame inset 14 px and 19 px; left panel 300 px with brain dropdown and « hide button (» {title} tab when hidden), title 46 px serif, italic summary, Key takeaway card with Show/Hide path and collapse, Agent team list with status and counts and the Plan · Diverge · Connect · Takeaway phase bar, branch legend, identity line; top-right toolbar View ▾ / Design ▾ / Settings ▾ / Focus with only one dropdown open; node card on the right with kind and level, path, name with Edit (inline fields, Save/Cancel), AI note, My notes textarea (saves on blur or on selection change, shows "editing…" / "saved"), child chips, cross-links, Expand this node →, two-step Delete (not on core); agent log on the right when nothing is selected, capped height, collapsible, entries clickable; bottom input bar max 720 px with label "New brain" / "Ask node", serif 24 px input, Map it → / Grow → in accent, ▶ Run agents / ❚❚ Pause in ink, one-line status above; focus mode hides every panel, Exit focus button bottom right, Esc exits; hint "Drag to orbit · Scroll to zoom · Click a node" bottom right.

Settings adds one extra row: "Provider: <model>" or "Provider: offline fallback", from the last LLM response's `meta`.

Minimum supported viewport 900×540, no panel overlap.

## 12. Exports

`lib/export/markdown.ts`, `json.ts`, `html3d.ts` as in `AGENTS-SPEC.md` §8. The 3D HTML export embeds the brain as JSON, inlines the compiled `engine/layout.ts` (built to `public/export/layout.js` by a build step) and loads Three from a CDN; it keeps the current theme and mode and offers the View switch. Downloads trigger via a Blob URL in the browser.

## 13. Deployment and security

- `docker/Dockerfile`: multi-stage, `node:22-alpine`, `next build` with `output: 'standalone'`, runs as a non-root user, `HEALTHCHECK` on `/api/health`.
- `docker/compose.yml`: `app`, `db` (postgres:16, named volume, healthcheck), `caddy` (ports 80/443, `Caddyfile` reverse-proxies `${DOMAIN}` to `app:3000`). `app` runs `node db/migrate.js && node server.js`; the migrator takes a Postgres advisory lock so replicas do not race. `docker/compose.dev.yml`: `db` only, port 5432.
- Env (`lib/env.ts`, Zod, fails fast): `DATABASE_URL`, `COOKIE_SECRET` (min 32 chars; must not equal the example value in production), `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` (optional; empty means fallback), `LLM_REASONING_EFFORT` (optional), `RATE_LIMIT_PER_HOUR` (default 60), `DOMAIN` (compose only). `.env.example` documents each with fake values; `.env*` is gitignored except `.env.example`.
- `scripts/check-secrets.sh`: greps staged files for patterns (`sk-`, `AKIA`, `ghp_`, `-----BEGIN`, `LLM_API_KEY=` with a non-empty value) and refuses the commit; wired as a git pre-commit hook via `scripts/install-hooks.sh`. CI runs gitleaks as well.
- Security headers in `next.config.ts`: CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`. The 3D HTML export is a downloaded file, so its CDN script is not covered by the app CSP.
- `/api/health` returns `{ ok, db: true|false }`.

## 14. Open-source hygiene

MIT `LICENSE`. `README.md`: one-line pitch, screenshot and GIF (placeholder paths until recorded), quick start (`cp .env.example .env`, `docker compose -f docker/compose.dev.yml up -d`, `npm i`, `npm run db:migrate`, `npm run dev`), "run with Ollama" and "run with K2 Horizon" env snippets, architecture section with a text diagram of the request flow, env table, scripts table, project structure, deployment section, contributing pointer, license. `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md` (report to zaqisilverano@gmail.com), `CHANGELOG.md` (Keep a Changelog, Unreleased section), `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `PULL_REQUEST_TEMPLATE.md`, `ci.yml` (lint, typecheck, unit + route tests, gitleaks, build). `CLAUDE.md`: boundary rule, commands, no Co-Authored-By trailer.

## 15. Testing

- Unit (Vitest): `layout.ts` all modes and the depth cone and `heightAt`; `schemas.ts` with valid and invalid samples; `extractJson`; `fallback.ts` output passes schemas; `pickTarget`; `makeKids` id and inheritance rules; `markdown/json/html3d` exporters against a fixture brain; `identity.ts` sign/verify/tamper; `rateLimit`; `themes.ts` and the generated CSS match.
- Routes (Vitest + pglite, Drizzle migrations applied in `beforeAll`): first visit sets cookie and returns no brains; second visit reuses identity; user A cannot read or mutate user B's brain; create brain assigns numbers 1, 2, 3; delete subtree removes descendants and refuses `n0`; rounds route is atomic (a failing link insert rolls back nodes); LLM routes return fallback with `meta.source = 'fallback'` when no key; rate limiter returns 429.
- E2E (Playwright, fallback provider, Postgres from compose.dev): load shows the empty state (title "Your second brain", input focused, Run agents disabled); type an idea and press Enter shows new nodes within 5 s; click a node opens the card; Expand adds children; View and Design switches do not throw; Focus and Esc; Markdown download has the title; viewport 900×540 screenshot has no overlapping panels (checked by bounding boxes).
- `npm run eval`: runs the four prompts against the configured provider over `scripts/eval-prompts.json` and prints pass rate, retries, latency. Not part of CI.

## 16. Out of scope for v1

Accounts and email, sharing brains by URL, multi-model comparison, streaming partial JSON, mobile layout below 900 px, i18n.
