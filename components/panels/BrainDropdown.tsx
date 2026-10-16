'use client';

import { FOCUS_INPUT_EVENT } from '@/lib/events';
import { selectBrain } from '@/lib/sync';
import { useStore } from '@/lib/store';
import { Dropdown } from '@/components/ui/Dropdown';

const pad3 = (n: number) => String(n).padStart(3, '0');

/** "Second brain № 001 ▾" with the saved-brain list, plus the « button that hides the left panel. */
export function BrainDropdown() {
  const brains = useStore(s => s.brains);
  const currentId = useStore(s => s.brain?.id ?? null);
  const number = useStore(s => s.brain?.number ?? null);
  const select = useStore(s => s.select);
  const toggleLeft = useStore(s => s.toggleLeft);
  const setOpenDropdown = useStore(s => s.setOpenDropdown);

  const open = (id: string, close: () => void) => {
    close();
    if (id !== currentId) void selectBrain(id);
  };

  const newBrain = (close: () => void) => {
    close();
    select(null);
    window.dispatchEvent(new CustomEvent(FOCUS_INPUT_EVENT));
  };

  const hide = () => {
    if (useStore.getState().ui.openDropdown === 'brain') setOpenDropdown(null);
    toggleLeft();
  };

  return (
    // Positioned row: the menu spans the dropdown and the « button, as in the prototype.
    <div className="relative mb-2 flex gap-1.5">
      <Dropdown
        id="brain"
        align="left"
        className="flex min-w-0 flex-1"
        menuGap={4}
        menuShadow={3}
        menuClassName="right-0 max-h-[300px] overflow-y-auto"
        triggerClassName="flex min-w-0 flex-1 items-center gap-[10px] border border-ink bg-panel px-[10px] py-[9px] text-left font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.14em] text-ink"
        label={isOpen => (
          <>
            <span className="text-muted">Second brain</span>
            <span className="flex-1">№ {number === null ? '—' : pad3(number)}</span>
            <span>{isOpen ? '▴' : '▾'}</span>
          </>
        )}
      >
        {close => (
          <>
            {brains.map(b => (
              <button
                key={b.id}
                type="button"
                aria-current={b.id === currentId}
                onClick={() => open(b.id, close)}
                className={`flex cursor-pointer items-baseline gap-[10px] border-b border-rule2 px-[10px] py-[9px] text-left font-mono text-ink hover:text-accent ${b.id === currentId ? 'bg-bg' : 'bg-transparent'}`}
              >
                <span className="text-[10px] text-muted">{pad3(b.number)}</span>
                <span className="flex-1 font-serif text-[19px] leading-[1.1]">{b.title}</span>
                <span className="text-[10px] text-muted">{b.nodeCount} nodes</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => newBrain(close)}
              className="cursor-pointer p-[10px] text-left font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.14em] text-ink hover:bg-ink hover:text-panel"
            >
              + New second brain
            </button>
          </>
        )}
      </Dropdown>
      <button
        type="button"
        title="Hide panel"
        onClick={hide}
        className="w-9 flex-none cursor-pointer border border-ink bg-panel font-mono text-[12px] text-ink hover:bg-ink hover:text-panel"
      >
        «
      </button>
    </div>
  );
}
