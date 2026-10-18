import { getController } from '@/lib/controller';
import { mapIdea, runBusy } from '@/lib/grow';
import { useStore } from '@/lib/store';

const store = () => useStore.getState();

/** What ▶ Run agents (or Enter in the input) would do now; drives the button's enabled state and the placeholder. */
export type RunAction = 'map' | 'run' | 'scope' | null;

/** The action for this input text: a selected node scopes the run, typed text maps a new brain, else the open brain runs. */
export function runAction(text: string, s = store()): RunAction {
  if (s.selected !== null && s.brain?.nodes.some((n) => n.id === s.selected)) return 'scope';
  if (text.trim()) return 'map';
  return s.brain ? 'run' : null;
}

/**
 * ▶ Run agents and Enter in the input. With a node selected: a scoped run on it, the text as its optional focus note.
 * With text and no selection: maps the idea into a new brain, then runs the agents on it if it is still the open brain
 * (a switch, delete or open while mapping leaves the new brain unopened and unrun). With neither: a full run on
 * the open brain. Resolves true when the input should be cleared (the run started, or the idea was mapped); false
 * keeps the text, e.g. after a failed map (whose error is in the status line). No-op while mapping or while a run is
 * still going or winding down.
 */
export async function startFromInput(text: string): Promise<boolean> {
  const c = getController();
  if (!c || store().ui.busy !== null || runBusy()) return false;
  const action = runAction(text);
  const s = store();
  if (action === 'scope' && s.selected !== null) {
    const focus = text.trim().slice(0, 300);
    c.startRun(focus ? { scope: s.selected, focus } : { scope: s.selected });
    return true;
  }
  if (action === 'map') {
    const mapped = await mapIdea(text);
    if (!mapped) return false;
    // Run only the brain just mapped, and only if it is the one open (the user may have switched while it mapped).
    // Either way the brain exists now, so the input clears.
    if (mapped.opened && store().brain?.id === mapped.id) getController()?.startRun({ brainId: mapped.id });
    return true;
  }
  if (action === 'run') {
    c.startRun();
    return true;
  }
  return false;
}

/** "Expand with agents" on a node card: a scoped run on that node, no focus note. */
export function expandWithAgents(id: string): void {
  if (store().ui.busy !== null || runBusy()) return;
  getController()?.startRun({ scope: id });
}
