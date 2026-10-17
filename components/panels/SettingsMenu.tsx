'use client';

import type { ReactNode } from 'react';
import { download, slugify } from '@/lib/download';
import { toJson } from '@/lib/export/json';
import { downloadHtml3d } from '@/lib/export/html3dClient';
import { toMarkdown } from '@/lib/export/markdown';
import { providerText } from '@/lib/grow';
import { useStore, type Rounds } from '@/lib/store';

export const ROUNDS: Rounds[] = [5, 10, 20];
const DL = 'flex-1 cursor-pointer border border-ink bg-panel px-2 py-[9px] font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.12em] text-ink hover:bg-ink hover:text-panel disabled:cursor-default disabled:opacity-40 disabled:pointer-events-none';

const Heading = ({ children }: { children: ReactNode }) => (
  <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{children}</div>
);

/** Download handlers for the open brain (Markdown, JSON, standalone 3D HTML); each does nothing without a brain. */
export function useDownloads() {
  const hasBrain = useStore(s => s.brain !== null);

  const save = (ext: string, mime: string, render: typeof toMarkdown) => {
    const brain = useStore.getState().brain;
    if (brain) download(`${slugify(brain.title)}.${ext}`, render(brain), mime);
  };

  const saveHtml3d = () => {
    const { brain, theme, mode, setStatus } = useStore.getState();
    if (brain) downloadHtml3d(brain, theme, mode).catch(() => setStatus('Could not build the 3D HTML export. Try again.'));
  };

  return {
    hasBrain,
    saveMarkdown: () => save('md', 'text/markdown', toMarkdown),
    saveJson: () => save('json', 'application/json', toJson),
    saveHtml3d,
  };
}

/** Settings dropdown body: rounds per run, brain downloads, and which LLM answered last. */
export function SettingsMenu() {
  const rounds = useStore(s => s.settings.rounds);
  const setRounds = useStore(s => s.setRounds);
  const provider = useStore(s => s.provider);
  const { hasBrain, saveMarkdown, saveJson, saveHtml3d } = useDownloads();

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-rule2 p-[14px]">
        <Heading>Rounds per run</Heading>
        <div className="flex border border-ink">
          {ROUNDS.map(n => (
            <button
              key={n}
              type="button"
              aria-pressed={rounds === n}
              onClick={() => setRounds(n)}
              className={`flex-1 cursor-pointer border-r border-ink py-2 font-mono text-[11px] leading-[normal] ${rounds === n ? 'bg-ink text-panel' : 'bg-panel text-ink'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-b border-rule2 p-[14px]">
        <Heading>Download brain</Heading>
        <div className="flex gap-1.5">
          <button type="button" className={DL} disabled={!hasBrain} onClick={saveMarkdown}>Markdown</button>
          <button type="button" className={DL} disabled={!hasBrain} onClick={saveJson}>JSON</button>
          <button type="button" className={DL} disabled={!hasBrain} onClick={saveHtml3d}>3D HTML</button>
        </div>
      </div>
      <div className="flex items-baseline gap-3 px-[14px] py-3">
        <Heading>Provider</Heading>
        <div className="min-w-0 flex-1 truncate text-right text-[11px]" title={providerText(provider)}>{providerText(provider)}</div>
      </div>
    </>
  );
}
