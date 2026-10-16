import type { IdeaNode, Mode } from '@/engine/types';

export type Vec3 = { x: number; y: number; z: number };
export type Peak = { x: number; z: number; a: number };

export const GROUND_Y: Record<Mode, number> = { constellation: -5.8, orbit: -3.2, terrain: 0 };

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const lengthSq = (a: Vec3) => a.x * a.x + a.y * a.y + a.z * a.z;
const normalize = (a: Vec3): Vec3 => { const l = Math.sqrt(lengthSq(a)); return l === 0 ? a : scale(a, 1 / l); };

/** FNV-1a string hash folded to [0, 1). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

const branchesOf = (nodes: IdeaNode[]) => nodes.filter(n => n.depth === 1).sort((a, b) => a.position - b.position);

const childrenOf = (nodes: IdeaNode[]): Record<string, string[]> => {
  const kids: Record<string, string[]> = {};
  for (const n of nodes) if (n.parent !== null) (kids[n.parent] ||= []).push(n.id);
  return kids;
};

export function orbitParams(branchId: string, i: number): { R: number; tilt: number } {
  return { R: 3.6 + i * 1.35, tilt: (hash(branchId + 't') - 0.5) * 0.5 };
}

export function buildPeaks(nodes: IdeaNode[]): Peak[] {
  const b1 = branchesOf(nodes), n = b1.length, kids = childrenOf(nodes);
  return [{ x: 0, z: 0, a: 1.7 }].concat(b1.map((o, i) => {
    const a = i / n * Math.PI * 2 + 0.3, R = i % 2 ? 7.4 : 5.2;
    return { x: Math.cos(a) * R, z: Math.sin(a) * R, a: 1.5 + (kids[o.id] || []).length * 0.55 };
  }));
}

export function heightAt(peaks: Peak[], x: number, z: number): number {
  let h = 0;
  for (const p of peaks) { const d2 = (x - p.x) ** 2 + (z - p.z) ** 2; h += p.a * Math.exp(-d2 / 4.2); }
  return h;
}

export function computeTargets(nodes: IdeaNode[], mode: Mode, t: number): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  const b1 = branchesOf(nodes), n = b1.length, kids = childrenOf(nodes), peaks = buildPeaks(nodes);
  const byId: Record<string, IdeaNode> = {};
  for (const nd of nodes) byId[nd.id] = nd;

  for (const nd of nodes) if (nd.depth === 0) out[nd.id] = v3(0, mode === 'terrain' ? heightAt(peaks, 0, 0) + 0.9 : 0, 0);

  b1.forEach((nd, i) => {
    if (mode === 'constellation') {
      const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996 + 0.6;
      out[nd.id] = v3(Math.cos(th) * r * 6.8, y * 4.4, Math.sin(th) * r * 6.8);
    } else if (mode === 'orbit') {
      const { R, tilt } = orbitParams(nd.id, i);
      const a = i * 2.39996 + t * 0.00011 * (8 / R);
      out[nd.id] = v3(Math.cos(a) * R, Math.sin(a) * R * tilt, Math.sin(a) * R);
    } else {
      const p = peaks[i + 1];
      out[nd.id] = v3(p.x, heightAt(peaks, p.x, p.z) + 0.55, p.z);
    }
  });

  const deep = nodes.filter(nd => nd.depth >= 2).sort((a, b) => a.depth - b.depth);
  const up = v3(0, 1, 0);
  for (const nd of deep) {
    const p = byId[nd.parent as string], gp = p && p.parent !== null ? byId[p.parent] : undefined;
    const pt = p && out[p.id], gpt = gp && out[gp.id];
    if (!pt || !gpt) continue;
    let dirOut = sub(pt, gpt);
    if (lengthSq(dirOut) < 1e-4) dirOut = v3(1, 0, 0);
    dirOut = normalize(dirOut);
    const u = normalize(cross(dirOut, Math.abs(dirOut.y) > 0.9 ? v3(1, 0, 0) : up));
    const v = normalize(cross(dirOut, u));
    const sib = kids[p.id], k = sib.indexOf(nd.id), m = sib.length;
    const ang = k / m * Math.PI * 2 + hash(p.id) * 6.28;
    const r = 2.2 * Math.pow(0.72, nd.depth - 2);
    const dir = normalize(add(add(scale(dirOut, 0.9), scale(u, Math.cos(ang) * 0.9)), scale(v, Math.sin(ang) * 0.9)));
    const pos = add(pt, scale(dir, r));
    if (mode === 'terrain') {
      const h = heightAt(peaks, pos.x, pos.z);
      pos.y = Math.max(pos.y * 0.25 + h * 0.75, h + 0.2);
    }
    out[nd.id] = pos;
  }
  return out;
}
