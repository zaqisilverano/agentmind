import * as THREE from 'three';
import { bubbleGeo, buildProbe, sharedMats } from '@/engine/agentShapes';
import type { Vec3 } from '@/engine/layout';
import type { Theme } from '@/engine/themes';
import type { Agent } from '@/lib/agents/roster';

/** A fixed point, or a getter for a point that moves (a node's live position); undefined when it no longer exists. */
export type PointSource = Vec3 | (() => Vec3 | undefined);

export interface Agents {
  /** Holds the five probes (bursts go straight into the scene, as in the prototype). */
  readonly group: THREE.Group;
  /** Pop in at `at` (0 → 1.15). Resolves when the pop has (nearly) settled. */
  show(id: string, at: PointSource): Promise<void>;
  /** Hop along the points, 600 ms per hop, lifted by HOVER_LIFT. One point teleports. Resolves on arrival. */
  walk(id: string, points: PointSource[]): Promise<void>;
  /** Fly along `curve(t)` for `dur` ms, reporting progress each frame; afterwards hover at `end`. */
  ride(id: string, curve: (t: number) => Vec3 | undefined, dur: number, onProgress?: (t: number) => void, end?: PointSource): Promise<void>;
  think(id: string, on: boolean): void;
  /** Two expanding rings in the agent's colour plus a jump. Ignored while the agent is not on screen. */
  burst(id: string): void;
  /** Shrink out. Resolves once invisible; also cancels any walk or ride. */
  hide(id: string): Promise<void>;
  /** A delay measured by the frame loop (starts on the next tick). */
  wait(ms: number): Promise<void>;
  setLabel(id: string, text: string): void;
  positionOf(id: string): Vec3 | undefined;
  /** True while any agent is shown or still shrinking out. */
  active(): boolean;
  setSize(width: number, height: number): void;
  tick(dt: number, now: number, camera: THREE.Camera): void;
  recolor(theme: Theme): void;
  dispose(): void;
}

type Done = (() => void) | null;
type Slot = 'popDone' | 'hideDone' | 'moveDone';

interface Probe extends ReturnType<typeof buildProbe> {
  a: Agent; i: number; label: HTMLDivElement; dot: HTMLSpanElement; text: HTMLSpanElement;
  show: boolean; vis: number; thinking: boolean; jump: number | null; on: boolean;
  at: PointSource | null; route: PointSource[] | null; rt: number;
  ride: { curve: (t: number) => Vec3 | undefined; dur: number; start: number | null; onProgress?: (t: number) => void; end?: PointSource } | null;
  popDone: Done; hideDone: Done; moveDone: Done;
}

// Prototype numbers (idea-atlas-agents.prototype.js lines 201–217, 489, 513–523, 695–747).
export const HOVER_LIFT = 0.8; // height above a node while hopping along a route (line 712)
export const ARC_MS = 1500; // link arc reveal (line 210)
const IDLE_LIFT = 0.85, ARC_LIFT = 0.6, HOP_MS = 600;
const LAG = 260, POP_RATE = 1.8, SHRINK_RATE = 2.6, SCALE = 1.15, POP_DONE = 0.95, HIDDEN = 0.01;
const BURST_MS = 800, BURST_DELAYS = [0, 170], JUMP_MS = 520, BLINK_EVERY = 3600, BLINK_MS = 130;
const LABEL_DX = 12, LABEL_DY = -28;

const at = (s: PointSource | null | undefined): Vec3 | undefined => (typeof s === 'function' ? s() : s ?? undefined);

export function createAgents(three: { scene: THREE.Scene; camera: THREE.Camera }, layer: HTMLElement, roster: Agent[], theme: Theme): Agents {
  const { scene } = three;
  let t = theme, W = 1, H = 1, lastNow = performance.now(), dead = false;
  const group = new THREE.Group();
  scene.add(group);
  const M = sharedMats(t.ink), B = bubbleGeo();
  const burstGeo = new THREE.RingGeometry(0.92, 1, 48);
  let bursts: { m: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; born: number }[] = [];
  let timers: { ms: number; start: number | null; done: () => void }[] = [];
  const want = new THREE.Vector3(), v = new THREE.Vector3();

  // styleProbe, lines 355–359 (fonts come from the app's CSS variables).
  const style = (p: Probe) => {
    const op = p.label.style.opacity || '0', tr = p.label.style.transform;
    p.label.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;will-change:transform;display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-family:var(--font-mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;'
      + `border:1px solid ${t.ink};background:${t.panel};color:${t.ink}`;
    p.label.style.opacity = op;
    if (tr) p.label.style.transform = tr;
    p.dot.style.cssText = `flex:none;width:8px;height:8px;border-radius:50%;background:${p.a.color};border:1px solid ${t.ink}`;
  };

  const probes: Probe[] = roster.map((a, i) => {
    const parts = buildProbe(a, M, B);
    group.add(parts.mesh);
    const label = document.createElement('div'), dot = document.createElement('span'), text = document.createElement('span');
    label.className = 'atlas-agent-label';
    label.dataset.agent = a.id;
    label.append(dot, text);
    layer.appendChild(label);
    const p: Probe = { ...parts, a, i, label, dot, text, show: false, vis: 0, thinking: false, jump: null, on: false,
      at: null, route: null, rt: 0, ride: null, popDone: null, hideDone: null, moveDone: null };
    style(p);
    return p;
  });
  const byId = new Map(probes.map(p => [p.a.id as string, p]));

  const fire = (p: Probe, slot: Slot) => { const d = p[slot]; p[slot] = null; d?.(); };
  const pending = (p: Probe, slot: Slot) => new Promise<void>(res => { fire(p, slot); p[slot] = res; });
  const place = (p: Probe, s: PointSource | null | undefined, lift: number) => {
    const q = at(s);
    if (q) p.mesh.position.set(q.x, q.y + lift, q.z);
  };
  const stopMoving = (p: Probe) => { p.route = null; p.ride = null; fire(p, 'moveDone'); };
  const setOn = (p: Probe, on: boolean) => { if (p.on !== on) { p.on = on; p.label.style.opacity = on ? '1' : '0'; } };

  return {
    group,

    show(id, point) {
      const p = byId.get(id);
      if (!p || dead) return Promise.resolve();
      stopMoving(p);
      fire(p, 'hideDone');
      p.at = point;
      place(p, point, 0); // line 226: the probe appears at the node and the idle hover lifts it
      p.show = true;
      return pending(p, 'popDone');
    },

    // walk, lines 201–208.
    walk(id, points) {
      const p = byId.get(id);
      if (!p || dead) return Promise.resolve();
      stopMoving(p);
      if (!points.length) return Promise.resolve();
      if (points.length === 1 || !p.show) {
        p.at = points[points.length - 1];
        place(p, p.at, HOVER_LIFT);
        return Promise.resolve();
      }
      p.route = points.slice();
      p.rt = 0;
      return pending(p, 'moveDone');
    },

    // arcTo, lines 209–211; travel along the arc, line 714.
    ride(id, curve, dur, onProgress, end) {
      const p = byId.get(id);
      if (!p || dead) { onProgress?.(1); return Promise.resolve(); }
      stopMoving(p);
      p.ride = { curve, dur, start: null, onProgress, end };
      return pending(p, 'moveDone');
    },

    think(id, on) { const p = byId.get(id); if (p) p.thinking = on; },

    // burst, lines 212–217.
    burst(id) {
      const p = byId.get(id);
      if (!p || dead || !p.mesh.visible) return;
      for (const delay of BURST_DELAYS) {
        const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color: p.a.color, transparent: true, side: THREE.DoubleSide }));
        m.position.copy(p.mesh.position);
        m.visible = false;
        scene.add(m);
        bursts.push({ m, born: lastNow + delay });
      }
      p.jump = lastNow;
    },

    // agentRound finally, line 352: show off, thinking off, route and arc cancelled.
    hide(id) {
      const p = byId.get(id);
      if (!p || dead) return Promise.resolve();
      p.show = false;
      p.thinking = false;
      stopMoving(p);
      fire(p, 'popDone');
      if (p.vis === 0) { p.mesh.visible = false; setOn(p, false); return Promise.resolve(); } // never got on screen
      return pending(p, 'hideDone');
    },

    wait(ms) {
      if (dead) return Promise.resolve();
      return new Promise(done => { timers.push({ ms, start: null, done }); });
    },

    setLabel(id, text) { const p = byId.get(id); if (p) p.text.textContent = text; },

    positionOf(id) {
      const p = byId.get(id);
      if (!p || !p.mesh.visible) return undefined;
      const q = p.mesh.position;
      return { x: q.x, y: q.y, z: q.z };
    },

    active() { return probes.some(p => p.show || p.vis > 0); },

    setSize(width, height) { W = width; H = height; },

    // tick, lines 695–747 (bursts and probes) and 765–772 (name tags).
    tick(dt, now, camera) {
      if (dead) return;
      lastNow = now;
      const k = 1 - Math.exp(-dt / LAG);
      if (timers.length) {
        const due = timers.filter(x => now - (x.start ??= now) >= x.ms);
        if (due.length) { timers = timers.filter(x => !due.includes(x)); for (const x of due) x.done(); }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i], age = (now - b.born) / BURST_MS;
        if (age < 0) { b.m.visible = false; continue; }
        if (age >= 1) { scene.remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); continue; }
        b.m.visible = true;
        b.m.quaternion.copy(camera.quaternion);
        b.m.scale.setScalar(0.2 + age * 1.5);
        b.m.material.opacity = (1 - age) * 0.9;
      }
      for (const p of probes) {
        const r = p.ride;
        if (r) {
          const pr = Math.min(1, (now - (r.start ??= now)) / r.dur);
          r.onProgress?.(pr);
          place(p, () => r.curve(pr), ARC_LIFT);
          if (pr >= 1) { if (r.end) p.at = r.end; p.ride = null; fire(p, 'moveDone'); }
        }
        if (!p.show && p.vis === 0) continue; // hidden: nothing else to do
        p.vis += ((p.show ? 1 : 0) - p.vis) * Math.min(1, k * (p.show ? POP_RATE : SHRINK_RATE));
        if (!p.show && p.vis <= HIDDEN) {
          p.vis = 0;
          p.mesh.visible = false;
          setOn(p, false);
          fire(p, 'hideDone');
          continue;
        }
        p.mesh.visible = true;
        if (p.show && p.vis >= POP_DONE) fire(p, 'popDone');
        const i = p.i;
        if (p.route) {
          p.rt += dt / HOP_MS;
          const route = p.route, seg = Math.floor(p.rt);
          const a = at(route[seg]), b = at(route[seg + 1]);
          if (seg >= route.length - 1 || !a || !b) {
            p.at = route[route.length - 1];
            if (seg >= route.length - 1) place(p, p.at, HOVER_LIFT);
            p.route = null;
            fire(p, 'moveDone');
          } else {
            const fr = p.rt - seg, e = fr * fr * (3 - 2 * fr);
            p.mesh.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e + HOVER_LIFT + Math.sin(fr * Math.PI) * 0.8, a.z + (b.z - a.z) * e);
          }
        } else if (!p.ride) {
          const q = at(p.at);
          if (q) {
            const rad = p.thinking ? 0.55 : 0.25;
            want.set(q.x + Math.cos(now * 0.0022 + i) * rad, q.y + IDLE_LIFT + Math.sin(now * 0.004 + i) * 0.08, q.z + Math.sin(now * 0.0022 + i) * rad);
            p.mesh.position.lerp(want, Math.min(1, k * 1.2));
          }
        }
        p.mesh.quaternion.copy(camera.quaternion);
        const pop = p.vis * (1 + 0.25 * Math.sin(Math.min(1, p.vis) * Math.PI));
        p.mesh.scale.setScalar(pop * SCALE);
        const bob = Math.sin(now * (p.route ? 0.02 : 0.01) + i * 1.7);
        const ja = p.jump === null ? 2 : (now - p.jump) / JUMP_MS, jump = ja >= 0 && ja < 1 ? Math.sin(ja * Math.PI) : 0;
        p.body.position.y = 0.04 * bob + jump * 0.35;
        p.body.scale.set(1 + 0.05 * bob - jump * 0.08, 1 - 0.06 * bob + jump * 0.14, 1);
        p.body.rotation.z = p.route ? Math.sin(now * 0.02 + i) * 0.18 : Math.sin(now * 0.006 + i) * 0.1;
        const blink = ((now + i * 1370) % BLINK_EVERY) < BLINK_MS ? 0.15 : 1;
        for (const e of p.eyes) e.scale.y = blink;
        const lx = Math.sin(now * 0.0011 + i * 2) * 0.018, ly = Math.cos(now * 0.0009 + i) * 0.01;
        for (const pu of p.pupils) pu.position.set(pu.userData.bx + lx, pu.userData.by + ly, pu.position.z);
        p.bubble.visible = p.thinking;
        if (p.thinking) p.dots.forEach((d, j) => { const s = Math.max(0, Math.sin(now * 0.008 - j * 0.9)); d.scale.setScalar(0.7 + s * 0.6); d.position.y = s * 0.03; });
        v.copy(p.mesh.position).project(camera);
        setOn(p, v.z <= 1);
        if (v.z <= 1) p.label.style.transform = `translate(${((v.x + 1) / 2 * W + LABEL_DX).toFixed(1)}px,${((1 - v.y) / 2 * H + LABEL_DY).toFixed(1)}px)`;
      }
    },

    // applyTheme, line 399.
    recolor(theme) {
      t = theme;
      M.ink.color.set(t.ink);
      for (const p of probes) style(p);
    },

    dispose() {
      if (dead) return;
      dead = true;
      for (const p of probes) { p.show = false; p.route = null; p.ride = null; for (const s of ['popDone', 'hideDone', 'moveDone'] as const) fire(p, s); }
      const ts = timers; timers = [];
      for (const x of ts) x.done();
      for (const b of bursts) { scene.remove(b.m); b.m.material.dispose(); }
      bursts = [];
      const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>();
      for (const p of probes) {
        p.mesh.traverse(o => { if (o instanceof THREE.Mesh) { geos.add(o.geometry); mats.add(o.material as THREE.Material); } });
        group.remove(p.mesh);
        p.label.remove();
      }
      for (const g of [burstGeo, B.out, B.inner, B.dot]) geos.add(g);
      for (const m of [M.white, M.dark, M.ink]) mats.add(m);
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      scene.remove(group);
    },
  };
}
