import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/**
 * Bundles engine/layout.ts into one IIFE that sets `AtlasLayout`, for the 3D HTML export.
 * Deterministic: no banner, no timestamps, so the committed file can be compared byte for byte.
 */
export async function bundleLayout(): Promise<string> {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../engine/layout.ts', import.meta.url))],
    bundle: true,
    format: 'iife',
    globalName: 'AtlasLayout',
    minify: true,
    target: 'es2020',
    write: false,
    legalComments: 'none',
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}
