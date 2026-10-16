import { describe, it, expect } from "vitest";
import { PROMPTS, mapLines } from "@/lib/llm/prompts";
import { sampleBrain } from "@/lib/sample/toolLibrary";

describe("prompts", () => {
  const b = sampleBrain("#111");
  it("mapLines formats id | name | kind | parent", () => {
    expect(mapLines(b.nodes).split("\n").slice(0, 2)).toEqual(["n0 | Tool Library | Core | parent -", "b0 | Idle ownership | Problem | parent n0"]);
  });
  it("agent system prompt wraps name and brief", () => {
    expect(PROMPTS.agentRound.system({ name: "Skeptic", brief: "Attacks." })).toBe("You are the Skeptic agent on a brainstorming team. Attacks. Reply with JSON only.");
  });
  it("expand user prompt includes the question only when given", () => {
    const a = { title: "T", summary: "S", path: ["T", "N"], existing: ["x"] };
    expect(PROMPTS.expand.user(a)).not.toContain("The user asks");
    expect(PROMPTS.expand.user({ ...a, question: "why?" })).toContain('The user asks: "why?"');
  });
});
