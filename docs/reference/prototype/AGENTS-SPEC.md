# Idea Atlas — Agentic Brainstorming · Product & Design Spec

Hand this file to Claude Code along with `Idea Atlas Agents.html`, the working prototype (open it in a browser). This spec covers the features, the visual system and the agent behavior. Where the two disagree, the prototype wins.

---

## 1. Concept
The user types an idea. Claude breaks it into a **second brain**: a tree of branches and sub-ideas rendered as a 3D map in Three.js. Then a team of five small **agents** works on the map in rounds. Each agent flies from the core idea to a weak spot, thinks, and grows new ideas there. Agents also link distant branches. When the rounds finish, the Strategist writes a **Key takeaway** and highlights the strongest path through the map.

---

## 2. Stack
- React + TypeScript + Vite.
- `three@0.160` with `OrbitControls`.
- Anthropic Messages API, called through **server routes** only (keep the key off the client). Routes: `/api/map`, `/api/expand`, `/api/agent-round`, `/api/takeaway`. Every route replies with JSON only. To parse a reply, take the substring from the first `{` to the last `}`.
- Every route needs a **local fallback** (keyword parser or template children) so the app keeps working offline.
- Persistence: `localStorage` key `idea-atlas-history`, holding at most 10 second brains. On load, open the most recent brain; with none saved, use the sample "Tool Library" brain.

---

## 3. Data model
```ts
type Kind = 'Core'|'Problem'|'People'|'Mechanism'|'Value'|'Risk'|'Next step';
interface IdeaNode { id: string; name: string; note: string; userNote?: string; kind: Kind; parent: string|null; depth: number; color: string; by?: AgentId; critic?: boolean; }
interface CrossLink { a: string; b: string; why: string; by: AgentId; }
interface LogEntry { agent: AgentId; text: string; node: string; tag: string; }   // tag e.g. "R3 · +2", "Takeaway"
interface Takeaway { path: string[]; verdict: string; brief: string; }
interface SecondBrain { title: string; summary: string; nodes: IdeaNode[]; links: CrossLink[]; log: LogEntry[]; synth?: Takeaway; round: number; plate: number; created: number; }
```
- The root node is `n0` at depth 0. Depth-1 nodes are branches; deeper nodes inherit their branch's kind and color.
- `userNote` holds the user's own notes, which are separate from the AI-written `note`.

---

## 4. Layout & UI
The full-screen 3D canvas sits underneath; all UI floats above it in panels. There's a double hairline frame inset 14px and 19px from the window edge.

**Left panel** (300px wide, page background, right and bottom border):
1. Second brain dropdown, "Second brain № 001 ▾". It lists each saved brain (number, title, node count; the current one highlighted) and ends with **+ New second brain**. Next to it is a **«** button that hides the panel; when hidden, a **» {title}** tab replaces it and brings it back.
2. Title (serif, 46px) and summary (serif italic).
3. **Key takeaway** card: verdict, a three-sentence brief, the strongest path in the accent color, a Show/Hide path button, and a ▴/▾ collapse. It reopens automatically when a new takeaway is generated.
4. **Agent team:** each agent's shape icon, name, status ("idle" or the current verb plus node) and node count. Under it, the phase bar: Plan · Diverge · Connect · Takeaway, with the active phase filled in the accent color.
5. Branch legend: colored dot, name and kind. Click a row to select that branch.

**Top-right toolbar:** **View ▾** (Constellation / Orbit / Terrain) · **Design ▾** (Atlas / Observatory / Blueprint, each with a swatch) · **Settings ▾** (Rounds per run 5/10/20; Download brain as Markdown / JSON / 3D HTML) · **Focus** (accent-filled). Only one dropdown is open at a time.

**Node card** (right side, appears on selection):
- Kind and level, the path, the name with an **Edit** button (inline name and description fields with Save/Cancel), and the AI note.
- **My notes** textarea. It saves on blur or when another node is selected, and shows "editing…" / "saved".
- Child chips (click to select) and cross-links.
- **Expand this node →**, plus a two-step **Delete → Confirm?** that removes the subtree. The core can't be deleted.

**Agent log** (right side, shown when no node is selected): capped height, ▴/▾ collapse. Each entry has the agent icon, name, tag and its first-person "thought". Clicking an entry selects that node.

**Bottom input bar** (max 720px, centered):
- Label: "New brain", or "Ask node" when a node is selected.
- Serif 24px input.
- **Map it → / Grow →** button in the accent color, and **▶ Run agents / ❚❚ Pause** in ink.
- A one-line status sits above the bar.

**Focus mode** hides every panel except the canvas. Exit with the **Exit focus** button (bottom right) or the Esc key.

Hint text, bottom right: "Drag to orbit · Scroll to zoom · Click a node".

---

## 5. Visual system

### Typography
- **Instrument Serif:** titles, node names, notes, inputs. Italic for the summary and the core label.
- **JetBrains Mono:** all UI chrome, labels and buttons. Uppercase with 0.12–0.18em tracking, 9.5–12px.

### Themes ("Design" dropdown)
| Token | Atlas | Observatory | Blueprint |
|---|---|---|---|
| bg | `#EEEAE0` | `#0C0E14` | `#1F3F8F` |
| panel | `#F6F3EC` | `#141822` | `#22479E` |
| ink | `#1B1A17` | `#ECE7DA` | `#F2F5FB` |
| muted | `#5E594F` | `#9A968C` | `#B7C4E6` |
| soft | `#3A3730` | `#C9C4B7` | `#DCE3F4` |
| faint | `#8A8478` | `#6C6A64` | `#8FA3D6` |
| accent | `#E0482B` | `#F2A33A` | `#FFD23F` |
| hot (selected label) | `#C23A1F` | `#F2A33A` | `#FFD23F` |
| rule / rule2 | ink @ 40% / 14% | ink @ 28% / 10% | ink @ 50% / 18% |
| panel shadow | `5px 5px 0 ink` | soft glow + 1px amber ring | `5px 5px 0 rgba(10,24,64,.55)` |
| link line opacity | 0.6 | 0.38 | 0.7 |
| ground ring opacity | 0.16 | 0.10 | 0.22 |

Panels have square corners, 1px ink borders and hard offset shadows (soft glows in Observatory). Switching theme updates the fog, every line material and the node materials in place.

### Branch kind colors
Problem `#E0482B` · People `#2F5BD8` · Mechanism `#3E8E5A` · Value `#D49A1E` · Risk `#9B3FB5` · Next step `#1A8C8C`

### Node styling (flat `MeshBasicMaterial`, outline from a larger back-face sphere)
- **Core:** radius 0.85, ink fill with a panel-colored outline, and a slowly rotating accent torus. Its label is serif italic 19px in a **pill filled with the accent color**, dark text `#1B1A17`, 1px ink border.
- **Branch:** radius 0.42, kind-colored fill, ink outline. Label is a 9px mono kind tag above serif 20px.
- **Leaf:** radius 0.17, shrinking with depth; panel fill with a thick outline in the branch color. Label is mono 10.5px uppercase.
- **Critic nodes** (added by the Skeptic) are marked as critiques.
- **Cross-links:** dashed accent arcs between branches.
- **Strongest path:** highlighted in the accent color when "Show path" is on.
- **Selection:** a pulsing accent reticle ring. Labels outside the selected node's ancestors and descendants dim to 22%.

---

## 6. 3D scene
- Renderer with alpha, pixel ratio ≤ 2, `Fog(bg, 24, 52)`, `PerspectiveCamera(38)` at (15, 9, 18). OrbitControls with damping, distance 5–48, and auto-rotate at 0.35 when nothing is selected.
- **Ground:** rings at r = 2…14 plus 24 spokes. The ground's y-position eases per mode: Constellation −5.8, Orbit −3.2, Terrain 0.
- **Drop lines:** from each core and branch node down to the ground, with a cross marker where they land.
- **Motion:** positions lerp toward their targets with `k = 1 − exp(−dt/260)`. New nodes spawn from their parent, staggered by `depth·260 + index·25` ms, and scale in. The camera target eases toward the selection.

### Modes ("View" dropdown)
1. **Constellation:** branches on a Fibonacci sphere (radius 6.8, y scaled to 4.4).
2. **Orbit:** each branch on its own slightly tilted ring, R = 3.6 + i·1.35, with speed proportional to 1/R. Orbit rings fade in.
3. **Terrain:** a Gaussian height field. The core peak is 1.7; each branch peak is `1.5 + children·0.55`, at radius 5.2 or 7.4. The ground becomes 46 ridgelines clipped to a 14-unit circle.

Nodes at depth 2 and deeper sit in a cone pointing away from their grandparent, at radius `2.2·0.72^(depth−2)`.

### Labels
An HTML overlay, positioned each frame by projecting node positions. Labels are placed in priority order (selected node, then by depth) with collision checks: a colliding leaf label hides, and a colliding branch label fades to 15%.

---

## 7. Agents

### Roster
| Agent | Color | Shape | Eyes | Owns | Brief |
|---|---|---|---|---|---|
| Researcher | `#1E7BFF` | Hexagon | Two round eyes, dark pupils with highlights | Problem, People | Digs into real pains and specific user segments: who, where, how often. |
| Builder | `#00C46A` | Rounded square | Wide white goggle band with two pupils | Mechanism | Designs how it actually works: features, operations, systems, costs. |
| Customer | `#FF6A00` | Flower (5 petals) | Happy closed ∩ ∩ eyes and a small smile | Value | Speaks as the end user: what would make them care, pay and come back. |
| Skeptic | `#141414` | Ghost | Half-lidded eyes, one raised brow | Risk | Attacks weak assumptions: names failure modes and cheap tests. Its children are flagged `critic`. |
| Strategist | `#8B5CF6` | Five-point star | Two round eyes with pupils | Next step, Key takeaway | Turns ideas into ordered next moves; writes the Key takeaway. |

### Agent visual style
- Flat 2D shapes built with `ShapeGeometry` and no outline. They always face the camera.
- **Hidden by default.** An agent appears only during its turn, with a scale pop of 0 → 1.25 → 1.15, and shrinks away when the turn ends.
- **Idle motion:** squash-and-stretch bob, slight wobble, a blink every ~3.6s (eye scale.y drops to 0.15 for 130ms), and pupils that drift slowly.
- **Name tag:** a rounded pill, "Researcher · eyeing Pickup lockers". Verbs by phase: plan "eyeing", diverge "sprouting ideas on", connect "linking from", takeaway "pondering".
- **UI icons:** 18×16 SVGs with the same shape and eyes, used in the team list and the agent log.

### Turn choreography (the agentic process)
Each round, one agent takes a turn:
1. **Plan:** the agent pops in at the core node `n0`. It picks a target: the thinnest node in its owned branches (fewest children, shallow depth).
2. **Travel:** it flies along the tree links from the core, through the branch, to the target. There's no straight connecting beam.
3. **Think:** it hovers above the target with a thought bubble of animated dots, staying at least ~1.2s even if the API answers faster.
4. **Diverge / spawn:** the new children burst out of the target with a staggered scale-in. The agent briefly celebrates.
5. **Connect:** if the reply includes a link, a dashed accent arc draws from the target to the other branch.
6. **Log:** the agent's first-person thought is added to the log, tagged `R{n} · +{count}`. The agent then shrinks away.

When the rounds finish, the Strategist appears at the core, thinks, writes the Key takeaway, and the strongest path lights up.

**Run controls:** ▶ Run agents runs the number of rounds chosen in Settings (5 / 10 / 20). ❚❚ Pause stops after the current round. A run is tied to the brain it started on, so switching brains stops it.

### Prompts
**Map** (`/api/map`). System: *"You are a cartographer of ideas. You break an idea into a clear map. Reply with JSON only."*
→ `{title, summary, branches:[{name, kind, note, children:[{name, note}]}]}`, with 5–6 branches, each kind used at most once, and 2–4 children each.

**Agent round** (`/api/agent-round`). System: *"You are the {Agent} agent on a brainstorming team. {brief} Reply with JSON only."* The user message contains the idea, the map as `id | name | kind | parent` lines, the existing links and the target node.
→ `{thought: "one sentence, first person", children:[{name, note}], links:[{a, b, why}]}`, with 2–3 new children (critiques if the agent is the Skeptic) and 0–1 links, only to a different branch.

**Expand / Ask node** (`/api/expand`): the node path, its existing children and an optional user question.
→ `{children:[{name, note}]}`, with 3–4 new children.

**Key takeaway** (`/api/takeaway`). System: *"You are the Strategist agent. You converge a brainstorm into one clear direction."*
→ `{leaf: "node id", verdict: "one sentence", brief: "three sentences: why this path, biggest risk, first move"}`. The path runs from the core to the chosen leaf.

---

## 8. Exports (Settings → Download brain)
- **Markdown:**
  - `# Title`, then the summary.
  - Each branch as `## Branch (Kind)` with its note, then children as nested `- **name** — note` bullets.
  - User notes as `> My note: …` lines.
  - A `## Key takeaway` section and a `## Cross-links` section.
- **JSON:** a nested tree `{title, summary, plate, branches:[{name, kind, note, myNote, children}], links:[{from, to, why, by}], synthesis}`.
- **3D HTML:** a standalone `<slug>-3d.html` viewer with only the title, summary, 3D map, labels, orbit controls and a View switch. It keeps the current theme and mode, embeds the data as JSON and loads three.js from a CDN. Share the layout code with the main app so the two match.

---

## 9. Acceptance checklist
- An idea produces a map in about 3 seconds, with a staggered reveal.
- During a run, each turn shows the full sequence: pop in at the core → travel along the links → thinking dots → children burst out → link arc → log entry → shrink away.
- No agents are visible while nothing is running.
- View and Design switch smoothly with no position jumps. The core label stays readable in all three designs.
- Edit, My notes and Delete all persist to localStorage and show up in every export.
- Focus mode and the hidden left panel both leave a clean canvas; Esc exits focus mode.
- At 900×540: no panel overlaps, and labels never sit above the UI.
- Geometries and materials are disposed on rebuild; the animation loop and document listeners are cleaned up on unmount.
