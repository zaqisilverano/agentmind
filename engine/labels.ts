import * as THREE from 'three';
import type { Theme } from '@/engine/themes';
import type { IdeaNode } from '@/engine/types';
import type { Vec3 } from '@/engine/layout';

/** Where a node's label hangs: its current world position, visual radius (base · scale-in) and scale-in progress s ∈ [0, 1]. */
export type LabelAnchor = Vec3 & { r: number; s: number };

export interface Labels {
  /** Create, refresh and remove label divs so there is exactly one per node. */
  sync(nodes: IdeaNode[]): void;
  /**
   * Project every label, then place them in priority order with collision avoidance and dimming.
   * `project` returns undefined for a node that is not born yet (its label is hidden).
   * `related` is the selected node's ancestors and descendants (itself included); null when nothing is selected.
   * `hot` holds ids whose label text takes the theme's hot colour (hovered, selected, on the strongest path).
   * `distScale` is how far the camera was pulled back for a portrait screen; leaf labels fade by distance / distScale.
   */
  update(camera: THREE.Camera, project: (id: string) => LabelAnchor | undefined, selected: string | null,
    related: Set<string> | null, width: number, height: number, hot?: Set<string>, distScale?: number): void;
  recolor(theme: Theme): void;
  dispose(): void;
}

interface Label { node: IdeaNode; el: HTMLDivElement; key: string; w: number; h: number }

// Prototype numbers (idea-atlas-agents.prototype.js lines 566–573 and 750–764).
const BASE = 'position:absolute;left:0;top:0;white-space:nowrap;will-change:transform;';
const SERIF = 'var(--font-serif)', MONO = 'var(--font-mono)';
const FALLBACK_W = 80, FALLBACK_H = 16;
const LEAF_MIN_OPACITY = 0.35, DIM = 0.22, BRANCH_COLLIDE = 0.15;

const keyOf = (n: IdeaNode) => `${n.depth}|${n.kind}|${n.name}`;

export function createLabels(layer: HTMLElement, theme: Theme): Labels {
  let t = theme;
  let labels = new Map<string, Label>();
  let order: Label[] = [];
  const v = new THREE.Vector3();

  // buildGraph, lines 566–573: markup and inline styles per depth.
  const render = (l: Label) => {
    const { node: n, el } = l;
    el.className = 'atlas-label';
    el.dataset.kind = n.kind;
    el.dataset.depth = String(n.depth);
    el.replaceChildren();
    const base = BASE + 'color:' + t.ink + ';';
    if (n.depth === 0) {
      el.style.cssText = base + `font-family:${SERIF};font-style:italic;font-size:19px;line-height:1;padding:3px 10px 4px;border-radius:999px;background:${t.accent};border:1px solid ${t.ink};`;
      el.textContent = n.name;
    } else if (n.depth === 1) {
      el.style.cssText = base;
      const kind = document.createElement('div');
      kind.style.cssText = `font-family:${MONO};font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:${t.muted}`;
      kind.textContent = n.kind;
      const name = document.createElement('div');
      name.style.cssText = `font-family:${SERIF};font-size:20px;line-height:1`;
      name.textContent = n.name;
      el.append(kind, name);
    } else {
      el.style.cssText = base + `font-family:${MONO};font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;`;
      el.textContent = n.name;
    }
    el.style.opacity = '0';
    l.key = keyOf(n);
    l.w = 0; l.h = 0;
  };

  return {
    sync(nodes) {
      const next = new Map<string, Label>();
      for (const n of nodes) {
        let l = labels.get(n.id);
        if (l) {
          l.node = n;
          if (l.key !== keyOf(n)) render(l);
          else { l.w = 0; l.h = 0; } // the prototype re-measures every label after a rebuild
        } else {
          l = { node: n, el: document.createElement('div'), key: '', w: 0, h: 0 };
          render(l);
          layer.appendChild(l.el);
        }
        next.set(n.id, l);
      }
      for (const [id, l] of labels) if (!next.has(id)) l.el.remove();
      labels = next;
      order = [...next.values()];
    },

    // tick, lines 750–764.
    update(camera, project, selected, related, width, height, hot, distScale = 1) {
      const cam = camera.position;
      const anchors = new Map<Label, LabelAnchor>();
      for (const l of order) {
        const a = project(l.node.id);
        if (a) anchors.set(l, a); else l.el.style.opacity = '0';
      }
      // Selected first, then by depth (stable, so ties keep node order).
      const placed = [...anchors.keys()].sort((a, b) =>
        a.node.id === selected ? -1 : b.node.id === selected ? 1 : a.node.depth - b.node.depth);
      const boxes: [number, number, number, number][] = [];
      for (const l of placed) {
        const a = anchors.get(l)!, n = l.node, el = l.el;
        v.set(a.x, a.y, a.z).project(camera);
        if (v.z > 1) { el.style.opacity = '0'; continue; }
        const x = (v.x + 1) / 2 * width, y = (1 - v.y) / 2 * height;
        const dist = cam.distanceTo(v.set(a.x, a.y, a.z));
        const px = a.r * 28 / Math.max(1, dist) * 18 + 8;
        el.style.transform = 'translate(' + (x + px).toFixed(1) + 'px,' + y.toFixed(1) + 'px) translateY(-50%)';
        let op = n.depth >= 2 ? Math.max(LEAF_MIN_OPACITY, Math.min(1, 1.6 - dist / distScale / 30)) : 1;
        if (selected && related && !related.has(n.id)) op *= DIM;
        const bw = l.w || (l.w = el.offsetWidth || FALLBACK_W), bh = l.h || (l.h = el.offsetHeight || FALLBACK_H);
        const bx = x + px, by = y - bh / 2;
        if (boxes.some(b => bx < b[2] && bx + bw > b[0] && by < b[3] && by + bh > b[1])) op = n.depth >= 2 ? 0 : op * BRANCH_COLLIDE;
        else boxes.push([bx - 4, by - 2, bx + bw + 4, by + bh + 2]);
        el.style.opacity = (op * Math.min(1, a.s * 1.5)).toFixed(2);
        el.style.color = n.depth === 0 ? t.onAccent : hot?.has(n.id) ? t.hot : t.ink;
      }
    },

    // applyTheme → buildGraph(false), lines 390–401: labels are rebuilt with the new colours.
    recolor(theme) {
      t = theme;
      for (const l of order) { const op = l.el.style.opacity, tr = l.el.style.transform; render(l); l.el.style.opacity = op; l.el.style.transform = tr; }
    },

    dispose() {
      for (const l of order) l.el.remove();
      labels = new Map();
      order = [];
    },
  };
}
