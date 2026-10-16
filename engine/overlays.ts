import * as THREE from 'three';
import type { Theme } from '@/engine/themes';
import type { CrossLink } from '@/engine/types';

/** Cross-link arcs, strongest-path segments with travelling beads, and the selection reticle. */
export interface Overlays {
  setLinks(links: CrossLink[], maxPath: number): void;
  setReveal(key: string, progress: number | null): void;
  update(now: number, k: number, posOf: (id: string) => THREE.Vector3 | undefined, path: THREE.Vector3[],
    selected: { pos: THREE.Vector3; base: number } | null): void;
  /** Point on the arc `a~b` at t ∈ [0, 1] (for agents travelling along a link), or undefined. */
  arcPoint(key: string, t: number): THREE.Vector3 | undefined;
  recolor(theme: Theme): void;
  dispose(): void;
}

// Prototype numbers (idea-atlas-agents.prototype.js lines 461–469, 674–692, 734–737).
const ARC_N = 24, BEADS = 40, BEADS_PER_SEG = 5, BEAD_SCALE = 0.075;
const RETICLE_PULSE = 0.004, RETICLE_SCALE = 1.4;

export function createOverlays(parent: THREE.Object3D, camera: THREE.Camera, theme: Theme): Overlays {
  const accent = new THREE.Color(theme.accent);

  // Cross-link arcs: dashed accent, one 25-point Line each (lines 464–465, 591–594).
  const xMat = new THREE.LineDashedMaterial({ color: accent, dashSize: 0.28, gapSize: 0.18, transparent: true, opacity: 0.9 });
  const xGroup = new THREE.Group();
  parent.add(xGroup);
  let arcs: { key: string; l: CrossLink; line: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial> }[] = [];
  const revealing = new Map<string, number>();

  // Strongest path: accent segments plus beads (lines 466–469).
  const pathSeg = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 1 }));
  pathSeg.frustumCulled = false;
  parent.add(pathSeg);
  const beadGeo = new THREE.SphereGeometry(1, 10, 8);
  const beadMat = new THREE.MeshBasicMaterial({ color: accent });
  const beads = Array.from({ length: BEADS }, () => { const b = new THREE.Mesh(beadGeo, beadMat); b.visible = false; parent.add(b); return b; });

  // Reticle (line 461).
  const reticle = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.6, 64),
    new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
  parent.add(reticle);

  const clearArcs = () => { for (const a of arcs) { a.line.geometry.dispose(); xGroup.remove(a.line); } arcs = []; };
  const ctrl = new THREE.Vector3(), outv = new THREE.Vector3();

  return {
    setLinks(links, maxPath) {
      clearArcs();
      arcs = links.map(l => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARC_N + 1) * 3), 3));
        const line = new THREE.Line(g, xMat);
        line.frustumCulled = false;
        line.visible = false;
        xGroup.add(line);
        return { key: l.a + '~' + l.b, l, line };
      });
      const n = Math.max(1, maxPath);
      const a = pathSeg.geometry.attributes.position as THREE.BufferAttribute | undefined;
      if (!a || a.count !== n * 2) {
        pathSeg.geometry.dispose();
        pathSeg.geometry = new THREE.BufferGeometry();
        pathSeg.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
        pathSeg.geometry.setDrawRange(0, 0);
      }
    },

    setReveal(key, progress) {
      if (progress === null) revealing.delete(key); else revealing.set(key, progress);
    },

    // tick, lines 674–692 and 734–737.
    update(now, k, posOf, path, selected) {
      for (const x of arcs) {
        const p0 = posOf(x.l.a), p2 = posOf(x.l.b);
        x.line.visible = !!p0 && !!p2;
        if (!p0 || !p2) continue;
        const dist = p0.distanceTo(p2);
        ctrl.addVectors(p0, p2).multiplyScalar(0.5);
        outv.set(ctrl.x, 0, ctrl.z);
        if (outv.lengthSq() < 0.01) outv.set(1, 0, 0);
        outv.normalize();
        ctrl.addScaledVector(outv, dist * 0.22); ctrl.y += dist * 0.2;
        const XP = x.line.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i <= ARC_N; i++) {
          const t = i / ARC_N, u = 1 - t;
          XP.setXYZ(i, u * u * p0.x + 2 * u * t * ctrl.x + t * t * p2.x, u * u * p0.y + 2 * u * t * ctrl.y + t * t * p2.y, u * u * p0.z + 2 * u * t * ctrl.z + t * t * p2.z);
        }
        XP.needsUpdate = true;
        x.line.computeLineDistances();
        const rv = revealing.get(x.key);
        x.line.geometry.setDrawRange(0, rv === undefined ? ARC_N + 1 : Math.max(2, Math.ceil(rv * (ARC_N + 1))));
      }

      const PS = pathSeg.geometry.attributes.position as THREE.BufferAttribute;
      let pi = 0, bi = 0;
      for (let i = 1; i < path.length && pi + 1 < PS.count; i++) {
        const a = path[i - 1], b = path[i];
        PS.setXYZ(pi++, a.x, a.y, a.z); PS.setXYZ(pi++, b.x, b.y, b.z);
        for (let j = 0; j < BEADS_PER_SEG && bi < beads.length; j++) {
          const bd = beads[bi++];
          bd.visible = true;
          bd.position.lerpVectors(a, b, (now * 0.0005 + j / BEADS_PER_SEG) % 1);
          bd.scale.setScalar(BEAD_SCALE);
        }
      }
      for (; bi < beads.length; bi++) beads[bi].visible = false;
      PS.needsUpdate = true;
      pathSeg.geometry.setDrawRange(0, pi);

      reticle.material.opacity += ((selected ? 1 : 0) - reticle.material.opacity) * k;
      if (selected) {
        reticle.position.copy(selected.pos);
        reticle.scale.setScalar(selected.base * RETICLE_SCALE * (1 + Math.sin(now * RETICLE_PULSE) * 0.05));
        reticle.lookAt(camera.position);
      }
    },

    // Agent arc travel, line 714: linear interpolation between the arc's sample points.
    arcPoint(key, t) {
      const x = arcs.find(a => a.key === key);
      if (!x || !x.line.visible) return undefined;
      const XP = x.line.geometry.attributes.position as THREE.BufferAttribute;
      const idx = Math.max(0, Math.min(1, t)) * ARC_N, i0 = Math.min(ARC_N, Math.floor(idx)), i1 = Math.min(ARC_N, i0 + 1), fr = idx - i0;
      return new THREE.Vector3(
        XP.getX(i0) + (XP.getX(i1) - XP.getX(i0)) * fr,
        XP.getY(i0) + (XP.getY(i1) - XP.getY(i0)) * fr,
        XP.getZ(i0) + (XP.getZ(i1) - XP.getZ(i0)) * fr);
    },

    // applyTheme, lines 396–398.
    recolor(t) {
      for (const m of [xMat, pathSeg.material, beadMat, reticle.material]) m.color.set(t.accent);
    },

    dispose() {
      clearArcs();
      parent.remove(xGroup, pathSeg, reticle, ...beads);
      pathSeg.geometry.dispose(); pathSeg.material.dispose();
      beadGeo.dispose(); beadMat.dispose();
      reticle.geometry.dispose(); reticle.material.dispose();
      xMat.dispose();
      revealing.clear();
    },
  };
}
