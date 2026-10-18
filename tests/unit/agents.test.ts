import { describe, it, expect } from "vitest";
import { AGENTS, agentForRound } from "@/lib/agents/roster";
import { pickTarget, subtreeIds } from "@/lib/agents/pickTarget";
import { makeKids } from "@/lib/agents/makeKids";
import { sampleBrain } from "@/lib/sample/toolLibrary";
const nodes = sampleBrain("#111").nodes;
describe("roster", () => {
  it("has five agents in order", () => expect(AGENTS.map(a => a.id)).toEqual(["researcher","builder","customer","skeptic","strategist"]));
  it("only the skeptic is a critic", () => expect(AGENTS.filter(a => a.critic).map(a => a.id)).toEqual(["skeptic"]));
  it("cycles by round", () => expect(agentForRound(7).id).toBe("customer"));
});
describe("pickTarget", () => {
  it("prefers the agent's kinds and the thinnest node", () => {
    const builder = AGENTS[1];
    const t = pickTarget(builder, nodes, {}, () => 0)!;
    expect(t.kind).toBe("Mechanism");
    expect(t.depth).toBeGreaterThanOrEqual(1);
  });
  it("falls back to the core when nothing qualifies", () => expect(pickTarget(AGENTS[0], [nodes[0]], {}, () => 0)?.id).toBe("n0"));
});
describe("subtreeIds", () => {
  it("holds the node and all its descendants, in any array order", () => {
    const shuffled = [...nodes].reverse();
    const ids = subtreeIds(shuffled, "b2");
    expect([...ids].sort()).toEqual(nodes.filter(n => n.id === "b2" || n.parent === "b2" || nodes.find(p => p.id === n.parent)?.parent === "b2").map(n => n.id).sort());
    expect(ids.has("n0")).toBe(false);
    expect(ids.has("b0")).toBe(false);
  });
  it("is empty for an unknown node", () => expect(subtreeIds(nodes, "nope").size).toBe(0));
  it("of the core is the whole map", () => expect(subtreeIds(nodes, "n0").size).toBe(nodes.length));
});
describe("pickTarget with a scope", () => {
  const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
  it("never leaves the scope, for every agent and many random draws", () => {
    for (const root of ["b0", "b2", "b4c0"]) {
      const scope = subtreeIds(nodes, root);
      for (const agent of AGENTS) {
        for (let k = 0; k < 20; k++) {
          const t = pickTarget(agent, nodes, {}, seq(k / 20, (k * 7 % 20) / 20, 0.99), scope);
          expect(scope.has(t!.id)).toBe(true);
        }
      }
    }
  });
  it("prefers the agent's own kinds inside the scope when any match", () => {
    const b2 = nodes.find(n => n.id === "b2")!;
    const own = AGENTS.find(a => a.kinds.includes(b2.kind) && !a.critic)!;
    const mixed = [...nodes, { ...b2, id: "b2xq0", parent: "b2", depth: 2, kind: "Value" as const, position: 9 }];
    const valueAgent = AGENTS.find(a => a.kinds.includes("Value") && !a.kinds.includes(b2.kind) && !a.critic)!;
    expect(pickTarget(valueAgent, mixed, {}, () => 0, subtreeIds(mixed, "b2"))?.id).toBe("b2xq0");
    expect(pickTarget(own, mixed, {}, () => 0, subtreeIds(mixed, "b2"))?.kind).toBe(b2.kind);
  });
  it("falls back to any scoped node when no kind matches", () => {
    const b2 = nodes.find(n => n.id === "b2")!;
    const other = AGENTS.find(a => !a.kinds.includes(b2.kind) && !a.critic)!;
    const scope = subtreeIds(nodes, "b2");
    const t = pickTarget(other, nodes, {}, () => 0, scope)!;
    expect(scope.has(t.id)).toBe(true);
  });
  it("allows the scope node itself, also deeper than depth 3 and when it is the core", () => {
    const deep = nodes.find(n => n.depth === 2)!;
    const leaf = { ...deep, id: "deep4", parent: deep.id, depth: 4, position: 9 };
    const withLeaf = [...nodes, { ...deep, id: "deep3", parent: deep.id, depth: 3, position: 8 }, { ...leaf, parent: "deep3" }];
    expect(pickTarget(AGENTS[0], withLeaf, {}, () => 0, subtreeIds(withLeaf, "deep4"))?.id).toBe("deep4");
    expect(pickTarget(AGENTS[0], [nodes[0]], {}, () => 0, new Set(["n0"]))?.id).toBe("n0");
  });
  it("returns nothing when the scope holds no node", () => {
    expect(pickTarget(AGENTS[0], nodes, {}, () => 0, new Set())).toBeUndefined();
  });
});
describe("makeKids", () => {
  it("inherits kind, increments depth, flags critics", () => {
    const target = nodes.find(n => n.id === "b2")!;
    const kids = makeKids(target, [{ name: "a", note: "" }, { name: "b", note: "" }], AGENTS[3], "#111", "zz");
    expect(kids.map(k => k.id)).toEqual(["b2xzz0", "b2xzz1"]);
    expect(kids[0]).toMatchObject({ kind: "Risk", critic: true, depth: 2, by: "skeptic", color: "#9B3FB5", userNote: "", position: 0 });
  });
  it("children of the core cycle kinds", () => {
    const kids = makeKids(nodes[0], Array(3).fill({ name: "x", note: "" }), AGENTS[0], "#111", "zz");
    expect(kids.map(k => k.kind)).toEqual(["Problem","People","Mechanism"]);
  });
  it("non-critics inherit the target kind and caps at four", () => {
    const target = nodes.find(n => n.id === "b2")!;
    const kids = makeKids(target, Array.from({ length: 6 }, (_, i) => ({ name: "k" + i, note: "n" })), AGENTS[1], "#111", "zz");
    expect(kids).toHaveLength(4);
    expect(kids[3]).toMatchObject({ kind: "Mechanism", critic: false, by: "builder", parent: "b2", position: 3, note: "n" });
  });
});
