import type { Brain, Mode, ThemeId } from '@/engine/types';
import { download, slugify } from '@/lib/download';
import { toHtml3d } from '@/lib/export/html3d';

/** Fetches the committed layout bundle, builds the viewer page and saves it as `<slug>-3d.html`. Browser only. */
export async function downloadHtml3d(brain: Brain, theme: ThemeId, mode: Mode): Promise<void> {
  const res = await fetch('/export/layout.js');
  if (!res.ok) throw new Error(`layout.js ${res.status}`);
  download(`${slugify(brain.title)}-3d.html`, toHtml3d(brain, theme, mode, await res.text()), 'text/html');
}
