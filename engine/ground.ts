import * as THREE from 'three';
import { GROUND_Y, orbitParams } from '@/engine/layout';
import type { Theme } from '@/engine/themes';
import type { Mode } from '@/engine/types';

export type HeightField = (x: number, z: number) => number;

export interface Ground {
  /** Rings, spokes and ridgelines. Its y eases toward GROUND_Y[mode]. */
  group: THREE.Group;
  /** Per-branch orbit rings. Added to the scene directly (prototype line 452): they do not move with the ground. */
  orbitGroup: THREE.Group;
  update(mode: Mode, dt: number): void;
  setBranches(branchIds: string[]): void;
  setHeightField(fn: HeightField | null): void;
  /** Ground surface height under (x, z) for drop lines: ground y plus the terrain once it is more than half blended in (prototype line 666). */
  surfaceY(x: number, z: number): number;
  recolor(theme: Theme): void;
  dispose(): void;
}

// Prototype numbers (idea-atlas-agents.prototype.js lines 426–452, 582–584, 635–648).
const RING_MIN = 2, RING_MAX = 14, RING_STEP = 2, SEGMENTS = 128;
const SPOKES = 24, SPOKE_OPACITY = 0.07;
const ROWS = 46, COLS = 110, RIDGE_R = 14, RIDGE_Z = 13.6;
const RIDGE_OPACITY = 0.45, ORBIT_OPACITY = 0.22, TERRAIN_RING_DIM = 0.6;
const INITIAL_Y = -5.5;

function circlePoints(r: number, tilt = 0): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let a = 0; a <= SEGMENTS; a++) {
    const t = a / SEGMENTS * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r * tilt, Math.sin(t) * r));
  }
  return pts;
}

export function createGround(three: { scene: THREE.Scene }, theme: Theme, mode: Mode): Ground {
  const { scene } = three;
  const ink = new THREE.Color(theme.ink);
  let currentTheme = theme;
  let heightFn: HeightField | null = null;
  // Eased state: ground y, terrain blend K, orbit-ring visibility (prototype lines 425, 636–638).
  let groundY = INITIAL_Y, K = 0, orbitVis = 0;
  void mode; // initial mode only matters through update(); the prototype starts from the same eased state for every mode.

  const group = new THREE.Group();
  group.position.y = groundY;
  scene.add(group);
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const track = <G extends THREE.BufferGeometry>(g: G): G => { geometries.push(g); return g; };

  // Rings r = 2..14, 128 segments (lines 427–431).
  const ringMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: theme.ring });
  for (let r = RING_MIN; r <= RING_MAX; r += RING_STEP) {
    group.add(new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(circlePoints(r))), ringMat));
  }

  // 24 spokes from r = 2 to r = 14 (lines 432–437).
  const spokeMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: SPOKE_OPACITY });
  const sp: number[] = [];
  for (let i = 0; i < SPOKES; i++) {
    const a = i / SPOKES * Math.PI * 2;
    sp.push(Math.cos(a) * RING_MIN, 0, Math.sin(a) * RING_MIN, Math.cos(a) * RING_MAX, 0, Math.sin(a) * RING_MAX);
  }
  const spG = track(new THREE.BufferGeometry());
  spG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  group.add(new THREE.LineSegments(spG, spokeMat));

  // Terrain ridgelines: 46 rows × 110 columns clipped to a 14-unit circle (lines 440–449).
  // Flat (y = 0) until a height field is supplied.
  const ridgeMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0 });
  const ridges: { line: THREE.Line; z: number; half: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    const z = -RIDGE_Z + r / (ROWS - 1) * RIDGE_Z * 2;
    const half = Math.sqrt(Math.max(0, RIDGE_R * RIDGE_R - z * z));
    const pos = new THREE.BufferAttribute(new Float32Array(COLS * 3), 3);
    for (let c = 0; c < COLS; c++) pos.setXYZ(c, -half + c / (COLS - 1) * half * 2, 0, z);
    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', pos);
    const line = new THREE.Line(g, ridgeMat);
    group.add(line);
    ridges.push({ line, z, half });
  }

  // Orbit rings, one per branch (lines 451–452, 582–584). Own geometries, rebuilt by setBranches.
  const orbitMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0 });
  const clearOrbits = () => {
    while (orbitGroup.children.length) {
      const c = orbitGroup.children[0] as THREE.Line;
      c.geometry.dispose();
      orbitGroup.remove(c);
    }
  };

  const materials = [ringMat, spokeMat, ridgeMat, orbitMat];

  return {
    group,
    orbitGroup,

    setBranches(branchIds) {
      clearOrbits();
      branchIds.forEach((id, i) => {
        const { R, tilt } = orbitParams(id, i);
        orbitGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(R, tilt)), orbitMat));
      });
    },

    setHeightField(fn) { heightFn = fn; },

    surfaceY(x, z) { return groundY + (heightFn && K > 0.5 ? heightFn(x, z) * K : 0); },

    // tick, lines 633–648.
    update(m, dt) {
      const k = 1 - Math.exp(-dt / 260);
      groundY += (GROUND_Y[m] - groundY) * k;
      K += ((m === 'terrain' ? 1 : 0) - K) * k;
      orbitVis += ((m === 'orbit' ? 1 : 0) - orbitVis) * k;
      group.position.y = groundY;
      ringMat.opacity = currentTheme.ring * (1 - K * TERRAIN_RING_DIM);
      ridgeMat.opacity = RIDGE_OPACITY * K;
      orbitMat.opacity = ORBIT_OPACITY * orbitVis;
      if (heightFn && K > 0.003) {
        for (const { line, z, half } of ridges) {
          const a = line.geometry.attributes.position as THREE.BufferAttribute;
          for (let c = 0; c < COLS; c++) {
            const x = -half + c / (COLS - 1) * half * 2;
            a.setXYZ(c, x, heightFn(x, z) * K, z);
          }
          a.needsUpdate = true;
        }
      }
    },

    // applyTheme, lines 390–395: line materials take the ink colour; ring opacity follows theme.ring.
    recolor(t) {
      currentTheme = t;
      const c = new THREE.Color(t.ink);
      for (const m of materials) m.color.copy(c);
      ringMat.opacity = t.ring * (1 - K * TERRAIN_RING_DIM);
    },

    dispose() {
      clearOrbits();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      scene.remove(group);
      scene.remove(orbitGroup);
    },
  };
}
