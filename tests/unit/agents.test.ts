import { describe, it, expect } from "vitest";
import { AGENTS, agentForRound } from "@/lib/agents/roster";
import { pickTarget } from "@/lib/agents/pickTarget";
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
    const t = pickTarget(builder, nodes, {}, () => 0);
    expect(t.kind).toBe("Mechanism");
    expect(t.depth).toBeGreaterThanOrEqual(1);
  });
  it("falls back to the core when nothing qualifies", () => expect(pickTarget(AGENTS[0], [nodes[0]], {}, () => 0).id).toBe("n0"));
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
