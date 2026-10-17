'use client';

import { useCallback, useRef } from 'react';
import { Atlas } from '@/components/atlas/Atlas';
import { AppController } from '@/components/AppController';
import { MobileShell } from '@/components/MobileShell';
import { AgentLog } from '@/components/panels/AgentLog';
import { FocusExit } from '@/components/panels/FocusExit';
import { Hint } from '@/components/panels/Hint';
import { InputBar } from '@/components/panels/InputBar';
import { LeftPanel } from '@/components/panels/LeftPanel';
import { NodeCard } from '@/components/panels/NodeCard';
import { Toolbar } from '@/components/panels/Toolbar';
import type { AtlasScene } from '@/engine/AtlasScene';
import { useStore } from '@/lib/store';
import { useIsMobile, useMounted } from '@/lib/useIsMobile';

/**
 * The single screen. Z-order: canvas 0 (its label layers stack inside it), frame 1, panels 2 (node card 3, toolbar 4 so its menus open over the card), open menus 6.
 * Below 768 px the panels give way to MobileShell (z 5: bars and bottom sheets); the canvas is the same.
 * Until the first client render only the canvas and the frame show, so the server HTML never has to guess the layout.
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
  const mounted = useMounted();
  const isMobile = useIsMobile();
  const sceneRef = useRef<AtlasScene | null>(null);
  const onReady = useCallback((scene: AtlasScene) => { sceneRef.current = scene; }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg font-mono leading-[normal] text-ink">
      <Atlas className="absolute inset-0 z-0" brain={brain} mode={mode} theme={theme} selected={selected} showPath={showPath} onPick={select} onReady={onReady} />
      <div className={`pointer-events-none fixed z-[1] border border-rule ${isMobile ? 'inset-[5px]' : 'inset-[14px]'}`} />
      <div className={`pointer-events-none fixed z-[1] border border-rule2 ${isMobile ? 'inset-[8px]' : 'inset-[19px]'}`} />
      <AppController sceneRef={sceneRef} />
      {mounted && !focus && (isMobile ? <MobileShell /> : (
        <>
          <LeftPanel />
          <Toolbar />
          {selected ? <NodeCard key={selected} id={selected} /> : <AgentLog />}
          <InputBar />
          <Hint />
        </>
      ))}
      {mounted && focus && <FocusExit compact={isMobile} />}
    </div>
  );
}
