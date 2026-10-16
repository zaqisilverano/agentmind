import { describe, it, expect } from "vitest";
import { fallback } from "@/lib/llm/fallback";
import { MapReplySchema, AgentRoundReplySchema, TakeawayReplySchema, ExpandReplySchema } from "@/lib/llm/schemas";
import { sampleBrain } from "@/lib/sample/toolLibrary";

describe("fallback output passes the schemas", () => {
  const b = sampleBrain("#111");
  it("map", () => expect(MapReplySchema.safeParse(fallback.map("A tool library for drills and ladders")).success).toBe(true));
  it("expand", () => expect(ExpandReplySchema.safeParse(fallback.expand(["Tool Library", "Idle ownership"], "why?")).success).toBe(true));
  it("agentRound for every agent", () => {
    for (const a of ["researcher", "builder", "customer", "skeptic", "strategist"] as const)
      expect(AgentRoundReplySchema.safeParse(fallback.agentRound(a, b.nodes[1], b.nodes)).success).toBe(true);
  });
  it("takeaway picks a deep or linked leaf", () => {
    const t = fallback.takeaway(b.nodes, []);
    expect(TakeawayReplySchema.safeParse(t).success).toBe(true);
    expect(b.nodes.find(n => n.id === t.leaf)?.depth).toBe(2);
  });
});

describe("fallback details", () => {
  const b = sampleBrain("#111");
  it("expand adds a question child capped at 60 chars", () => {
    const r = fallback.expand(["T", "Node"], "x".repeat(100));
    expect(r.children).toHaveLength(4);
    expect(r.children[3].name).toBe("Answer: " + "x".repeat(40));
    expect(r.children[3].note).toBe("Grown from the question asked on Node");
    expect(fallback.expand(["T", "Node"]).children).toHaveLength(3);
  });
  it("takeaway prefers a linked node and writes three sentences", () => {
    const t = fallback.takeaway(b.nodes, [{ a: "b1c0", b: "b2c0", why: "w", by: "researcher" }]);
    expect(t.leaf).toBe("b1c0");
    expect(t.verdict).toBe("Pursue Apartment renters.");
    expect(t.brief.match(/\./g)).toHaveLength(3);
  });
  it("agentRound links only to a different branch", () => {
    const r = fallback.agentRound("skeptic", b.nodes[1], b.nodes);
    const other = b.nodes.find(n => n.id === r.links[0].b)!;
    expect(r.links[0].a).toBe("b0");
    expect(other.id.startsWith("b0")).toBe(false);
  });
});
