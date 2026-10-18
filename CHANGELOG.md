# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Scoped agent runs: "Expand with agents" on a node (or Run agents with a node selected) runs the agents on that node and its descendants only, with no takeaway at the end. Text in the input becomes an optional focus note sent with every round (`focus` on `POST /api/llm/agent-round`, up to 300 characters).
- Continuous deployment: `.github/workflows/deploy.yml` deploys `main` to the VPS over SSH with `scripts/deploy.sh` after a green CI run, then checks `/api/health`.
- Mobile layout with bottom sheets: below 768 px a top bar, a phase bar, a tab bar (Map, Agents, Log, Key, Run) and one bottom sheet at a time replace the desktop panels.
- Clickable nodes in the standalone 3D HTML export: a click or tap selects a node (pulsing reticle, hot label, unrelated labels dimmed) and opens a detail card with kind and level, path, AI note, My notes, child chips and cross-links, styled by the chosen design (a bottom sheet below 640 px).

### Changed

- One action button: "Map it →" and "Grow →" are gone, and ▶ Run agents (❚❚ Pause during a run) does everything. With typed text the first run maps the idea into a new brain and then runs the agents on it; with an empty input it runs the open brain. On a phone the input bar has no button: Enter or ▶ Run in the tab bar.
- The node card's "Expand this node →" (one LLM call that added children) is replaced by "Expand with agents →". The `/api/llm/expand` route stays available.
- Switched from npm to pnpm. The version is pinned in `packageManager` in `package.json`, the lockfile is `pnpm-lock.yaml`, and the Dockerfile and CI install with `pnpm install --frozen-lockfile`.
- Renamed the project to agentmind (repository `zaqisilverano/agentmind`). The production Compose project is now named `agentmind`, so containers and volumes are prefixed `agentmind`; the proxy override names the app container `agentmind`. Cookie and `localStorage` keys are unchanged. Existing deployments: the old Compose project was named after the `docker/` directory, so the database volume was `docker_ab_pg`; copy it into `agentmind_ab_pg` before the first `up` under the new name, or the app starts on an empty database.
- First visit starts with an empty map instead of the Tool Library sample.

## [0.1.0] - 2026-10-16

### Added

- Idea input that an LLM turns into a tree of branches and sub-ideas, rendered as a 3D map with Three.js.
- Three layouts (Constellation, Orbit, Terrain) and three themes (Atlas, Observatory, Blueprint).
- Five animated agents (Researcher, Builder, Customer, Skeptic, Strategist) that grow weak spots and link branches in rounds, then produce a Key takeaway and a highlighted strongest path.
- Node card with editing, personal notes, expand, and delete for a node and its branches. Agent log, focus mode.
- Delete a whole brain from the Second brain menu.
- Persistence in Postgres under an anonymous signed cookie (`ab_uid`), with an ID display and Restore ID.
- Sample "Tool Library" brain for first visits.
- OpenAI-compatible LLM client with Zod-validated replies, one retry, and an offline fallback when no API key is set.
- Per-user and per-IP rate limits on LLM routes, a per-IP limit on new anonymous sessions, at most 100 brains per user and 300 nodes per brain.
- Downloads as Markdown, JSON and a standalone 3D HTML file.
- Docker Compose deployment with Caddy and automatic migrations, a Content Security Policy with per-request nonce, and a secrets pre-commit hook.
- Vitest unit and route tests on pglite, and a prompt eval script (`npm run eval`).
- GitHub Actions workflow with lint, typecheck, tests, build, gitleaks and a production Docker image smoke test.
