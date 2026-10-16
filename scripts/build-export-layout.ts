import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundleLayout } from './layoutBundle';

const out = fileURLToPath(new URL('../public/export/layout.js', import.meta.url));
mkdirSync(fileURLToPath(new URL('../public/export/', import.meta.url)), { recursive: true });
bundleLayout().then(js => {
  writeFileSync(out, js);
  console.log(`wrote public/export/layout.js (${js.length} bytes)`);
});
