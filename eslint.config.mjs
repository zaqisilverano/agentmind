import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// `pnpm lint` runs `eslint .` over the whole repo (Next 16 removed `next lint`).
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".superpowers/**",
    "public/**",
    "docs/reference/prototype/**",
    "next-env.d.ts",
  ]),
  {
    rules: { "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] },
  },
  // Boundary rule (CLAUDE.md): the engine and the pure lib modules import nothing from React, Next, the database or the
  // server-only API helpers. Type-only imports are fine.
  {
    files: ["engine/**", "lib/llm/**", "lib/agents/**", "lib/export/**", "lib/sample/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: ["react", "next", "@/db", "@/lib/api", "@/lib/identity"].map((name) => ({
            name,
            message: "Boundary rule: engine/ and lib/{llm,agents,export,sample} must not depend on React, Next, the db or server API helpers.",
            allowTypeImports: true,
          })),
          patterns: [
            {
              group: ["next/*", "react/*", "react-dom", "react-dom/*", "@/db/*"],
              message: "Boundary rule: engine/ and lib/{llm,agents,export,sample} must not depend on React, Next or the db.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  // engine/layout.ts is bundled into the 3D HTML export, which loads three itself.
  {
    files: ["engine/layout.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ group: ["three", "three/*"], message: "engine/layout.ts must not import three (it is bundled into the 3D HTML export)." }] },
      ],
    },
  },
]);

export default eslintConfig;
