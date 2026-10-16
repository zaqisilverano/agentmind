import { describe, it, expect } from "vitest";
import { sampleBrain } from "@/lib/sample/toolLibrary";
describe("sample brain", () => {
  it("is the Tool Library with 6 branches and 17 leaves", () => {
    const b = sampleBrain("#1B1A17");
    expect(b.title).toBe("Tool Library");
    expect(b.nodes.filter(n => n.depth === 1)).toHaveLength(6);
    expect(b.nodes.filter(n => n.depth === 2)).toHaveLength(17);
    expect(new Set(b.nodes.filter(n => n.depth === 1).map(n => n.kind)).size).toBe(6);
  });
});
