import { describe, it, expect } from "vitest";
import { MapReplySchema, AgentRoundReplySchema, TakeawayReplySchema, ExpandReplySchema } from "@/lib/llm/schemas";

const branch = (kind: string) => ({ name: "B", kind, note: "n", children: [{ name: "c", note: "" }, { name: "d", note: "" }] });

describe("MapReplySchema", () => {
  it("accepts 5 distinct kinds", () => expect(MapReplySchema.safeParse({ title: "T", summary: "S", branches: ["Problem", "People", "Mechanism", "Value", "Risk"].map(branch) }).success).toBe(true));
  it("rejects duplicate kinds", () => expect(MapReplySchema.safeParse({ title: "T", summary: "S", branches: ["Problem", "Problem", "People", "Value", "Risk"].map(branch) }).success).toBe(false));
  it("rejects 4 branches", () => expect(MapReplySchema.safeParse({ title: "T", summary: "S", branches: ["Problem", "People", "Value", "Risk"].map(branch) }).success).toBe(false));
});

describe("other schemas", () => {
  it("expand caps children at 5", () => expect(ExpandReplySchema.safeParse({ children: Array(6).fill({ name: "x", note: "" }) }).success).toBe(false));
  it("agent round needs 1-3 children, 0-1 links", () => {
    expect(AgentRoundReplySchema.safeParse({ thought: "t", children: [{ name: "a", note: "" }], links: [] }).success).toBe(true);
    expect(AgentRoundReplySchema.safeParse({ thought: "t", children: [{ name: "a", note: "" }], links: [{ a: "b0", b: "b1", why: "w" }, { a: "b0", b: "b2", why: "w" }] }).success).toBe(false);
  });
  it("takeaway", () => expect(TakeawayReplySchema.safeParse({ leaf: "b0c0", verdict: "v", brief: "b" }).success).toBe(true));
});
