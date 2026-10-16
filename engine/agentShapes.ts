import * as THREE from 'three';
import type { Agent } from '@/lib/agents/roster';

type Pt = [number, number];

// Shape helpers, idea-atlas-agents.prototype.js lines 470–472.
/** Rounded rectangle centred on (x, y). */
export function rr(x: number, y: number, w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x - w / 2 + r, y - h / 2);
  s.lineTo(x + w / 2 - r, y - h / 2);
  s.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
  s.lineTo(x + w / 2, y + h / 2 - r);
  s.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
  s.lineTo(x - w / 2 + r, y + h / 2);
  s.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
  s.lineTo(x - w / 2, y - h / 2 + r);
  s.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
  return s;
}

function circ(x: number, y: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  return s;
}

/** Polygon with every corner rounded by a quadratic curve of radius ≤ `rad`. */
function rpoly(pts: Pt[], rad: number): THREE.Shape {
  const s = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const pv = pts[(i + n - 1) % n], q = pts[i], nx = pts[(i + 1) % n];
    const d1 = Math.hypot(pv[0] - q[0], pv[1] - q[1]), d2 = Math.hypot(nx[0] - q[0], nx[1] - q[1]);
    const r1 = Math.min(rad, d1 / 2) / d1, r2 = Math.min(rad, d2 / 2) / d2;
    const a: Pt = [q[0] + (pv[0] - q[0]) * r1, q[1] + (pv[1] - q[1]) * r1];
    const b: Pt = [q[0] + (nx[0] - q[0]) * r2, q[1] + (nx[1] - q[1]) * r2];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(q[0], q[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}

const ring = (n: number, step: number, r: (k: number) => number): Pt[] =>
  Array.from({ length: n }, (_, k) => { const a = Math.PI / 2 + k * step; return [Math.cos(a) * r(k), Math.sin(a) * r(k)]; });

// SHAPES, lines 473–479.
export const SHAPES: Record<Agent['shape'], () => THREE.Shape[]> = {
  hexagon: () => [rpoly(ring(6, Math.PI / 3, () => 0.4), 0.1)],
  squircle: () => [rr(0, 0, 0.66, 0.6, 0.2)],
  flower: () => ring(5, Math.PI * 2 / 5, () => 0.19).map(([x, y]) => circ(x, y, 0.17)).concat([circ(0, 0, 0.21)]),
  ghost: () => {
    const s = new THREE.Shape();
    s.moveTo(-0.3, -0.32); s.lineTo(-0.3, 0.04); s.absarc(0, 0.04, 0.3, Math.PI, 0, true); s.lineTo(0.3, -0.32);
    s.quadraticCurveTo(0.25, -0.2, 0.15, -0.3); s.quadraticCurveTo(0.075, -0.2, 0, -0.32);
    s.quadraticCurveTo(-0.075, -0.2, -0.15, -0.3); s.quadraticCurveTo(-0.25, -0.2, -0.3, -0.32);
    return [s];
  },
  star: () => [rpoly(ring(10, Math.PI / 5, k => (k % 2 ? 0.22 : 0.44)), 0.06)],
};

/** Materials shared by every probe: eye whites, pupils and the ink of the thought bubble. */
export interface SharedMats { white: THREE.MeshBasicMaterial; dark: THREE.MeshBasicMaterial; ink: THREE.MeshBasicMaterial }

export function sharedMats(ink: string): SharedMats {
  const m = (color: string) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  return { white: m('#FFFFFF'), dark: m('#1B1A17'), ink: m(ink) }; // line 487, 490
}

const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

/** Pupils remember their rest position for the drift (userData.bx / by). */
// makeEyes, lines 492–512.
export function makeEyes(shape: Agent['shape'], body: THREE.Group, M: SharedMats): { eyes: THREE.Group[]; pupils: THREE.Mesh[] } {
  const eyes: THREE.Group[] = [], pupils: THREE.Mesh[] = [];
  const g = (x: number, y: number) => { const e = new THREE.Group(); e.position.set(x, y, 0.01); body.add(e); eyes.push(e); return e; };
  const pupil = (e: THREE.Group, r: number, x: number, y: number) => {
    const pu = mk(new THREE.CircleGeometry(r, 16), M.dark, x, y, 0.005);
    pu.userData.bx = x; pu.userData.by = y;
    e.add(pu); pupils.push(pu);
    return pu;
  };
  const sides = [-1, 1];
  if (shape === 'hexagon') {
    // Two round eyes, dark pupils with highlights.
    for (const s of sides) {
      const e = g(s * 0.115, 0.03);
      e.add(mk(new THREE.CircleGeometry(0.095, 28), M.white, 0, 0, 0));
      pupil(e, 0.05, 0, 0).add(mk(new THREE.CircleGeometry(0.016, 10), M.white, 0.018, 0.018, 0.004));
    }
  } else if (shape === 'squircle') {
    // Wide white goggle band with two pupils.
    const e = g(0, 0.05);
    e.add(mk(new THREE.ShapeGeometry(rr(0, 0, 0.46, 0.15, 0.075), 8), M.white, 0, 0, 0));
    pupil(e, 0.042, -0.12, 0); pupil(e, 0.042, 0.12, 0);
  } else if (shape === 'flower') {
    // Happy closed ∩ ∩ eyes and a small smile.
    for (const s of sides) g(s * 0.085, 0.03).add(mk(new THREE.RingGeometry(0.034, 0.058, 20, 1, 0, Math.PI), M.dark, 0, 0, 0));
    body.add(mk(new THREE.RingGeometry(0.03, 0.048, 16, 1, Math.PI, Math.PI), M.dark, 0, -0.06, 0.01));
  } else if (shape === 'ghost') {
    // Half-lidded eyes, one raised brow.
    for (const s of sides) {
      const e = g(s * 0.1, 0.06);
      e.add(mk(new THREE.CircleGeometry(0.075, 24, Math.PI, Math.PI), M.white, 0, 0, 0));
      pupil(e, 0.03, 0, -0.035);
    }
    const brow = mk(new THREE.ShapeGeometry(rr(0, 0, 0.13, 0.032, 0.016), 6), M.white, 0.11, 0.16, 0.01);
    brow.rotation.z = 0.35;
    body.add(brow);
  } else {
    // Two round eyes with pupils.
    for (const s of sides) {
      const e = g(s * 0.075, 0);
      e.add(mk(new THREE.CircleGeometry(0.062, 20), M.white, 0, 0, 0));
      pupil(e, 0.032, 0, 0);
    }
  }
  return { eyes, pupils };
}

/** Bubble geometry shared by every probe (line 489). */
export interface BubbleGeo { out: THREE.ShapeGeometry; inner: THREE.ShapeGeometry; dot: THREE.CircleGeometry }

export const bubbleGeo = (): BubbleGeo => ({
  out: new THREE.ShapeGeometry(rr(0, 0, 0.5, 0.23, 0.115), 8),
  inner: new THREE.ShapeGeometry(rr(0, 0, 0.46, 0.19, 0.095), 8),
  dot: new THREE.CircleGeometry(0.03, 12),
});

// Probe factory, lines 513–520: body shapes, eyes, then the thought bubble with three dots.
export function buildProbe(a: Agent, M: SharedMats, B: BubbleGeo) {
  const mesh = new THREE.Group(), body = new THREE.Group();
  mesh.add(body);
  const mat = new THREE.MeshBasicMaterial({ color: a.color, side: THREE.DoubleSide });
  for (const sh of SHAPES[a.shape]()) body.add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), mat));
  const { eyes, pupils } = makeEyes(a.shape, body, M);
  const bubble = new THREE.Group();
  bubble.name = 'bubble';
  bubble.position.set(0.26, 0.6, 0.02);
  bubble.visible = false;
  body.add(bubble);
  bubble.add(new THREE.Mesh(B.out, M.ink));
  bubble.add(mk(B.inner, M.white, 0, 0, 0.005));
  const dots = [-1, 0, 1].map(j => { const d = mk(B.dot, M.ink, j * 0.11, 0, 0.01); bubble.add(d); return d; });
  mesh.visible = false;
  mesh.scale.setScalar(0.001);
  mesh.userData.agent = a.id;
  return { mesh, body, eyes, pupils, bubble, dots };
}
