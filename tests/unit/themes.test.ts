import { describe, it, expect } from "vitest";
import { THEMES, themeCss } from "@/engine/themes";
import { readFileSync } from "node:fs";
describe("themes", () => {
  it("has the three themes with spec colours", () => {
    expect(THEMES.atlas.bg).toBe("#EEEAE0"); expect(THEMES.observatory.accent).toBe("#F2A33A"); expect(THEMES.blueprint.panel).toBe("#22479E");
  });
  it("generated css is checked in and current", () => {
    const css = readFileSync("app/theme.generated.css", "utf8");
    expect(css).toBe(themeCss());
  });
});
