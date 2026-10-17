# agentmind Implementation Plan

> Historical record. Written for the project when it was called Agentic Brainstorm and used npm; it was renamed to agentmind and switched to pnpm on 2026-10-17. Names and commands below are as executed at the time.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public Next.js app in which an LLM turns a typed idea into a 3D Three.js map, five animated agents grow it in rounds, and every brain is saved server-side under an anonymous cookie identity.

**Architecture:** Next.js App Router hosts a single screen. A pure-TypeScript `engine/` (ported from the prototype) owns the Three.js scene and is mounted by one thin client component. Zustand holds client state with optimistic sync to route handlers backed by Drizzle + Postgres. LLM calls go through route handlers to any OpenAI-compatible endpoint (K2 Horizon by default) with Zod-validated replies and a local fallback.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind v4, three, Zustand, Zod, Drizzle ORM + postgres, Vitest, @electric-sql/pglite, Playwright, Docker Compose, Caddy.

**Spec:** `docs/superpowers/specs/2026-10-16-agentmind-design.md` (read it first; this plan argues from it). Prototype reference: `docs/reference/prototype/idea-atlas-agents.prototype.js` (line numbers below refer to this file), `AGENTS-SPEC.md`, `IMPLEMENTATION.md`.

## Global Constraints

- Node 22 LTS, npm. TypeScript `strict: true`. ESLint via `next lint` must pass.
- Boundary rule: files under `engine/`, `lib/llm`, `lib/agents`, `lib/export`, `lib/sample` import nothing from `react`, `next`, or `db/`. `engine/layout.ts` must not import `three`.
- Node ids: root `n0`; branches `b0`…; seeded children `b0c0`…; generated children `<parentId>x<base36stamp><k>`.
- Kind colours: Problem `#E0482B`, People `#2F5BD8`, Mechanism `#3E8E5A`, Value `#D49A1E`, Risk `#9B3FB5`, Next step `#1A8C8C`. Core colour = theme ink.
- Cookie `ab_uid`, value `<uuid>.<hmac-sha256 hex>`, httpOnly, SameSite=Lax, Path=/, Max-Age 31536000, Secure in production.
- Default LLM: `LLM_BASE_URL=https://api.ifm.ai/v1`, `LLM_MODEL=IFM/K2-Horizon-375B-A23B`. Empty `LLM_API_KEY` means fallback.
- Rate limit: `RATE_LIMIT_PER_HOUR` default 60 per user on `/api/llm/*`.
- Secrets never committed: `.env*` ignored except `.env.example`.
- Commits: plain messages, no `Co-Authored-By` trailer, no "generated with" line. Prefix with `feat:`, `test:`, `chore:`, `docs:`.
- Where the spec and the prototype disagree on visuals or behaviour, the prototype wins.

---

## Phase 0 — Scaffold

### Task 1: Next.js scaffold, Tailwind, test runner, CLAUDE.md

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `vitest.config.ts`, `tests/unit/smoke.test.ts`, `CLAUDE.md`, `.env.example`, `.nvmrc`
- Modify: `.gitignore` (already exists)

**Interfaces:**
- Produces: `npm run dev|build|lint|typecheck|test|test:watch`. Vitest resolves `@/` to the repo root.

- [ ] **Step 1: Scaffold with create-next-app (non-interactive)**

```bash
cd /Users/zaqi.silverano/projects/agentic-brainstorm
npx --yes create-next-app@15 . --ts --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --no-turbopack --yes
```
If it refuses because the directory is not empty, run it in `/tmp/ab-scaffold` and copy everything except `.git`, `README.md`, `.gitignore` into the repo, then merge `.gitignore` entries (keep ours, add theirs).

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm i three zustand zod drizzle-orm postgres
npm i -D @types/three vitest @vitest/coverage-v8 jsdom @electric-sql/pglite drizzle-kit tsx @playwright/test
```

- [ ] **Step 3: Add scripts and engines to package.json**

```json
"engines": { "node": ">=22" },
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx db/migrate.ts",
  "gen:theme": "tsx scripts/gen-theme-css.ts",
  "eval": "tsx scripts/eval.ts"
}
```

- [ ] **Step 4: vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts", "tests/routes/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
```

- [ ] **Step 5: Smoke test**

`tests/unit/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("smoke", () => { it("runs", () => expect(1 + 1).toBe(2)); });
```
Run: `npm test` → PASS.

- [ ] **Step 6: .env.example, .nvmrc, CLAUDE.md**

`.env.example`:
```
# Postgres (compose.dev.yml exposes this)
DATABASE_URL=postgres://atlas:atlas@localhost:5432/atlas
# 32+ random chars. Generate: openssl rand -hex 32 . The app refuses this example value in production.
COOKIE_SECRET=change-me-change-me-change-me-change-me
# Any OpenAI-compatible endpoint. Leave LLM_API_KEY empty to run on the local fallback.
LLM_BASE_URL=https://api.ifm.ai/v1
LLM_MODEL=IFM/K2-Horizon-375B-A23B
LLM_API_KEY=
LLM_REASONING_EFFORT=
RATE_LIMIT_PER_HOUR=60
# Production only (Caddy)
DOMAIN=brainstorm.example.com
```
`.nvmrc`: `22`

`CLAUDE.md`:
```markdown
# CLAUDE.md
Public open-source project by Zaqi Silverano. Spec: docs/superpowers/specs/. Prototype reference: docs/reference/prototype/.
## Boundary rule
engine/, lib/llm, lib/agents, lib/export, lib/sample import nothing from react, next or db/. engine/layout.ts must not import three.
## Commands
npm run dev · npm run typecheck · npm run lint · npm test · npm run test:e2e · npm run db:migrate
## Git
Plain commit messages. No Co-Authored-By trailer, no "generated with" line. Never commit .env files.
```

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build` → all pass.
```bash
git add -A && git commit -m "chore: scaffold Next.js app with Tailwind, Vitest and project rules"
```

---

## Phase 1 — Pure domain (no React, no DB)

### Task 2: Domain types, kind colours, id helpers, sample brain

**Files:**
- Create: `engine/types.ts`, `lib/ids.ts`, `lib/sample/toolLibrary.ts`
- Test: `tests/unit/sample.test.ts`, `tests/unit/ids.test.ts`

**Interfaces:**
- Produces: all types from spec §4.1 exported from `engine/types.ts`; `KIND_COLORS: Record<Exclude<Kind,'Core'>, string>`; `fromBranches(o: MapReply, ink: string): { title, summary, nodes: IdeaNode[] }` in `lib/ids.ts`; `childId(parentId: string, k: number, stamp?: string): string`; `SAMPLE_BRANCHES: MapReply` and `sampleBrain(ink: string)` in `lib/sample/toolLibrary.ts`.

- [ ] **Step 1: Write failing tests**

`tests/unit/ids.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fromBranches, childId } from "@/lib/ids";
describe("fromBranches", () => {
  it("builds n0, b0.., b0c0.. with inherited kind and colour", () => {
    const r = fromBranches({ title: "T", summary: "S", branches: [{ name: "A", kind: "Problem", note: "n", children: [{ name: "a1", note: "" }] }] }, "#111");
    expect(r.nodes.map(n => n.id)).toEqual(["n0", "b0", "b0c0"]);
    expect(r.nodes[0]).toMatchObject({ kind: "Core", depth: 0, parent: null, color: "#111" });
    expect(r.nodes[2]).toMatchObject({ kind: "Problem", depth: 2, parent: "b0", color: "#E0482B", position: 0 });
  });
  it("caps at 7 branches and 5 children and falls back on unknown kind", () => {
    const branches = Array.from({ length: 9 }, (_, i) => ({ name: "B" + i, kind: "Bogus" as never, note: "", children: Array.from({ length: 7 }, (_, j) => ({ name: "c" + j, note: "" })) }));
    const r = fromBranches({ title: "T", summary: "S", branches }, "#111");
    expect(r.nodes.filter(n => n.depth === 1)).toHaveLength(7);
    expect(r.nodes.filter(n => n.parent === "b0")).toHaveLength(5);
    expect(r.nodes[1].kind).toBe("Problem");
  });
  it("childId uses parent + x + stamp + k", () => expect(childId("b2", 3, "zz")).toBe("b2xzz3"));
});
```
`tests/unit/sample.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sampleBrain } from "@/lib/sample/toolLibrary";
describe("sample brain", () => {
  it("is the Tool Library with 6 branches and 17 leaves", () => {
    const b = sampleBrain("#1B1A17");
    expect(b.title).toBe("Tool Library");
    expect(b.nodes.filter(n => n.depth === 1)).toHaveLength(6);
    expect(b.nodes.filter(n => n.depth === 2)).toHaveLength(17);
    expect(new Set(b.nodes.filter(n => n.depth === 1).map(n => n.kind)).size).toBe(6);
  });
});
```
Run: `npm test` → FAIL (modules missing).

- [ ] **Step 2: engine/types.ts** — copy spec §4.1 verbatim and add:
```ts
export const KINDS = ['Problem','People','Mechanism','Value','Risk','Next step'] as const;
export const KIND_COLORS: Record<(typeof KINDS)[number], string> = { Problem:'#E0482B', People:'#2F5BD8', Mechanism:'#3E8E5A', Value:'#D49A1E', Risk:'#9B3FB5', 'Next step':'#1A8C8C' };
export interface MapReply { title: string; summary: string; branches: { name: string; kind: string; note: string; children: { name: string; note: string }[] }[] }
```

- [ ] **Step 3: lib/ids.ts** — port prototype lines 38–48 (`fromBranches`) to the typed shape; every node gets `userNote: ''`, `by: null`, `critic: false`, `position: index among siblings`. `childId = (p, k, stamp = Date.now().toString(36)) => `${p}x${stamp}${k}``.

- [ ] **Step 4: lib/sample/toolLibrary.ts** — copy the SEED object from prototype lines 20–31 as `SAMPLE_BRANCHES` (children get `note: ''`), and `sampleBrain = (ink) => fromBranches(SAMPLE_BRANCHES, ink)`.

- [ ] **Step 5: Run tests, commit**
Run: `npm test` → PASS.
```bash
git add engine lib tests && git commit -m "feat: domain types, id helpers and sample brain"
```

### Task 3: LLM contracts, extractJson, prompts, fallback

**Files:**
- Create: `lib/llm/schemas.ts`, `lib/llm/extractJson.ts`, `lib/llm/prompts.ts`, `lib/llm/fallback.ts`
- Test: `tests/unit/llm-schemas.test.ts`, `tests/unit/fallback.test.ts`, `tests/unit/extractJson.test.ts`

**Interfaces:**
- Produces: `MapReplySchema`, `ExpandReplySchema`, `AgentRoundReplySchema`, `TakeawayReplySchema` (Zod) and their inferred types `MapReply`, `ExpandReply`, `AgentRoundReply`, `TakeawayReply`; `extractJson(text: string): unknown`; `PROMPTS.map.system`, `PROMPTS.map.user(idea)`, `PROMPTS.expand.user({title, summary, path, existing, question?})`, `PROMPTS.agentRound.system(agent)`, `PROMPTS.agentRound.user({idea, mapLines, links, target})`, `PROMPTS.takeaway.system`, `PROMPTS.takeaway.user({idea, mapLines, links})`, `mapLines(nodes): string`; `fallback.map(idea)`, `fallback.expand(path: string[], question?: string)`, `fallback.agentRound(agent: AgentId, target: IdeaNode, nodes: IdeaNode[])`, `fallback.takeaway(nodes, links)`.

- [ ] **Step 1: Failing tests**

`tests/unit/extractJson.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/llm/extractJson";
describe("extractJson", () => {
  it("strips fences and prose", () => expect(extractJson("Sure!\n```json\n{\"a\":1}\n```\nDone")).toEqual({ a: 1 }));
  it("throws when no object", () => expect(() => extractJson("nope")).toThrow());
});
```
`tests/unit/llm-schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { MapReplySchema, AgentRoundReplySchema, TakeawayReplySchema, ExpandReplySchema } from "@/lib/llm/schemas";
const branch = (kind: string) => ({ name: "B", kind, note: "n", children: [{ name: "c", note: "" }, { name: "d", note: "" }] });
describe("MapReplySchema", () => {
  it("accepts 5 distinct kinds", () => expect(MapReplySchema.safeParse({ title: "T", summary: "S", branches: ["Problem","People","Mechanism","Value","Risk"].map(branch) }).success).toBe(true));
  it("rejects duplicate kinds", () => expect(MapReplySchema.safeParse({ title: "T", summary: "S", branches: ["Problem","Problem","People","Value","Risk"].map(branch) }).success).toBe(false));
  it("rejects 4 branches", () => expect(MapReplySchema.safeParse({ title: "T", summary: "S", branches: ["Problem","People","Value","Risk"].map(branch) }).success).toBe(false));
});
describe("other schemas", () => {
  it("expand caps children at 5", () => expect(ExpandReplySchema.safeParse({ children: Array(6).fill({ name: "x", note: "" }) }).success).toBe(false));
  it("agent round needs 1-3 children, 0-1 links", () => {
    expect(AgentRoundReplySchema.safeParse({ thought: "t", children: [{ name: "a", note: "" }], links: [] }).success).toBe(true);
    expect(AgentRoundReplySchema.safeParse({ thought: "t", children: [{ name: "a", note: "" }], links: [{ a: "b0", b: "b1", why: "w" }, { a: "b0", b: "b2", why: "w" }] }).success).toBe(false);
  });
  it("takeaway", () => expect(TakeawayReplySchema.safeParse({ leaf: "b0c0", verdict: "v", brief: "b" }).success).toBe(true));
});
```
`tests/unit/fallback.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fallback } from "@/lib/llm/fallback";
import { MapReplySchema, AgentRoundReplySchema, TakeawayReplySchema, ExpandReplySchema } from "@/lib/llm/schemas";
import { sampleBrain } from "@/lib/sample/toolLibrary";
describe("fallback output passes the schemas", () => {
  const b = sampleBrain("#111");
  it("map", () => expect(MapReplySchema.safeParse(fallback.map("A tool library for drills and ladders")).success).toBe(true));
  it("expand", () => expect(ExpandReplySchema.safeParse(fallback.expand(["Tool Library", "Idle ownership"], "why?")).success).toBe(true));
  it("agentRound for every agent", () => {
    for (const a of ["researcher","builder","customer","skeptic","strategist"] as const)
      expect(AgentRoundReplySchema.safeParse(fallback.agentRound(a, b.nodes[1], b.nodes)).success).toBe(true);
  });
  it("takeaway picks a deep or linked leaf", () => {
    const t = fallback.takeaway(b.nodes, []);
    expect(TakeawayReplySchema.safeParse(t).success).toBe(true);
    expect(b.nodes.find(n => n.id === t.leaf)?.depth).toBe(2);
  });
});
```
Run: `npm test` → FAIL.

- [ ] **Step 2: lib/llm/extractJson.ts**
```ts
export function extractJson(text: string): unknown {
  const s = text.replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no JSON object in model output");
  return JSON.parse(s.slice(a, b + 1));
}
```

- [ ] **Step 3: lib/llm/schemas.ts**
```ts
import { z } from "zod";
import { KINDS } from "@/engine/types";
const Child = z.object({ name: z.string().min(1).max(60), note: z.string().max(300).default("") });
export const MapReplySchema = z.object({
  title: z.string().min(1).max(80), summary: z.string().max(400).default(""),
  branches: z.array(z.object({ name: z.string().min(1).max(60), kind: z.enum(KINDS), note: z.string().max(300).default(""), children: z.array(Child).min(2).max(4) })).min(5).max(6),
}).superRefine((m, ctx) => { const ks = m.branches.map(b => b.kind); if (new Set(ks).size !== ks.length) ctx.addIssue({ code: "custom", message: "each kind at most once" }); });
export const ExpandReplySchema = z.object({ children: z.array(Child).min(1).max(5) });
export const AgentRoundReplySchema = z.object({ thought: z.string().min(1).max(300), children: z.array(Child).min(1).max(3), links: z.array(z.object({ a: z.string(), b: z.string(), why: z.string().max(120).default("") })).max(1).default([]) });
export const TakeawayReplySchema = z.object({ leaf: z.string().min(1), verdict: z.string().min(1).max(300), brief: z.string().min(1).max(900) });
export type MapReply = z.infer<typeof MapReplySchema>; export type ExpandReply = z.infer<typeof ExpandReplySchema>;
export type AgentRoundReply = z.infer<typeof AgentRoundReplySchema>; export type TakeawayReply = z.infer<typeof TakeawayReplySchema>;
```
Update `engine/types.ts` to re-export `MapReply` from here instead of its own copy (one definition).

- [ ] **Step 4: lib/llm/prompts.ts** — system prompts verbatim from `AGENTS-SPEC.md` §7 "Prompts" and the user-message builders from prototype lines 72–115 (`submit`, `expand`), 218–250 (`agentRound`) and 314–333 (`synthesize`). `mapLines` is prototype line 175. Each builder returns a string; the agent-round system prompt is `You are the ${agent.name} agent on a brainstorming team. ${agent.brief} Reply with JSON only.` The agent roster is defined in Task 4; to avoid a cycle, `PROMPTS.agentRound.system` takes `{ name, brief }`.

- [ ] **Step 5: lib/llm/fallback.ts** — port `localParse` (lines 50–69) as `map`; `expand` returns `{ children: [{name:'Who it helps',...},{name:'How it starts',...},{name:'What it costs',...}] }` plus a fourth child built from the question when given (`'Answer: ' + question.slice(0,40)`); `agentRound` ports `fallbackRound` (lines 193–198) including the `F` table in full for all five agents; `takeaway` implements the heuristic from spec §7 (score = depth + 1.5 if linked + 0.5 if Next step; verdict `Pursue ${leaf.name}.`, brief three sentences built from the leaf's branch name and note).

- [ ] **Step 6: Run tests, commit**
Run: `npm test` → PASS.
```bash
git add lib tests engine && git commit -m "feat: LLM contracts, JSON extraction, prompts and offline fallback"
```

### Task 4: Agent roster, target picking, child generation, exports

**Files:**
- Create: `lib/agents/roster.ts`, `lib/agents/pickTarget.ts`, `lib/agents/makeKids.ts`, `lib/export/markdown.ts`, `lib/export/json.ts`, `tests/fixtures/brain.ts`
- Test: `tests/unit/agents.test.ts`, `tests/unit/export.test.ts`

**Interfaces:**
- Produces: `AGENTS: Agent[]` with `Agent = { id: AgentId; name: string; color: string; shape: 'hexagon'|'squircle'|'flower'|'ghost'|'star'; icon: string; eyes: string; eyeFill: string; pupils: string; kinds: Kind[]; brief: string; critic: boolean }` (copy every field from prototype lines 13–19); `agentForRound(round: number): Agent`; `pickTarget(agent: Agent, nodes: IdeaNode[], hits: Record<string, number>, rand?: () => number): IdeaNode`; `makeKids(target: IdeaNode, kids: {name, note}[], agent: Agent, ink: string, stamp?: string): IdeaNode[]`; `toTree(brain: Brain)`, `toMarkdown(brain: Brain): string`, `toJson(brain: Brain): string`; `fixtureBrain(): Brain` (sample brain plus one generated child, one link, one log entry and a synth).

- [ ] **Step 1: Failing tests**

`tests/unit/agents.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { AGENTS, agentForRound } from "@/lib/agents/roster";
import { pickTarget } from "@/lib/agents/pickTarget";
import { makeKids } from "@/lib/agents/makeKids";
import { sampleBrain } from "@/lib/sample/toolLibrary";
const nodes = sampleBrain("#111").nodes;
describe("roster", () => {
  it("has five agents in order", () => expect(AGENTS.map(a => a.id)).toEqual(["researcher","builder","customer","skeptic","strategist"]));
  it("only the skeptic is a critic", () => expect(AGENTS.filter(a => a.critic).map(a => a.id)).toEqual(["skeptic"]));
  it("cycles by round", () => expect(agentForRound(7).id).toBe("mechanism" === "x" ? "" : "mechanism".length ? AGENTS[7 % 5].id : ""));
});
describe("pickTarget", () => {
  it("prefers the agent's kinds and the thinnest node", () => {
    const builder = AGENTS[1];
    const t = pickTarget(builder, nodes, {}, () => 0);
    expect(t.kind).toBe("Mechanism");
    expect(t.depth).toBeGreaterThanOrEqual(1);
  });
  it("falls back to the core when nothing qualifies", () => expect(pickTarget(AGENTS[0], [nodes[0]], {}, () => 0).id).toBe("n0"));
});
describe("makeKids", () => {
  it("inherits kind, increments depth, flags critics", () => {
    const target = nodes.find(n => n.id === "b2")!;
    const kids = makeKids(target, [{ name: "a", note: "" }, { name: "b", note: "" }], AGENTS[3], "#111", "zz");
    expect(kids.map(k => k.id)).toEqual(["b2xzz0", "b2xzz1"]);
    expect(kids[0]).toMatchObject({ kind: "Risk", critic: true, depth: 2, by: "skeptic", color: "#9B3FB5" });
  });
  it("children of the core cycle kinds", () => {
    const kids = makeKids(nodes[0], Array(3).fill({ name: "x", note: "" }), AGENTS[0], "#111", "zz");
    expect(kids.map(k => k.kind)).toEqual(["Problem","People","Mechanism"]);
  });
});
```
`tests/unit/export.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toMarkdown, toJson } from "@/lib/export/markdown";
import { fixtureBrain } from "../fixtures/brain";
describe("exports", () => {
  const b = fixtureBrain();
  it("markdown has title, branch headings, nested bullets, notes, takeaway and links", () => {
    const md = toMarkdown(b);
    expect(md).toMatch(/^# Tool Library\n/);
    expect(md).toContain("## Idle ownership (Problem)");
    expect(md).toContain("  - **Garage clutter**");
    expect(md).toContain("> My note: keep");
    expect(md).toContain("## Key takeaway");
    expect(md).toContain("## Cross-links");
  });
  it("json is a nested tree with links and synthesis", () => {
    const j = JSON.parse(toJson(b));
    expect(j.branches[0].children[0].name).toBe("Garage clutter");
    expect(j.links[0]).toMatchObject({ from: "Garage clutter", to: "Deposit system" });
    expect(j.synthesis.verdict).toBeTruthy();
  });
});
```
Fix the silly `agentForRound` assertion to `expect(agentForRound(7).id).toBe("mechanism")` is wrong; use `expect(agentForRound(7).id).toBe("mechanism")` NO — the correct expectation is `expect(agentForRound(7).id).toBe(AGENTS[2].id)` i.e. `"customer"`. Write exactly: `it("cycles by round", () => expect(agentForRound(7).id).toBe("customer"));`

- [ ] **Step 2: Implement** — `roster.ts` copies the five agent objects from prototype lines 13–19 with `critic: true` only on skeptic and the briefs from `AGENTS-SPEC.md` §7 table; `pickTarget.ts` ports lines 176–185 with `rand` injectable; `makeKids.ts` ports lines 186–192 using `childId` from Task 2 and setting `userNote:''`, `critic: agent.critic`, `position`; `markdown.ts` ports lines 137–158 (`toTree`, `downloadMd`) and `json.ts` re-exports `toJson = b => JSON.stringify(toTree(b), null, 2)`; `tests/fixtures/brain.ts` builds the fixture (sample + child `b0c0xzz0` with `userNote: 'keep'`, link `{a:'b0c0', b:'b2c1', why:'w', by:'builder'}`, one log entry, synth `{path:['n0','b2','b2c1'], verdict:'Pursue Deposit system.', brief:'One. Two. Three.'}`).

- [ ] **Step 3: Run tests, commit**
Run: `npm test` → PASS.
```bash
git add lib tests && git commit -m "feat: agent roster, target picking, child generation and exports"
```

### Task 5: Pure layout math and theme table

**Files:**
- Create: `engine/layout.ts`, `engine/themes.ts`, `scripts/gen-theme-css.ts`
- Modify: `app/globals.css`
- Test: `tests/unit/layout.test.ts`, `tests/unit/themes.test.ts`

**Interfaces:**
- Produces: `type Vec3 = { x: number; y: number; z: number }`; `hash(s: string): number` (0..1, prototype line 376); `buildPeaks(nodes): Peak[]`; `heightAt(peaks, x, z): number`; `computeTargets(nodes: IdeaNode[], mode: Mode, t: number): Record<string, Vec3>`; `orbitParams(branchId: string, i: number): { R: number; tilt: number }`; `GROUND_Y: Record<Mode, number> = { constellation: -5.8, orbit: -3.2, terrain: 0 }`. `THEMES: Record<ThemeId, Theme>` with the exact fields from prototype lines 3–7; `themeCss(): string`.

- [ ] **Step 1: Failing tests**

`tests/unit/layout.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeTargets, heightAt, buildPeaks, hash, GROUND_Y } from "@/engine/layout";
import { sampleBrain } from "@/lib/sample/toolLibrary";
const nodes = sampleBrain("#111").nodes;
describe("layout", () => {
  it("core sits at origin in constellation and orbit", () => {
    for (const m of ["constellation", "orbit"] as const) expect(computeTargets(nodes, m, 0).n0).toEqual({ x: 0, y: 0, z: 0 });
  });
  it("constellation branches lie on the 6.8 sphere squashed to 4.4", () => {
    const t = computeTargets(nodes, "constellation", 0);
    for (const n of nodes.filter(n => n.depth === 1)) { const p = t[n.id]; const r = Math.hypot(p.x, p.z); expect(Math.abs(r * r / (6.8 * 6.8) + (p.y / 4.4) ** 2 - 1)).toBeLessThan(1e-6); }
  });
  it("orbit radii grow by 1.35", () => {
    const t = computeTargets(nodes, "orbit", 0);
    const r = (id: string) => Math.hypot(t[id].x, t[id].z);
    expect(r("b1") - r("b0")).toBeCloseTo(1.35, 5);
  });
  it("terrain core peak is 1.7 and heightAt decays", () => {
    const peaks = buildPeaks(nodes);
    expect(peaks[0]).toEqual({ x: 0, z: 0, a: 1.7 });
    expect(heightAt(peaks, 0, 0)).toBeGreaterThan(heightAt(peaks, 3, 3));
    expect(computeTargets(nodes, "terrain", 0).n0.y).toBeCloseTo(heightAt(peaks, 0, 0) + 0.9, 6);
  });
  it("depth-2 nodes sit 2.2 from their parent", () => {
    const t = computeTargets(nodes, "constellation", 0);
    const d = Math.hypot(t.b0c0.x - t.b0.x, t.b0c0.y - t.b0.y, t.b0c0.z - t.b0.z);
    expect(d).toBeCloseTo(2.2, 5);
  });
  it("hash is deterministic in [0,1)", () => { expect(hash("b0")).toBe(hash("b0")); expect(hash("b0")).toBeGreaterThanOrEqual(0); expect(hash("b0")).toBeLessThan(1); });
  it("ground y per mode", () => expect(GROUND_Y).toEqual({ constellation: -5.8, orbit: -3.2, terrain: 0 }));
});
```
`tests/unit/themes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { THEMES, themeCss } from "@/engine/themes";
import { readFileSync } from "node:fs";
describe("themes", () => {
  it("has the three themes with spec colours", () => {
    expect(THEMES.atlas.bg).toBe("#EEEAE0"); expect(THEMES.observatory.accent).toBe("#F2A33A"); expect(THEMES.blueprint.panel).toBe("#22479E");
  });
  it("generated css is checked in and current", () => {
    const css = readFileSync("app/theme.generated.css", "utf8");
    expect(css).toBe(themeCss());
  });
});
```
Run: `npm test` → FAIL.

- [ ] **Step 2: engine/layout.ts** — port prototype `layout` (lines 599–627) and `heightAt` (597) onto plain `Vec3` with a tiny inline vector helper (`sub`, `cross`, `normalize`, `scale`, `add`). Branch index `i` is the order of depth-1 nodes by `position`. Orbit params from `buildGraph` line 582 (`R = 3.6 + i*1.35`, `tilt = (hash(id+'t') - 0.5) * 0.5`). Peaks from line 588. The sibling angle uses `hash(parentId) * 6.28` exactly as line 616. Terrain y rule for depth ≥ 2 is line 621.

- [ ] **Step 3: engine/themes.ts + scripts/gen-theme-css.ts** — `THEMES` copied from prototype lines 3–7 (drop the `name` prefix letters into a `label` field). `themeCss()` emits for each theme `html[data-theme="<id>"]{--bg:…;--panel:…;…;--shadow5:…;--shadow3:…;--line:…;--ring:…}` plus a leading comment `/* generated by scripts/gen-theme-css.ts, do not edit */`. The script writes `app/theme.generated.css`. Add `@import "./theme.generated.css";` to `app/globals.css` and a Tailwind v4 `@theme inline { --color-bg: var(--bg); --color-panel: var(--panel); --color-ink: var(--ink); --color-muted: var(--muted); --color-soft: var(--soft); --color-faint: var(--faint); --color-accent: var(--accent); --color-hot: var(--hot); --color-rule: var(--rule); --color-rule2: var(--rule2); --font-serif: "Instrument Serif", serif; --font-mono: "JetBrains Mono", monospace; }`.

- [ ] **Step 4: Generate, test, commit**
Run: `npm run gen:theme && npm test` → PASS.
```bash
git add engine scripts app tests && git commit -m "feat: pure layout math and theme tokens with generated CSS"
```

---

## Phase 2 — Server: env, DB, identity, brain routes

### Task 6: Env validation, Drizzle schema, migrations, pglite test harness

**Files:**
- Create: `lib/env.ts`, `db/schema.ts`, `db/client.ts`, `db/migrate.ts`, `drizzle.config.ts`, `tests/routes/_harness.ts`, `docker/compose.dev.yml`
- Test: `tests/unit/env.test.ts`, `tests/routes/schema.test.ts`

**Interfaces:**
- Produces: `env` (validated object) and `loadEnv(raw: NodeJS.ProcessEnv)`; Drizzle tables `users, brains, nodes, links, logEntries` exactly per spec §4.2; `db` (postgres-js) and `type Db`; `getDb()` for routes; `makeTestDb(): Promise<Db>` in the harness, which creates a pglite instance, runs migrations from `db/migrations`, and returns a Drizzle instance with the same schema; `setTestDb(db)` so routes use it.

- [ ] **Step 1: Failing tests**

`tests/unit/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadEnv } from "@/lib/env";
const base = { DATABASE_URL: "postgres://x", COOKIE_SECRET: "a".repeat(32), LLM_BASE_URL: "https://api.ifm.ai/v1", LLM_MODEL: "m" };
describe("env", () => {
  it("defaults", () => { const e = loadEnv({ ...base, NODE_ENV: "test" }); expect(e.RATE_LIMIT_PER_HOUR).toBe(60); expect(e.LLM_API_KEY).toBe(""); });
  it("rejects short secret", () => expect(() => loadEnv({ ...base, COOKIE_SECRET: "short" })).toThrow());
  it("rejects the example secret in production", () => expect(() => loadEnv({ ...base, NODE_ENV: "production", COOKIE_SECRET: "change-me-change-me-change-me-change-me" })).toThrow(/example/));
});
```
`tests/routes/schema.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { makeTestDb } from "./_harness";
import { users, brains, nodes } from "@/db/schema";
describe("schema", () => {
  let db: Awaited<ReturnType<typeof makeTestDb>>;
  beforeAll(async () => { db = await makeTestDb(); });
  it("inserts a user, brain and node with composite key", async () => {
    const [u] = await db.insert(users).values({}).returning();
    const [b] = await db.insert(brains).values({ userId: u.id, number: 1, title: "T", summary: "" }).returning();
    await db.insert(nodes).values({ brainId: b.id, id: "n0", name: "T", note: "", kind: "Core", parentId: null, depth: 0, color: "#000", position: 0 });
    await expect(db.insert(nodes).values({ brainId: b.id, id: "n0", name: "dup", note: "", kind: "Core", parentId: null, depth: 0, color: "#000", position: 0 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: lib/env.ts** — Zod object per spec §13; `loadEnv` throws with a readable message; `env = loadEnv(process.env)` evaluated lazily via a getter so tests can import without a real env (`export const env = new Proxy({}, { get: (_, k) => loadEnv(process.env)[k] })` or a memoised function `getEnv()`; choose `getEnv()` and use it everywhere).

- [ ] **Step 3: db/schema.ts** — spec §4.2 using `pgTable`, `uuid().defaultRandom()`, `timestamp({ withTimezone: true }).defaultNow()`, `jsonb` for `synth`, composite primary keys via `primaryKey({ columns })`, `onDelete: 'cascade'` on every `brainId` reference and on `brains.userId`. `drizzle.config.ts` points at `db/schema.ts` and `db/migrations`. Run `npm run db:generate` to produce the first migration and commit it.

- [ ] **Step 4: db/client.ts and db/migrate.ts** — `getDb()` returns a singleton `drizzle(postgres(env.DATABASE_URL), { schema })` unless `setTestDb` was called. `migrate.ts` acquires `pg_advisory_lock(727272)` then runs `migrate(db, { migrationsFolder: 'db/migrations' })`, then unlocks; it is runnable with `tsx` in dev and compiled to `db/migrate.js` for the Docker image (Task 20).

- [ ] **Step 5: tests/routes/_harness.ts**
```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import { setTestDb } from "@/db/client";
export async function makeTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "db/migrations" });
  setTestDb(db as never);
  return db;
}
```
`docker/compose.dev.yml`: a single `db` service `postgres:16-alpine`, env `POSTGRES_USER=atlas POSTGRES_PASSWORD=atlas POSTGRES_DB=atlas`, port `5432:5432`, volume `ab_dev_pg`.

- [ ] **Step 6: Run, commit**
Run: `npm test` → PASS.
```bash
git add -A && git commit -m "feat: env validation, Drizzle schema, migrations and pglite test harness"
```

### Task 7: Identity (cookie), rate limiter, /api/me, /api/me/restore, /api/health

**Files:**
- Create: `lib/identity.ts`, `lib/rateLimit.ts`, `lib/api.ts`, `app/api/me/route.ts`, `app/api/me/restore/route.ts`, `app/api/health/route.ts`, `lib/brains/repo.ts`
- Test: `tests/unit/identity.test.ts`, `tests/unit/rateLimit.test.ts`, `tests/routes/me.test.ts`

**Interfaces:**
- Produces: `sign(uuid, secret): string`, `verify(value, secret): string | null`, `requireUser(req: Request): Promise<{ userId: string; setCookie?: string }>`, `cookieHeader(uuid): string`; `RateLimiter(perHour).take(key): { ok: boolean; retryAfter: number }`; `json(data, init?)`, `fail(status, message)`, `withUser(handler: (req, ctx: { userId, params }) => Promise<Response>)` which also forwards the `Set-Cookie` and catches Zod errors into 400; `repo.listBrains(db, userId)`, `repo.createBrain(db, userId, input)`, `repo.getBrain(db, userId, id)`, `repo.ensureSample(db, userId)`.

- [ ] **Step 1: Failing tests**

`tests/unit/identity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sign, verify } from "@/lib/identity";
const S = "s".repeat(32);
describe("identity cookie", () => {
  it("round-trips", () => { const id = "123e4567-e89b-12d3-a456-426614174000"; expect(verify(sign(id, S), S)).toBe(id); });
  it("rejects tamper and wrong secret", () => { const v = sign("123e4567-e89b-12d3-a456-426614174000", S); expect(verify(v.slice(0, -1) + "0", S)).toBeNull(); expect(verify(v, "t".repeat(32))).toBeNull(); expect(verify("garbage", S)).toBeNull(); });
});
```
`tests/unit/rateLimit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/lib/rateLimit";
describe("RateLimiter", () => {
  it("allows N then blocks with retryAfter", () => {
    const rl = new RateLimiter(2, () => 0);
    expect(rl.take("u").ok).toBe(true); expect(rl.take("u").ok).toBe(true);
    const r = rl.take("u"); expect(r.ok).toBe(false); expect(r.retryAfter).toBeGreaterThan(0);
    expect(rl.take("v").ok).toBe(true);
  });
});
```
`tests/routes/me.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { makeTestDb } from "./_harness";
import { GET } from "@/app/api/me/route";
process.env.COOKIE_SECRET = "s".repeat(32); process.env.DATABASE_URL = "postgres://unused"; process.env.LLM_BASE_URL = "http://x"; process.env.LLM_MODEL = "m";
describe("GET /api/me", () => {
  beforeAll(async () => { await makeTestDb(); });
  it("first visit sets cookie and seeds the sample brain", async () => {
    const res = await GET(new Request("http://t/api/me"));
    expect(res.headers.get("set-cookie")).toMatch(/^ab_uid=.*HttpOnly/);
    const body = await res.json();
    expect(body.data.brains).toHaveLength(1);
    expect(body.data.brains[0]).toMatchObject({ number: 1, title: "Tool Library", nodeCount: 24 });
  });
  it("second visit with the cookie reuses identity and does not reseed", async () => {
    const first = await GET(new Request("http://t/api/me"));
    const cookie = first.headers.get("set-cookie")!.split(";")[0];
    const second = await GET(new Request("http://t/api/me", { headers: { cookie } }));
    expect(second.headers.get("set-cookie")).toBeNull();
    const a = (await first.json()).data.user.id, b = (await second.json()).data.user.id;
    expect(a).toBe(b);
    expect((await second.json()).data.brains).toHaveLength(1);
  });
});
```
(The second `await second.json()` will throw because the body is consumed; store the parsed body once. Write it as `const body2 = await second.json();` and assert from `body2`.)

- [ ] **Step 2: Implement** — `identity.ts` with `node:crypto` HMAC-SHA256 and `timingSafeEqual`; `requireUser` parses the `cookie` header, verifies, checks the user exists (else treats as missing), inserts a user when missing and returns `setCookie`. `rateLimit.ts`: fixed-window per key with injectable clock. `lib/api.ts`: `withUser` wraps handlers, catches `ZodError` → 400, other errors → 500 with a generic message and `console.error`. `repo.ts`: `ensureSample` inserts `sampleBrain('#1B1A17')` as number 1 when the user has no brains; `listBrains` returns `{ id, number, title, nodeCount, updatedAt }` ordered by number desc. `GET /api/me` → `{ user, brains }`. `POST /api/me/restore` validates `{ id: uuid }`, 404 if unknown, else sets the cookie and returns `{ ok: true }`. `GET /api/health` runs `select 1` and returns `{ ok: true, db }`.

- [ ] **Step 3: Run, commit**
Run: `npm test` → PASS.
```bash
git add -A && git commit -m "feat: anonymous cookie identity, rate limiter, /api/me and /api/health"
```

### Task 8: Brain CRUD, node and link routes, atomic rounds and takeaway

**Files:**
- Create: `app/api/brains/route.ts`, `app/api/brains/[id]/route.ts`, `app/api/brains/[id]/nodes/route.ts`, `app/api/brains/[id]/links/route.ts`, `app/api/brains/[id]/rounds/route.ts`, `app/api/brains/[id]/takeaway/route.ts`, `lib/brains/schemas.ts`
- Modify: `lib/brains/repo.ts`
- Test: `tests/routes/brains.test.ts`

**Interfaces:**
- Produces: Zod bodies `CreateBrainBody { title, summary, nodes: IdeaNodeSchema[], links?: CrossLinkSchema[] }`, `PatchBrainBody`, `AddNodesBody { nodes }`, `PatchNodeBody { id, name?, note?, userNote? }`, `DeleteNodeBody { id }`, `AddLinksBody { links }`, `RoundBody { round, nodes, links, log: LogEntry }`, `TakeawayBody { synth, log }`; repo functions `createBrain, getBrain, patchBrain, deleteBrain, addNodes, patchNode, deleteSubtree, addLinks, applyRound, setTakeaway`, all `(db, userId, …)` and all throwing `NotFound` for foreign brains. `getBrain` returns the full `Brain` (nodes ordered by depth then position, links, log ordered by seq).

- [ ] **Step 1: Failing tests** — `tests/routes/brains.test.ts` with helpers `asUser()` that calls `GET /api/me` once and returns the cookie, and `call(method, path, body, cookie)` that invokes the exported route handler with `{ params: Promise.resolve({ id }) }`. Cases: (a) create assigns numbers 2, 3 after the sample; (b) `GET /api/brains/:id` with user B's cookie → 404; (c) PATCH node `userNote` persists; (d) DELETE subtree on `b0` removes `b0c0..` and refuses `n0` with 400; (e) rounds route inserts nodes, links and log in one call and a body whose link references a missing node id returns 400 and inserts nothing (count nodes before/after); (f) takeaway sets `synth` and appends a log entry with tag `Takeaway`; (g) DELETE brain cascades (nodes count for that brain is 0).

- [ ] **Step 2: Implement** per spec §6 using `db.transaction` for `applyRound`, `setTakeaway`, `createBrain` (number assignment with `select max(number)`), `deleteSubtree` (walk descendants in SQL via a loop over parent ids, or a recursive CTE `WITH RECURSIVE sub AS (...)`). Validate link ids exist within the transaction and throw a `BadRequest` error the wrapper maps to 400.

- [ ] **Step 3: Run, commit**
Run: `npm test` → PASS.
```bash
git add -A && git commit -m "feat: brain, node, link, round and takeaway routes with ownership scoping"
```

### Task 9: LLM provider and the four /api/llm routes

**Files:**
- Create: `lib/llm/provider.ts`, `lib/llm/generate.ts`, `app/api/llm/map/route.ts`, `app/api/llm/expand/route.ts`, `app/api/llm/agent-round/route.ts`, `app/api/llm/takeaway/route.ts`, `scripts/eval.ts`, `scripts/eval-prompts.json`
- Test: `tests/unit/generate.test.ts`, `tests/routes/llm.test.ts`

**Interfaces:**
- Produces: `chat(input: { system: string; user: string }, deps?: { fetch }): Promise<{ text: string; ms: number; model: string }>`; `generate<T>(schema: ZodType<T>, system, user, fallback: () => T, deps?): Promise<{ data: T; meta: { source: 'model'|'fallback'; model?: string; ms?: number; attempts?: number; error?: string } }>`; route bodies `MapBody { idea }`, `ExpandBody { title, summary, path: string[], existing: string[], question? }`, `AgentRoundBody { agent: AgentId, idea, mapLines, links: CrossLink[], target: IdeaNode, nodes: IdeaNode[] }`, `TakeawayBody { idea, mapLines, links, nodes }`. Responses `{ data, meta }`.

- [ ] **Step 1: Failing tests**

`tests/unit/generate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generate } from "@/lib/llm/generate";
const S = z.object({ a: z.number() });
const fetchWith = (replies: string[]) => { let i = 0; return (async () => new Response(JSON.stringify({ choices: [{ message: { content: replies[i++] } }] }), { status: 200 })) as unknown as typeof fetch; };
const envOk = { LLM_API_KEY: "k", LLM_BASE_URL: "http://x", LLM_MODEL: "m" };
describe("generate", () => {
  it("returns model data on first valid reply", async () => {
    const r = await generate(S, "s", "u", () => ({ a: 0 }), { fetch: fetchWith(['{"a":1}']), env: envOk });
    expect(r.data).toEqual({ a: 1 }); expect(r.meta).toMatchObject({ source: "model", attempts: 1 });
  });
  it("retries once with the errors, then falls back", async () => {
    const r = await generate(S, "s", "u", () => ({ a: 0 }), { fetch: fetchWith(['{"a":"x"}', 'not json']), env: envOk });
    expect(r.data).toEqual({ a: 0 }); expect(r.meta.source).toBe("fallback"); expect(r.meta.attempts).toBe(2);
  });
  it("falls back immediately without a key", async () => {
    const r = await generate(S, "s", "u", () => ({ a: 0 }), { fetch: fetchWith([]), env: { ...envOk, LLM_API_KEY: "" } });
    expect(r.meta).toMatchObject({ source: "fallback", attempts: 0 });
  });
});
```
`tests/routes/llm.test.ts`: with no key, `POST /api/llm/map` `{ idea: "A tool library" }` returns 200 with `meta.source === 'fallback'` and `MapReplySchema` passes on `data`; with `RATE_LIMIT_PER_HOUR=1` the second call returns 429 with a `Retry-After` header.

- [ ] **Step 2: Implement** — `provider.ts` builds the request per spec §7 (`response_format`, `chat_template_kwargs` only when reasoning effort set), throws `ProviderError(status, body.slice(0,300))`. `generate.ts` implements call → `extractJson` → `safeParse` → retry with issues → fallback, never throws. Each route: `withUser`, rate limit (`429` + `Retry-After`), parse body, build prompt via `PROMPTS`, call `generate` with the matching `fallback.*`, for agent-round and takeaway additionally verify referenced ids exist in `body.nodes` (filter invalid links; if takeaway leaf is unknown, use `fallback.takeaway`). `scripts/eval.ts` runs the four generators over `scripts/eval-prompts.json` (ten ideas from idea-map-3d's list) and prints pass rate, retries and latency.

- [ ] **Step 3: Run, commit**
Run: `npm test` → PASS.
```bash
git add -A && git commit -m "feat: OpenAI-compatible LLM provider, validated generation with fallback, llm routes and eval script"
```

---

## Phase 3 — Engine port (Three.js)

Engine tasks are ports. The implementer reads the prototype lines named in each task and reproduces behaviour and numbers exactly, restructured into the named module with the named API. Three.js code is not unit-tested; each task ends with a small Vitest test that imports the module under `jsdom` with a WebGL stub only to assert the module loads and exposes its API, plus a manual check in the dev page added in Task 13.

### Task 10: AtlasScene shell and ground

**Files:**
- Create: `engine/AtlasScene.ts`, `engine/ground.ts`, `engine/webgl-stub.ts` (test only), `tests/unit/engine-load.test.ts`

**Interfaces:**
- Produces: `class AtlasScene { constructor(opts: { theme: ThemeId; mode: Mode }); mount(el: HTMLElement, labelLayer: HTMLElement, agentLabelLayer: HTMLElement): void; dispose(): void; setTheme(t: ThemeId): void; setMode(m: Mode): void; onFrame(cb: (dt: number, now: number) => void): () => void; readonly three: { scene, camera, renderer, controls } }`; `createGround(three, theme): Ground` with `update(mode, dt)`, `recolor(theme)`, `dispose()`.

- [ ] **Step 1: Port** — renderer, camera, controls, fog and resize from prototype lines 410–445 and 539–544; the animation loop from `tick` (628) but only the parts that advance time, ease ground y (`GROUND_Y` from `engine/layout.ts`), update controls and render; `componentWillUnmount` (402–409) becomes `dispose()`. Rings and spokes (lines 427–441), ridgelines (444–452) and orbit rings (582–584) go into `ground.ts`. Use `three/examples/jsm/controls/OrbitControls.js`.

- [ ] **Step 2: Load test**
```ts
import { describe, it, expect } from "vitest";
// @vitest-environment jsdom
import { AtlasScene } from "@/engine/AtlasScene";
describe("engine modules load", () => { it("exposes the API", () => { expect(typeof AtlasScene).toBe("function"); expect(AtlasScene.prototype.mount).toBeTypeOf("function"); }); });
```
Run: `npm test` → PASS.

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(engine): scene shell, loop, controls and ground"`

### Task 11: Node graph, links, drop lines, reticle, path highlight, labels

**Files:**
- Create: `engine/nodes.ts`, `engine/labels.ts`
- Modify: `engine/AtlasScene.ts`

**Interfaces:**
- Produces: `AtlasScene.setBrain(brain: Brain, opts?: { fresh: boolean })`, `select(id: string | null)`, `setShowPath(on: boolean)`, `onPick(cb: (id: string | null) => void)`, `positionOf(id): Vec3 | undefined`. `createNodeGraph(three, theme)` with `rebuild(brain, fresh)`, `layoutTick(mode, now, dt)`, `recolor(theme)`, `select(id)`, `setPath(ids)`, `dispose()`; `createLabels(layer)` with `sync(nodes)`, `update(camera, positions, selected, ancestorsAndDescendants)`, `dispose()`.

- [ ] **Step 1: Port** — `buildGraph` (545–595) → `rebuild` (diff by id, dispose removed meshes, spawn new ones at the parent with the stagger `depth*260 + index*25`); link buffer, drop lines, crosses, cross-link dashed arcs with reveal animation (`revealing`), path highlight and reticle from `tick` (628–775, the node/line parts); picking via raycaster from lines 525–538 with the same drag-vs-click guard; label overlay creation from `buildGraph` and the per-frame projection and collision pass from `tick` → `labels.ts`. Positions come from `computeTargets(nodes, mode, now)` each frame and are lerped with `k = 1 - exp(-dt/260)`.

- [ ] **Step 2: Load test** — extend `engine-load.test.ts` to import `@/engine/nodes` and `@/engine/labels` and assert the factory functions exist. Run `npm test` → PASS.

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(engine): node graph, links, reticle, path highlight and label overlay"`

### Task 12: Agent characters and choreography

**Files:**
- Create: `engine/agents.ts`
- Modify: `engine/AtlasScene.ts`

**Interfaces:**
- Produces: `AtlasScene.agent(event: AgentEvent): Promise<void>` where `AgentEvent = { type: 'plan'; agent: AgentId; target: string } | { type: 'travel'; agent: AgentId; path: string[] } | { type: 'think'; agent: AgentId; target: string; verb: string } | { type: 'spawn'; agent: AgentId; target: string } | { type: 'link'; agent: AgentId; a: string; b: string } | { type: 'done'; agent: AgentId }`; `createAgents(three, agentLabelLayer, roster)` with `show(id, at: Vec3)`, `walk(id, points: Vec3[]): Promise<void>`, `think(id, on: boolean)`, `burst(id)`, `hide(id): Promise<void>`, `setLabel(id, text)`, `tick(dt, now, camera)`, `dispose()`.

- [ ] **Step 1: Port** — shapes, eyes, bubble and probe construction from lines 468–524; `walk` (201–208), `arcTo` (209–211), `burst` (212–217), `styleProbe` (355–359); the per-frame agent part of `tick` (bob, wobble, blink, pupil drift, route following, bubble dots, bursts, label positioning). The `plan` event shows the agent at `n0` with the pop 0 → 1.25 → 1.15; `travel` resolves when the route ends; `think` toggles the bubble and sets the label verb; `spawn` triggers `burst` and lets the node graph's stagger handle children; `link` draws the arc with the 1500 ms reveal and resolves after it; `done` shrinks and hides.

- [ ] **Step 2: Load test** — extend the engine load test for `@/engine/agents`. Run `npm test` → PASS.

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(engine): agent characters, travel, thinking and link arcs"`

### Task 13: Engine dev page for manual verification

**Files:**
- Create: `app/dev/engine/page.tsx` (client component; only in development, returns `notFound()` in production), `components/atlas/Atlas.tsx`

**Interfaces:**
- Produces: `<Atlas brain={Brain} mode theme selected showPath onPick onReady={(scene) => void} />` which mounts `AtlasScene` in a ref with two overlay divs and pushes prop changes into it; disposes on unmount.

- [ ] **Step 1: Implement** `Atlas.tsx` (~60 lines, `'use client'`), and the dev page that renders it with `sampleBrain`, three buttons for mode, three for theme, a button that runs a scripted agent sequence (plan → travel to `b2c2` → think 1.2 s → spawn two fake children by calling `setBrain` with an extended brain → link `b2c2`→`b4c0` → done).

- [ ] **Step 2: Manual check** — `npm run dev`, open `/dev/engine`, verify: 24 labelled nodes, three modes animate without jumps, three themes recolor in place, click selects and shows the reticle, the scripted agent sequence plays fully, no console errors, and `npm run typecheck && npm run lint` pass. Fix anything the port got wrong against the prototype opened in a browser side by side.

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat: Atlas client component and engine dev page"`

---

## Phase 4 — Client state, sync, runner

### Task 14: Zustand store and optimistic sync

**Files:**
- Create: `lib/store.ts`, `lib/sync.ts`, `lib/apiClient.ts`
- Test: `tests/unit/store.test.ts`

**Interfaces:**
- Produces: `useStore` with state per spec §10 and actions: `hydrate(me)`, `openBrain(brain)`, `select(id)`, `setMode`, `setTheme`, `setRounds`, `toggleLeft`, `setFocus`, `setOpenDropdown`, `setTakeawayOpen`, `setLogOpen`, `setRun(partial)`, `setStatus(text)`, `setProvider(meta)`, `setSyncError(err | null)`; `apiClient` typed functions for every route (`me()`, `restore(id)`, `listBrains()`, `createBrain(body)`, `getBrain(id)`, `patchBrain`, `deleteBrain`, `addNodes`, `patchNode`, `deleteNode`, `addLinks`, `applyRound`, `setTakeaway`, `llm.map`, `llm.expand`, `llm.agentRound`, `llm.takeaway`); `sync` mutations per spec §10, each: update store → call api (retry once on `TypeError`) → on failure `setSyncError({ label, retry })`.

- [ ] **Step 1: Failing test** — `tests/unit/store.test.ts` with a fake `apiClient` injected via `sync.configure({ api })`: `editNode` updates the node name in the store synchronously, calls `api.patchNode` once; when `api.patchNode` rejects twice, `syncError` is set with a `retry` that, when invoked and `api` now resolves, clears the error. `deleteSubtree('b0')` removes `b0` and its children from `brain.nodes` and clears `selected`.

- [ ] **Step 2: Implement**, **Step 3: Run tests → PASS**, **Step 4: Commit** `git commit -m "feat: client store, typed API client and optimistic sync"`

### Task 15: Agent runner

**Files:**
- Create: `lib/agents/runner.ts`
- Test: `tests/unit/runner.test.ts`

**Interfaces:**
- Produces: `class AgentRunner { constructor(deps: { api: { agentRound, takeaway, applyRound, setTakeaway }; getBrain: () => Brain; apply: (patch) => void; scene: (event: AgentEvent) => Promise<void>; sleep?: (ms) => Promise<void>; now?: () => number }); start(brainId: string, rounds: number): Promise<void>; pause(): void; on(event: 'phase'|'status'|'log'|'finished'|'error', cb): () => void; readonly running: boolean }`.

- [ ] **Step 1: Failing test** — fake scene that records events; fake api that returns a fixed `AgentRoundReply` and `TakeawayReply`; `getBrain` over a mutable sample brain; `apply` merges nodes/links/log. Assert for `start(id, 2)`: scene events in order `plan, travel, think, spawn, link?, done` for round 1 and 2, then `plan, think, done` for the takeaway; `applyRound` called twice with rounds 1 and 2; `setTakeaway` called once with a `path` starting at `n0`; `pause()` after round 1 (triggered from the `log` event) stops before round 2 and emits no takeaway; a brain id mismatch (`getBrain` returns a different id) stops the run.

- [ ] **Step 2: Implement** per spec §8, using `pickTarget`, `makeKids`, `agentForRound`, `mapLines`, and the hits map (`hits[target.id]++` per round as prototype line 177).

- [ ] **Step 3: Run tests → PASS. Commit** `git commit -m "feat: agent runner with round choreography and persistence"`

---

## Phase 5 — UI

### Task 16: UI primitives, fonts, app shell, frame, toolbar

**Files:**
- Create: `components/ui/Panel.tsx`, `Button.tsx`, `Pill.tsx`, `Dropdown.tsx`, `Textarea.tsx`, `TwoStepDelete.tsx`, `AgentIcon.tsx`, `components/panels/Toolbar.tsx`, `components/panels/Hint.tsx`, `components/panels/FocusExit.tsx`, `components/ThemeProvider.tsx`
- Modify: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Produces: primitives styled per spec §11 using Tailwind classes that reference the token colours (`bg-panel text-ink border-ink`), `shadow-[var(--shadow5)]`; `AgentIcon({ agent, size })` renders the 18×16 SVG from `roster.icon/eyes/pupils`; `Dropdown({ id, label, children })` reads/writes `ui.openDropdown` so only one is open; `Toolbar` with View, Design, Settings (rounds 5/10/20, downloads, provider readout) and Focus; `ThemeProvider` sets `html[data-theme]` from the store and persists prefs to `localStorage['ab_prefs']`.

- [ ] **Step 1: Implement** fonts via `next/font/google` (`Instrument_Serif` weights 400 normal and italic, `JetBrains_Mono`), the double hairline frame (two fixed `div`s inset 14 px and 19 px with `border-rule`/`border-rule2`), the page shell with `<Atlas/>` full-screen and the panels above it (`z-[2]`, labels overlay `z-[1]`).

- [ ] **Step 2: Verify** `npm run typecheck && npm run lint && npm run build`. Manual: toolbar dropdowns are mutually exclusive; theme switch updates both CSS and the scene.

- [ ] **Step 3: Commit** `git commit -m "feat(ui): primitives, fonts, frame and toolbar"`

### Task 17: Left panel (brain dropdown, takeaway card, agent team, legend, identity)

**Files:**
- Create: `components/panels/LeftPanel.tsx`, `BrainDropdown.tsx`, `TakeawayCard.tsx`, `AgentTeam.tsx`, `Legend.tsx`, `IdentityLine.tsx`

- [ ] **Step 1: Implement** per spec §11 and `AGENTS-SPEC.md` §4 "Left panel": dropdown lists brains (`№ 001`, title, node count, current highlighted) + "+ New second brain"; « hides the panel, » {title} tab restores; title 46 px serif, italic summary; TakeawayCard with Show/Hide path and collapse, auto-opens when `synth` changes; AgentTeam rows with `AgentIcon`, status (`idle` or `${verb} ${nodeName}`), per-agent node count (`nodes.filter(n => n.by === id).length`), phase bar Plan · Diverge · Connect · Takeaway; Legend rows select the branch; IdentityLine shows `Your ID: <8 chars>`, copy button, and a Restore input calling `apiClient.restore` then reloading `me`.

- [ ] **Step 2: Verify** typecheck, lint, build; manual check in the browser. **Step 3: Commit** `git commit -m "feat(ui): left panel"`

### Task 18: Node card, agent log, input bar, focus mode, wiring

**Files:**
- Create: `components/panels/NodeCard.tsx`, `AgentLog.tsx`, `InputBar.tsx`, `components/AppController.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Implement** NodeCard (kind and level, path, name with Edit → inline fields Save/Cancel via `sync.editNode`, AI note, My notes textarea with "editing…"/"saved" saved on blur and on selection change via `sync.saveUserNote`, child chips, cross-links, Expand this node → calls `apiClient.llm.expand` then `sync.addChildren`, TwoStepDelete → `sync.deleteSubtree`, hidden on core); AgentLog (when nothing selected; entries with `AgentIcon`, name, tag, thought; click selects node; capped height, collapse); InputBar (label New brain / Ask node, serif 24 px input, Map it → / Grow →, ▶ Run agents / ❚❚ Pause, status line above showing run status, provider, or the "Not saved · Retry" chip); `AppController` is a client component that on mount calls `apiClient.me()`, hydrates the store, opens the most recent brain, owns the single `AgentRunner` instance wired to the scene from `Atlas.onReady`, handles Esc for focus, and switches brains (pausing the runner).

- [ ] **Step 2: Verify** full flow in the browser with the fallback provider: new brain, select, edit, note, expand, delete, run 5 rounds, takeaway appears, path highlights, downloads produce files. `npm run typecheck && npm run lint && npm run build` pass.

- [ ] **Step 3: Commit** `git commit -m "feat(ui): node card, agent log, input bar and app controller"`

### Task 19: 3D HTML export

**Files:**
- Create: `lib/export/html3d.ts`, `scripts/build-export-layout.ts`, `public/export/layout.js` (generated, committed)
- Modify: `package.json` (`"prebuild": "tsx scripts/build-export-layout.ts"`), Toolbar download handler
- Test: `tests/unit/html3d.test.ts`

**Interfaces:**
- Produces: `toHtml3d(brain: Brain, theme: ThemeId, mode: Mode, layoutJs: string): string` producing a standalone page (prototype `VIEWER`, line 173, and `downloadHtml`, 159–172) that embeds the brain JSON (`<` escaped as `<`), inlines `layoutJs`, loads three from `https://unpkg.com/three@<installed version>/build/three.module.js` via an import map, and offers the View switch.

- [ ] **Step 1: Failing test** — output contains `<!doctype html>`, the title, the embedded JSON with `"id":"n0"`, no raw `</script>` inside the JSON, and the `computeTargets` function name from the inlined layout.
- [ ] **Step 2: Implement**; `scripts/build-export-layout.ts` bundles `engine/layout.ts` to an IIFE with `esbuild` (add `esbuild` dev dep) exposing `window.AtlasLayout`.
- [ ] **Step 3: Run tests → PASS; manual: download opens standalone and matches the app. Commit** `git commit -m "feat: standalone 3D HTML export"`

---

## Phase 6 — Deployment, security, docs, CI, e2e

### Task 20: Dockerfile, compose, Caddy, security headers, secrets hook

**Files:**
- Create: `docker/Dockerfile`, `docker/compose.yml`, `docker/Caddyfile`, `scripts/check-secrets.sh`, `scripts/install-hooks.sh`, `.dockerignore`
- Modify: `next.config.ts` (`output: 'standalone'`, headers per spec §13), `package.json` (`"build:migrate": "esbuild db/migrate.ts --bundle --platform=node --outfile=.next/standalone/db/migrate.js"`, run in Dockerfile)
- Test: `tests/unit/headers.test.ts` (imports `next.config.ts` and asserts the CSP string and `frame-ancestors 'none'`)

- [ ] **Step 1: Implement** per spec §13. Dockerfile stages: deps → build (`npm ci`, `npm run build`, `npm run build:migrate`) → runner (`node:22-alpine`, `USER node`, copies `.next/standalone`, `.next/static`, `public`, `CMD ["sh","-c","node db/migrate.js && node server.js"]`, `HEALTHCHECK CMD wget -qO- http://localhost:3000/api/health || exit 1`). compose: `app` (build context `..`, env from `.env`, depends on `db` healthy), `db` (`postgres:16-alpine`, volume, healthcheck `pg_isready`), `caddy` (`caddy:2`, ports 80/443, volumes for data and config, `Caddyfile`: `{$DOMAIN} { reverse_proxy app:3000 }`). `check-secrets.sh` greps `git diff --cached` for `sk-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|LLM_API_KEY=.+` and exits 1 with the offending line. `install-hooks.sh` symlinks it to `.git/hooks/pre-commit`.

- [ ] **Step 2: Verify** `docker build -f docker/Dockerfile .` succeeds; `docker compose -f docker/compose.yml config` validates; run `scripts/install-hooks.sh` and confirm a staged file containing `LLM_API_KEY=abc` is rejected. `npm test` → PASS.

- [ ] **Step 3: Commit** `git commit -m "chore: Docker, Compose, Caddy, security headers and secrets pre-commit hook"`

### Task 21: Open-source docs and CI

**Files:**
- Create: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE`, `.github/workflows/ci.yml`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/screenshot.png` placeholder note in README

- [ ] **Step 1: Write** per spec §14. README sections in order: title + one-line pitch + badges (CI, license); screenshot and GIF (paths `docs/media/screenshot.png`, `docs/media/demo.gif`, with a note "record before release"); What it does (three sentences); Quick start (commands from spec §14); Configuration table (every env var, default, purpose); Run with K2 Horizon / Run with Ollama snippets; How it works (request flow text diagram: input → `/api/llm/map` → Zod → store → `/api/brains` → Postgres; runner → scene events); Project structure; Scripts table; Testing; Deployment (compose up, Caddy, domain, backups: `docker compose exec db pg_dump`); Privacy note (anonymous cookie, what is stored, how to delete: the Delete brain button and clearing the cookie); Roadmap (spec §16); Contributing; License. CI: node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `gitleaks/gitleaks-action@v2`.

- [ ] **Step 2: Commit** `git commit -m "docs: README, contributing, security policy, templates and CI"`

### Task 22: Playwright e2e and final verification

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/app.spec.ts`

- [ ] **Step 1: Write the smoke spec** per spec §15 (fallback provider, `LLM_API_KEY` empty, `DATABASE_URL` from compose.dev): load shows "Tool Library"; type "A night market for repair services" + Enter → within 5 s a label containing "Night" or "Market" appears and the brain dropdown shows "№ 002"; click a branch label → node card visible; click "Expand this node" → child chip count increases; switch View to Orbit and Design to Observatory → no console errors (collect `page.on('console')` errors and assert empty); Focus → panels hidden, Esc → visible; Settings → Download Markdown → a download event with `.md`; at viewport 900×540 the bounding boxes of the left panel, toolbar, input bar and node card do not intersect.

- [ ] **Step 2: Run** `docker compose -f docker/compose.dev.yml up -d && npm run db:migrate && npx playwright install chromium && npm run test:e2e` → PASS. Fix failures.

- [ ] **Step 3: Final gate** — `npm run lint && npm run typecheck && npm test && npm run build` all pass; `git status` clean; no `.env` tracked (`git ls-files | grep -E '^\.env'` prints only `.env.example`).

- [ ] **Step 4: Commit and tag** `git commit -m "test: Playwright smoke suite" && git tag v0.1.0`

---

## Self-review notes

- Spec coverage: §3 structure → Tasks 1–21; §4 → 2, 6; §5 → 7; §6 → 7–9; §7 → 3, 9; §8 → 4, 15; §9 → 10–13; §10 → 14; §11 → 16–18; §12 → 4, 19; §13 → 6, 20; §14 → 21; §15 → every task's tests plus 22.
- Names used across tasks: `computeTargets`, `heightAt`, `buildPeaks`, `hash`, `GROUND_Y` (Task 5) are consumed by Tasks 11, 19; `AgentEvent` (Task 12) by 15, 18; `apiClient` (14) by 15, 17, 18; `generate` (9) by routes; `fromBranches`/`childId` (2) by 3, 4, 7.
