'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Atlas } from '@/components/atlas/Atlas';
import type { AtlasScene } from '@/engine/AtlasScene';
import { THEMES } from '@/engine/themes';
import type { AgentId, Brain, CrossLink, IdeaNode, Mode, ThemeId } from '@/engine/types';
import { makeKids } from '@/lib/agents/makeKids';
import { AGENTS } from '@/lib/agents/roster';
import { sampleBrain } from '@/lib/sample/toolLibrary';

const MODES: Mode[] = ['constellation', 'orbit', 'terrain'];
const THEME_IDS = Object.keys(THEMES) as ThemeId[];
const PATH = ['n0', 'b2', 'b2c1'];
const THINK_MS = 1200;
const FONTS = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap';

function devBrain(theme: ThemeId): Brain {
  const { title, summary, nodes } = sampleBrain(THEMES[theme].ink);
  const now = new Date().toISOString();
  return { id: 'dev', number: 1, title, summary, round: 0, synth: null, nodes, links: [], log: [], createdAt: now, updatedAt: now };
}

interface Script { agent: AgentId; via: string; target: string; link: string; kids: { name: string; note: string }[] }

const SCRIPTS: Script[] = [
  { agent: 'researcher', via: 'b2', target: 'b2c2', link: 'b4c0', kids: [{ name: 'Locker sizes', note: '' }, { name: 'After-hours pickup', note: '' }] },
  { agent: 'skeptic', via: 'b0', target: 'b0c1', link: 'b4c2', kids: [{ name: 'Rental shops are cheap', note: '' }, { name: 'Jobs are urgent', note: '' }] },
];

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

declare global { interface Window { __atlas?: AtlasScene } }

export function EngineDev() {
  const [theme, setTheme] = useState<ThemeId>('atlas');
  const [mode, setMode] = useState<Mode>('constellation');
  const [brain, setBrain] = useState<Brain>(() => devBrain('atlas'));
  const [selected, setSelected] = useState<string | null>(null);
  const [showPath, setShowPath] = useState(false);
  const [running, setRunning] = useState(false);
  const sceneRef = useRef<AtlasScene | null>(null);
  const brainRef = useRef(brain);
  // Resolved after the commit that pushed a new brain: child effects (Atlas.setBrain) run before this page's effects.
  const committed = useRef<(() => void) | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    brainRef.current = brain;
    committed.current?.();
    committed.current = null;
  }, [brain]);
  useEffect(() => () => { delete window.__atlas; }, []);

  const push = (next: Brain) => new Promise<void>(resolve => {
    committed.current = resolve;
    setBrain(next);
  });

  const onReady = useCallback((scene: AtlasScene) => {
    sceneRef.current = scene;
    window.__atlas = scene;
  }, []);

  const togglePath = () => {
    if (!brain.synth) setBrain({ ...brain, synth: { path: PATH, verdict: 'Pursue Deposit system.', brief: 'Dev path.' } });
    setShowPath(on => !on);
  };

  const run = async () => {
    const scene = sceneRef.current;
    if (!scene || running) return;
    setRunning(true);
    try {
      for (const s of SCRIPTS) {
        const agent = AGENTS.find(a => a.id === s.agent)!;
        await scene.agent({ type: 'plan', agent: s.agent, target: s.target });
        await scene.agent({ type: 'travel', agent: s.agent, path: ['n0', s.via, s.target] });
        await scene.agent({ type: 'think', agent: s.agent, target: s.target, verb: 'sprouting ideas on' });
        await wait(THINK_MS);
        await scene.agent({ type: 'spawn', agent: s.agent, target: s.target });
        const b = brainRef.current;
        const target = b.nodes.find(n => n.id === s.target) as IdeaNode;
        await push({ ...b, nodes: [...b.nodes, ...makeKids(target, s.kids, agent, THEMES[theme].ink)] });
        const link: CrossLink = { a: s.target, b: s.link, why: 'demo', by: s.agent };
        await scene.agent({ type: 'prepareLink', agent: s.agent, a: link.a, b: link.b });
        await push({ ...brainRef.current, links: [...brainRef.current.links, link] });
        await scene.agent({ type: 'link', agent: s.agent, a: link.a, b: link.b });
        await scene.agent({ type: 'done', agent: s.agent });
      }
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    const fresh = devBrain(theme);
    brainRef.current = fresh;
    setBrain(fresh);
    setShowPath(false);
    setSelected(null);
  };

  const t = THEMES[theme];
  const button = (active: boolean): CSSProperties => ({
    font: '11px var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '5px 9px', cursor: 'pointer',
    border: `1px solid ${t.ink}`, background: active ? t.ink : t.panel, color: active ? t.panel : t.ink,
  });
  const fonts = { '--font-serif': '"Instrument Serif", serif', '--font-mono': '"JetBrains Mono", monospace' } as CSSProperties;

  return (
    <div style={{ ...fonts, position: 'fixed', inset: 0, background: t.bg, color: t.ink }}>
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <Atlas brain={brain} mode={mode} theme={theme} selected={selected} showPath={showPath} onPick={setSelected} onReady={onReady} className="absolute inset-0" />
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {MODES.map(m => <button key={m} style={button(mode === m)} onClick={() => setMode(m)}>{m}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {THEME_IDS.map(id => <button key={id} style={button(theme === id)} onClick={() => setTheme(id)}>{id}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={button(showPath)} onClick={togglePath}>Toggle path</button>
          <button style={button(false)} onClick={() => sceneRef.current?.setBrain(brainRef.current, { fresh: true })}>Fresh rebuild</button>
          <button style={button(running)} onClick={run} disabled={running}>Run scripted agents</button>
          <button style={button(false)} onClick={reset} disabled={running}>Reset brain</button>
        </div>
        <div data-testid="status" style={{ font: '11px var(--font-mono)' }}>
          selected: {selected ?? 'none'} · nodes: {brain.nodes.length} · links: {brain.links.length}{running ? ' · running' : ''}
        </div>
      </div>
    </div>
  );
}
