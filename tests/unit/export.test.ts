import { describe, it, expect } from "vitest";
import { toMarkdown } from "@/lib/export/markdown";
import { toJson } from "@/lib/export/json";
import { fixtureBrain } from "../fixtures/brain";
describe("exports", () => {
  const b = fixtureBrain();
  it("markdown has title, branch headings, nested bullets, notes, takeaway and links", () => {
    const md = toMarkdown(b);
    expect(md).toMatch(/^# Tool Library\n/);
    expect(md).toContain("## Idle ownership (Problem)");
    expect(md).toContain("  - **Garage clutter**");
    expect(md).toContain("> My note: keep");
    expect(md).toContain("## Key takeaway");
    expect(md).toContain("## Cross-links");
  });
  it("markdown nests generated children one level deeper with the note under its bullet", () => {
    const md = toMarkdown(b);
    expect(md).toContain("    - **");
    expect(md).toContain("    > My note: keep");
    expect(md).toContain("- Garage clutter → Deposit system (w)");
    expect(md).toContain("Pursue Deposit system.");
  });
  it("json is a nested tree with links and synthesis", () => {
    const j = JSON.parse(toJson(b));
    expect(j.branches[0].children[0].name).toBe("Garage clutter");
    expect(j.links[0]).toMatchObject({ from: "Garage clutter", to: "Deposit system" });
    expect(j.synthesis.verdict).toBeTruthy();
  });
  it("json synthesis is null without a takeaway", () => {
    expect(JSON.parse(toJson({ ...b, synth: null })).synthesis).toBeNull();
  });
});
