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
