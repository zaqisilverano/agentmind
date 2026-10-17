'use client';

import { FOCUS_INPUT_EVENT } from '@/lib/events';
import { deleteBrain, selectBrain } from '@/lib/sync';
import { useStore } from '@/lib/store';
import { Dropdown } from '@/components/ui/Dropdown';
import { TwoStepDelete } from '@/components/ui/TwoStepDelete';

export const pad3 = (n: number) => String(n).padStart(3, '0');

/**
 * The saved-brain list (number, title, node count), "+ New second brain" and a two-step "Delete this brain" for the
 * open brain. `close` dismisses the surrounding menu or sheet before the action runs.
 */
export function BrainMenu({ close }: { close: () => void }) {
  const brains = useStore(s => s.brains);
  const currentId = useStore(s => s.brain?.id ?? null);
  const select = useStore(s => s.select);

  const open = (id: string) => {
    close();
    if (id !== currentId) void selectBrain(id);
  };

  const newBrain = () => {
    close();
    select(null);
    window.dispatchEvent(new CustomEvent(FOCUS_INPUT_EVENT));
  };

  const remove = (id: string) => {
    close();
    void deleteBrain(id);
  };

  return (
    <>
      {brains.map(b => (
        <button
          key={b.id}
          type="button"
          aria-current={b.id === currentId}
          onClick={() => open(b.id)}
          className={`flex cursor-pointer items-baseline gap-[10px] border-b border-rule2 px-[10px] py-[9px] text-left font-mono text-ink hover:text-accent ${b.id === currentId ? 'bg-bg' : 'bg-transparent'}`}
        >
          <span className="text-[10px] text-muted">{pad3(b.number)}</span>
          <span className="flex-1 font-serif text-[19px] leading-[1.1]">{b.title}</span>
          <span className="text-[10px] text-muted">{b.nodeCount} nodes</span>
        </button>
      ))}
      <button
        type="button"
        onClick={newBrain}
        className="cursor-pointer p-[10px] text-left font-mono text-[10.5px] uppercase leading-[normal] tracking-[0.14em] text-ink hover:bg-ink hover:text-panel"
      >
        + New second brain
      </button>
      {currentId !== null && (
        <TwoStepDelete
          key={currentId}
          label="Delete this brain"
          confirmLabel="Confirm delete?"
          title="Delete this brain and everything in it"
          onConfirm={() => remove(currentId)}
          className="border-t border-rule2 text-left"
        />
      )}
    </>
  );
}

/**
 * "Second brain № 001 ▾" ("Second brain — ▾" with no brain open) with the saved-brain list, "+ New second brain" and a two-step "Delete this brain" for the open
 * brain, plus the « button that hides the left panel.
 */
export function BrainDropdown() {
  const number = useStore(s => s.brain?.number ?? null);
  const toggleLeft = useStore(s => s.toggleLeft);
  const setOpenDropdown = useStore(s => s.setOpenDropdown);

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
            <span className="flex-1">{number === null ? '—' : `№ ${pad3(number)}`}</span>
            <span>{isOpen ? '▴' : '▾'}</span>
          </>
        )}
      >
        {close => <BrainMenu close={close} />}
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
