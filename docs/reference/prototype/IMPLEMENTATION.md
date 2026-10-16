# Idea Atlas — Implementation Brief for Claude Code

Build a production version of **Idea Atlas**: the user types an idea, an LLM breaks it into a tree, and Three.js renders the tree as an interactive 3D map. The reference prototype is `Idea Atlas.html` (open it in a browser). Match its behavior and visuals.

## Stack
- React + TypeScript + Vite
- `three` (r160+) with `OrbitControls`. Plain Three.js is fine; `@react-three/fiber` is optional.
- Anthropic Messages API through a **server route** (`/api/map`, `/api/expand`). Keep the API key server-side. Model: `claude-haiku-4-5` (or Sonnet), JSON-only replies.
- Persistence: `localStorage` (key `idea-atlas-history`, max 10 second brains). On load, reopen the most recent brain; if none exist, seed with the sample brain.

## Data model
```ts
type Kind = 'Core' | 'Problem' | 'People' | 'Mechanism' | 'Value' | 'Risk' | 'Next step';
interface IdeaNode { id: string; name: string; note: string; kind: Kind; parent: string | null; depth: number; color: string; }
interface SecondBrain { title: string; summary: string; nodes: IdeaNode[]; plate: number; created: number; }
```
The flat list is the source of truth. The root is `id: 'n0'`, `depth: 0`. Depth-1 nodes are branches; deeper nodes inherit the color and kind of their branch.

Kind colors: Problem `#E0482B`, People `#2F5BD8`, Mechanism `#3E8E5A`, Value `#D49A1E`, Risk `#9B3FB5`, Next step `#1A8C8C`.

## LLM prompts
**Map** (`/api/map`, input: idea text). System: "You are a cartographer of ideas… Reply with JSON only." Expected reply:
```json
{"title":"2-4 words","summary":"one sentence","branches":[{"name":"2-4 words","kind":"Problem|People|Mechanism|Value|Risk|Next step","note":"one sentence","children":[{"name":"1-4 words","note":"one sentence"}]}]}
```
5–6 branches, each kind used at most once, 2–4 children per branch.

**Expand** (`/api/expand`, input: brain title and summary, node path, existing children, optional user question). Reply: `{"children":[{"name","note"}]}` with 3–4 new sub-ideas. If a question is given, grow the node to answer it.

Parse the reply by taking the substring from the first `{` to the last `}`. If the request fails, use the local keyword parser (see `localParse` in the prototype).

## 3D scene
- Renderer with alpha, pixel ratio ≤ 2, `Fog(bg, 24, 52)`, `PerspectiveCamera(38)` at (15, 9, 18), damped OrbitControls (distance 5–48), slow auto-rotate when nothing is selected.
- **Ground:** concentric rings (r = 2…14) plus 24 spokes, drawn as lines. The ground's y-position eases per mode: constellation −5.8, orbit −3.2, terrain 0.
- **Nodes:** flat `MeshBasicMaterial` spheres with a slightly larger back-face sphere as an ink outline.
  - Core: r 0.85, ink fill, plus a slowly rotating accent torus.
  - Branches: r 0.42, kind-colored fill, ink outline.
  - Leaves: r ≈ 0.17, shrinking by depth; paper fill with a thick outline in the branch color.
- **Links:** one `LineSegments` buffer (parent → child), rewritten every frame.
- **Drop lines:** from each core or branch node down to the ground, with a small cross marker where they land.
- **Selection reticle:** an accent ring that billboards to the camera and pulses gently.
- **Animation:** every frame, positions lerp toward layout targets (`k = 1 - exp(-dt/260)`). New nodes spawn from their parent with a staggered delay (`depth*260 + index*25` ms) and scale in. The orbit target eases toward the selected node.

## Layout modes (switchable, animated)
1. **Constellation:** branches on a Fibonacci sphere (radius 6.8, y squashed to 4.4).
2. **Orbit:** each branch on its own slightly tilted ring (R = 3.6 + i·1.35), angular speed proportional to 1/R; faint orbit rings fade in.
3. **Terrain:** a Gaussian height field (σ² ≈ 2.1). The core is a peak at the center; branches alternate between radius 5.2 and 7.4 with peak height `1.5 + children*0.55`. The ground is drawn as 46 ridgelines clipped to a 14-unit circle, and leaves sit on the slopes.

Nodes at depth 2 and deeper are placed around their parent in a cone pointing away from the grandparent, at radius `2.2 * 0.72^(depth-2)`.

## Labels (HTML overlay)
- Positioned by projecting each node's 3D position to the screen every frame, offset to the right of the node.
- Core: serif italic 28px. Branches: a small mono kind tag above serif 20px. Leaves: mono 10.5px uppercase.
- Leaves fade with distance. When a node is selected, labels outside its ancestors and descendants dim to 22%.
- **Collision avoidance:** place labels in priority order (selected node, then by depth). A colliding leaf label is hidden; a colliding branch label fades to 15%.
- Optional setting: show branch labels only.

## UI (inline-styled panels above the canvas, z-index 2–3)
- **Left column:**
  - **Second brain dropdown:** a "Second brain № 001 ▾" button opens a list of saved brains (number, title, node count; the current one is highlighted). "+ New second brain" at the bottom clears the selection and focuses the input.
  - Title, summary, and the branch legend (click to select).
  - "Download brain": Markdown, JSON and 3D HTML buttons.
- **Top right:** mode switch (Constellation / Orbit / Terrain), with the look switch (Atlas / Observatory / Blueprint) below it.
- **Node card:** kind and level, path, name, note, child chips (click to select), and an "Expand this node →" button. Delete uses two clicks (Delete → Confirm?), removes the node and all its descendants, and is not available on the core.
- **Bottom input:** "New brain" mode creates a new second brain. When a node is selected the input switches to "Ask node" and the question grows that node.
- Hint text bottom right: "Drag to orbit · Scroll to zoom · Click a node".

## Themes
| | bg | panel | ink | accent |
|---|---|---|---|---|
| Atlas | #EEEAE0 | #F6F3EC | #1B1A17 | #E0482B |
| Observatory | #0C0E14 | #141822 | #ECE7DA | #F2A33A |
| Blueprint | #1F3F8F | #22479E | #F2F5FB | #FFD23F |

Fonts: Instrument Serif (display) and JetBrains Mono (UI). Atlas and Blueprint use hard offset shadows (`5px 5px 0`); Observatory uses soft glows. Switching theme updates the fog and line colors and rebuilds the node materials.

## Exports
- **3D HTML:** a standalone viewer file (`<slug>-3d.html`) holding only the current brain: title and summary, the 3D map with labels, orbit controls and a Constellation / Orbit / Terrain switch. It keeps the theme and mode in use at download time, embeds the node data as JSON, and loads three.js from a CDN. Share the layout code with the main app so the two always match.
- **JSON:** a nested tree `{title, summary, plate, branches:[{name, kind, note, children:[…]}]}`.
- **Markdown:** `# Title`, the summary, `## Branch (Kind)` with its note, then children as nested `- **name** — note` bullets.

## Acceptance
- Typing an idea and pressing Enter produces a full map in about 3 seconds, with a staggered reveal.
- All three modes move smoothly between each other with no position jumps.
- Clicking a node shows its card; Expand and follow-up questions add children in place.
- Deleting a node removes its whole subtree; downloads reflect the current state.
- The dropdown switches between brains instantly; a downloaded 3D HTML file opens on its own and matches the in-app view.
- Labels never cover the UI panels, and the layout holds at 900×540.
- Dispose geometries and materials on rebuild; cancel the animation loop on unmount.
