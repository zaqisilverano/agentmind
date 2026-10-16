import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeCss } from '../engine/themes';

writeFileSync(fileURLToPath(new URL('../app/theme.generated.css', import.meta.url)), themeCss());
