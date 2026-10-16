import { describe, it, expect } from "vitest";
import { fromBranches, childId } from "@/lib/ids";
describe("fromBranches", () => {
  it("builds n0, b0.., b0c0.. with inherited kind and colour", () => {
    const r = fromBranches({ title: "T", summary: "S", branches: [{ name: "A", kind: "Problem", note: "n", children: [{ name: "a1", note: "" }] }] }, "#111");
    expect(r.nodes.map(n => n.id)).toEqual(["n0", "b0", "b0c0"]);
    expect(r.nodes[0]).toMatchObject({ kind: "Core", depth: 0, parent: null, color: "#111" });
    expect(r.nodes[2]).toMatchObject({ kind: "Problem", depth: 2, parent: "b0", color: "#E0482B", position: 0 });
  });
  it("caps at 7 branches and 5 children and falls back on unknown kind", () => {
    const branches = Array.from({ length: 9 }, (_, i) => ({ name: "B" + i, kind: "Bogus" as never, note: "", children: Array.from({ length: 7 }, (_, j) => ({ name: "c" + j, note: "" })) }));
    const r = fromBranches({ title: "T", summary: "S", branches }, "#111");
    expect(r.nodes.filter(n => n.depth === 1)).toHaveLength(7);
    expect(r.nodes.filter(n => n.parent === "b0")).toHaveLength(5);
    expect(r.nodes[1].kind).toBe("Problem");
  });
  it("childId uses parent + x + stamp + k", () => expect(childId("b2", 3, "zz")).toBe("b2xzz3"));
});
