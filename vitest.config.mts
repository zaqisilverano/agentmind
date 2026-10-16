import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts", "tests/routes/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
