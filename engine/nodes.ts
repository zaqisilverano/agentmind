import * as THREE from 'three';
import { computeTargets, type Vec3 } from '@/engine/layout';
import type { LabelAnchor } from '@/engine/labels';
import { createOverlays } from '@/engine/overlays';
import type { Theme } from '@/engine/themes';
import type { Brain, IdeaNode, Mode } from '@/engine/types';

export interface NodeGraph {
  readonly nodes: ReadonlyArray<IdeaNode>;
  /** Diff by node id. `fresh` restarts every node from its parent with the stagger; otherwise only new nodes spawn (at `spawnFrom` when given). */
  rebuild(brain: Brain, fresh: boolean, now: number, spawnFrom?: Vec3 | null): void;
  layoutTick(mode: Mode, now: number, dt: number): void;
  recolor(theme: Theme): void;
  select(id: string | null): void;
  setHovered(id: string | null): void;
  setPath(ids: string[] | null): void;
  /** Cross-link reveal progress (0..1) for the arc keyed `a~b`; null shows it whole. */
  setReveal(key: string, progress: number | null): void;
  /** Point at t ∈ [0, 1] along the visible cross-link arc keyed `a~b`. */
  arcPoint(key: string, t: number): Vec3 | undefined;
  pick(ndcX: number, ndcY: number): string | null;
  positionOf(id: string): Vec3 | undefined;
  targetOf(id: string): Vec3 | undefined;
  /** Label anchor for a born node, undefined before it is born. */
  anchorOf(id: string): LabelAnchor | undefined;
  /** The node, its ancestors and its descendants; null when the id is unknown. */
  related(id: string | null): Set<string> | null;
  /** Ids whose labels take the hot colour: hovered, selected and on the visible path. */
  hotIds(): Set<string>;
  /** Where the camera should look: the selected node, else the core. */
  focus(): THREE.Vector3 | undefined;
  dispose(): void;
}

interface Obj {
  node: IdeaNode; mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  outline: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null;
  pos: THREE.Vector3; target: THREE.Vector3; s: number; base: number; born: number;
}

// Prototype numbers (idea-atlas-agents.prototype.js lines 453–466, 545–595, 628–690, 734–738).
const LAG = 260, DEPTH_STAGGER = 260, INDEX_STAGGER = 25, LIVE_STAGGER = 160;
const DROP_OPACITY = 0.2, CROSS = 0.22, HOVER_SCALE = 1.3, CORE_SPIN = 0.0004;
const baseOf = (d: number) => d === 0 ? 0.85 : d === 1 ? 0.42 : Math.max(0.1, 0.17 - (d - 2) * 0.03);
const outlineOf = (d: number) => d === 0 ? 1.08 : d === 1 ? 1.16 : 1.42;

function segments(color: THREE.Color, opacity: number): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  l.frustumCulled = false;
  return l;
}

/** Resize a LineSegments position buffer to hold `n` segments (no-op when the size already matches). */
function ensureSegments(l: THREE.LineSegments, n: number) {
  const a = l.geometry.attributes.position as THREE.BufferAttribute | undefined;
  if (a && a.count === n * 2) return;
  l.geometry.dispose();
  l.geometry = new THREE.BufferGeometry();
  l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 6), 3));
  l.geometry.setDrawRange(0, 0);
}

export function createNodeGraph(
  three: { scene: THREE.Scene; camera: THREE.Camera },
  theme: Theme,
  opts: { surfaceY?: (x: number, z: number) => number } = {},
): NodeGraph {
  const { scene, camera } = three;
  const surfaceY = opts.surfaceY ?? (() => 0);
  let t = theme;
  let nodes: IdeaNode[] = [];
  let objs: Obj[] = [];
  let byId = new Map<string, Obj>();
  let kids = new Map<string, string[]>();
  let selected: string | null = null, hovered: string | null = null;
  let pathIds: string[] | null = null, visiblePath: string[] = [];

  const root = new THREE.Group();
  scene.add(root);
  const nodeGroup = new THREE.Group();
  root.add(nodeGroup);
  const sphere = new THREE.SphereGeometry(1, 28, 18);
  const ink = new THREE.Color(t.ink);
  const links = segments(ink, t.line), drops = segments(ink, DROP_OPACITY);
  // Allocate the buffers now so the scene can tick before the first brain arrives.
  ensureSegments(links, 0);
  ensureSegments(drops, 0);
  root.add(links, drops);
  const overlays = createOverlays(root, camera, t);

  // buildGraph, lines 558–565 (colours) and applyTheme, lines 390–401 (recolour in place).
  const paint = (o: Obj) => {
    const d = o.node.depth;
    o.mesh.material.color.set(d === 0 ? t.ink : d === 1 ? o.node.color : t.panel);
    o.outline.material.color.set(d === 0 ? t.panel : d === 1 ? t.ink : o.node.color);
    o.ring?.material.color.set(t.accent);
  };

  const make = (n: IdeaNode): Obj => {
    const mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial());
    const outline = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ side: THREE.BackSide }));
    outline.scale.setScalar(outlineOf(n.depth));
    mesh.add(outline);
    mesh.userData.id = n.id;
    let ring: Obj['ring'] = null;
    if (n.depth === 0) {
      ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.035, 8, 96), new THREE.MeshBasicMaterial());
      ring.rotation.x = Math.PI / 2.4;
      mesh.add(ring);
    }
    mesh.visible = false;
    nodeGroup.add(mesh);
    return { node: n, mesh, outline, ring, pos: new THREE.Vector3(), target: new THREE.Vector3(), s: 0, base: baseOf(n.depth), born: 0 };
  };

  const destroy = (o: Obj) => {
    nodeGroup.remove(o.mesh);
    o.mesh.material.dispose();
    o.outline.material.dispose();
    if (o.ring) { o.ring.geometry.dispose(); o.ring.material.dispose(); }
  };

  const toVec = (v: THREE.Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
  let now0 = 0;

  return {
    get nodes() { return nodes; },

    // buildGraph, lines 545–595.
    rebuild(brain, fresh, now, spawnFrom = null) {
      const old = byId;
      nodes = brain.nodes.slice();
      byId = new Map();
      kids = new Map();
      for (const n of nodes) if (n.parent !== null) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n.id]);
      let newCount = 0;
      objs = nodes.map((n, i) => {
        let o = old.get(n.id);
        if (o && o.node.depth !== n.depth) { destroy(o); o = undefined; }
        const keep = !!o && !fresh;
        if (!o) o = make(n);
        old.delete(n.id);
        o.node = n;
        paint(o);
        if (!keep) {
          const parent = n.parent !== null ? byId.get(n.parent) : undefined;
          if (!fresh && spawnFrom) o.pos.set(spawnFrom.x, spawnFrom.y, spawnFrom.z);
          else if (parent) o.pos.copy(parent.pos);
          else o.pos.set(0, 0, 0);
          o.s = 0;
          o.born = fresh ? now + n.depth * DEPTH_STAGGER + i * INDEX_STAGGER : now + (newCount++) * LIVE_STAGGER;
          o.mesh.visible = false;
        }
        byId.set(n.id, o);
        return o;
      });
      for (const o of old.values()) destroy(o);
      ensureSegments(links, nodes.length);
      ensureSegments(drops, nodes.filter(n => n.depth <= 1).length * 3);
      overlays.setLinks((brain.links ?? []).filter(l => byId.has(l.a) && byId.has(l.b)), nodes.length);
    },

    // tick, lines 650–690 and 734–738.
    layoutTick(mode, now, dt) {
      now0 = now;
      const k = 1 - Math.exp(-dt / LAG);
      const targets = computeTargets(nodes, mode, now);
      for (const o of objs) { const p = targets[o.node.id]; if (p) o.target.set(p.x, p.y, p.z); }
      const L = links.geometry.attributes.position as THREE.BufferAttribute;
      const D = drops.geometry.attributes.position as THREE.BufferAttribute;
      let li = 0, di = 0;
      for (const o of objs) {
        if (now < o.born) { o.mesh.visible = false; continue; }
        o.mesh.visible = true;
        o.pos.lerp(o.target, k);
        o.s += (1 - o.s) * Math.min(1, k * 1.4);
        const hov = hovered === o.node.id || selected === o.node.id;
        o.mesh.position.copy(o.pos);
        o.mesh.scale.setScalar(o.base * o.s * (hov ? HOVER_SCALE : 1));
        const p = o.node.parent !== null ? byId.get(o.node.parent) : undefined;
        if (p) { L.setXYZ(li * 2, p.pos.x, p.pos.y, p.pos.z); L.setXYZ(li * 2 + 1, o.pos.x, o.pos.y, o.pos.z); li++; }
        if (o.node.depth <= 1) {
          const x = o.pos.x, z = o.pos.z, gy = surfaceY(x, z);
          D.setXYZ(di * 2, x, o.pos.y, z); D.setXYZ(di * 2 + 1, x, gy, z); di++;
          D.setXYZ(di * 2, x - CROSS, gy, z); D.setXYZ(di * 2 + 1, x + CROSS, gy, z); di++;
          D.setXYZ(di * 2, x, gy, z - CROSS); D.setXYZ(di * 2 + 1, x, gy, z + CROSS); di++;
        }
        if (o.ring) o.ring.rotation.z += dt * CORE_SPIN;
      }
      L.needsUpdate = true; links.geometry.setDrawRange(0, li * 2);
      D.needsUpdate = true; drops.geometry.setDrawRange(0, di * 2);
      const born = (id: string) => { const o = byId.get(id); return o && now >= o.born ? o : undefined; };
      visiblePath = (pathIds ?? []).filter(id => born(id));
      const so = selected ? byId.get(selected) : undefined;
      overlays.update(now, k, id => born(id)?.pos, visiblePath.map(id => byId.get(id)!.pos),
        so ? { pos: so.pos, base: so.base } : null);
    },

    recolor(theme) {
      t = theme;
      links.material.color.set(t.ink);
      links.material.opacity = t.line;
      drops.material.color.set(t.ink);
      overlays.recolor(t);
      for (const o of objs) paint(o);
    },

    select(id) { selected = id; },
    setHovered(id) { hovered = id; },
    setPath(ids) { pathIds = ids ? ids.slice() : null; },
    setReveal(key, progress) { overlays.setReveal(key, progress); },
    arcPoint(key, t) { const p = overlays.arcPoint(key, t); return p ? toVec(p) : undefined; },

    // Picking, lines 525–531: fill meshes only, not recursive.
    pick(ndcX, ndcY) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hit = ray.intersectObjects(objs.filter(o => o.mesh.visible).map(o => o.mesh), false)[0];
      return hit ? (hit.object.userData.id as string) : null;
    },

    positionOf(id) { const o = byId.get(id); return o ? toVec(o.pos) : undefined; },
    targetOf(id) { const o = byId.get(id); return o ? toVec(o.target) : undefined; },
    anchorOf(id) {
      const o = byId.get(id);
      if (!o || now0 < o.born) return undefined;
      return { x: o.pos.x, y: o.pos.y, z: o.pos.z, r: o.base * o.s, s: o.s };
    },

    // tick, line 657: ancestors + descendants of the selected node.
    related(id) {
      if (!id || !byId.has(id)) return null;
      const out = new Set<string>();
      for (let c = byId.get(id); c; c = c.node.parent !== null ? byId.get(c.node.parent) : undefined) out.add(c.node.id);
      const walk = (x: string) => { out.add(x); for (const k of kids.get(x) ?? []) walk(k); };
      walk(id);
      return out;
    },

    hotIds() {
      const s = new Set(visiblePath);
      if (hovered) s.add(hovered);
      if (selected) s.add(selected);
      return s;
    },

    // tick, line 739: focus the selected node, else the core.
    focus() {
      const so = selected ? byId.get(selected) : undefined;
      return (so ?? objs.find(o => o.node.depth === 0) ?? objs[0])?.pos;
    },

    dispose() {
      for (const o of objs) destroy(o);
      objs = []; byId = new Map(); kids = new Map(); nodes = [];
      sphere.dispose();
      for (const l of [links, drops]) { l.geometry.dispose(); l.material.dispose(); }
      overlays.dispose();
      scene.remove(root);
    },
  };
}
