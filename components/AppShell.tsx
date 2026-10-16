'use client';

import { Atlas } from '@/components/atlas/Atlas';
import { FocusExit } from '@/components/panels/FocusExit';
import { Hint } from '@/components/panels/Hint';
import { Toolbar } from '@/components/panels/Toolbar';
import { useStore } from '@/lib/store';

/**
 * The single screen. Z-order: canvas 0 (its label layers stack inside it), frame 1, panels 2, open menus 6.
 * Focus mode leaves only the canvas, the frame and the Exit focus button.
 */
export function AppShell() {
  const brain = useStore(s => s.brain);
  const mode = useStore(s => s.mode);
  const theme = useStore(s => s.theme);
  const selected = useStore(s => s.selected);
  const select = useStore(s => s.select);
  const focus = useStore(s => s.ui.focus);

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg font-mono leading-[normal] text-ink">
      <Atlas className="absolute inset-0 z-0" brain={brain} mode={mode} theme={theme} selected={selected} showPath onPick={select} />
      <div className="pointer-events-none fixed inset-[14px] z-[1] border border-rule" />
      <div className="pointer-events-none fixed inset-[19px] z-[1] border border-rule2" />
      {!focus && (
        <>
          {/* Task 17: <LeftPanel /> */}
          <Toolbar />
          {/* Task 18: <NodeCard /> or <AgentLog />, <InputBar />, <AppController /> */}
          <Hint />
        </>
      )}
      {focus && <FocusExit />}
    </div>
  );
}
