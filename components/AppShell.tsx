'use client';

import { useCallback, useRef } from 'react';
import { Atlas } from '@/components/atlas/Atlas';
import { AppController } from '@/components/AppController';
import { AgentLog } from '@/components/panels/AgentLog';
import { FocusExit } from '@/components/panels/FocusExit';
import { Hint } from '@/components/panels/Hint';
import { InputBar } from '@/components/panels/InputBar';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { NodeCard } from '@/components/panels/NodeCard';
import { Toolbar } from '@/components/panels/Toolbar';
import type { AtlasScene } from '@/engine/AtlasScene';
import { useStore } from '@/lib/store';

/**
 * The single screen. Z-order: canvas 0 (its label layers stack inside it), frame 1, panels 2 (node card 3), open menus 6.
 * Focus mode leaves only the canvas, the frame and the Exit focus button; the controller stays mounted so a run continues.
 */
export function AppShell() {
  const brain = useStore(s => s.brain);
  const mode = useStore(s => s.mode);
  const theme = useStore(s => s.theme);
  const selected = useStore(s => s.selected);
  const select = useStore(s => s.select);
  const focus = useStore(s => s.ui.focus);
  const showPath = useStore(s => s.ui.showPath);
  const sceneRef = useRef<AtlasScene | null>(null);
  const onReady = useCallback((scene: AtlasScene) => { sceneRef.current = scene; }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg font-mono leading-[normal] text-ink">
      <Atlas className="absolute inset-0 z-0" brain={brain} mode={mode} theme={theme} selected={selected} showPath={showPath} onPick={select} onReady={onReady} />
      <div className="pointer-events-none fixed inset-[14px] z-[1] border border-rule" />
      <div className="pointer-events-none fixed inset-[19px] z-[1] border border-rule2" />
      <AppController sceneRef={sceneRef} />
      {!focus && (
        <>
          <LeftPanel />
          <Toolbar />
          {selected ? <NodeCard key={selected} id={selected} /> : <AgentLog />}
          <InputBar />
          <Hint />
        </>
      )}
      {focus && <FocusExit />}
    </div>
  );
}
