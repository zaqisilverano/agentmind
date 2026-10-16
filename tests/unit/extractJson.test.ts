import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/llm/extractJson";

describe("extractJson", () => {
  it("strips fences and prose", () => expect(extractJson("Sure!\n```json\n{\"a\":1}\n```\nDone")).toEqual({ a: 1 }));
  it("throws when no object", () => expect(() => extractJson("nope")).toThrow());
});
