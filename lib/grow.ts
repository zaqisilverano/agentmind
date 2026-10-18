import { THEMES } from '@/engine/themes';
import type { IdeaNode } from '@/engine/types';
import { track } from '@/lib/analytics';
import type { LlmMeta } from '@/lib/apiClient';
import { controllerApi, getController } from '@/lib/controller';
import { fromBranches } from '@/lib/ids';
import { providerLabel } from '@/lib/llm/providerLabel';
import { useStore } from '@/lib/store';
import { createBrain, openEpoch } from '@/lib/sync';

const store = () => useStore.getState();

/** Who answered an LLM call, for the status line: "offline fallback", or the model's display label ("K2 Horizon 375B"). */
export const providerText = (meta: LlmMeta): string =>
  meta.source === 'fallback' ? 'offline fallback' : meta.model ? providerLabel(meta.model, true) : store().provider?.label ?? 'model';

/** A run is going, or still winding down after Pause (a phase is still set): no new run or map may start yet. */
export const runBusy = (): boolean => {
  const { run } = store();
  return run.active || run.phase !== null || (getController()?.running ?? false);
};

const errorText = (e: unknown): string => (e instanceof TypeError ? 'network error' : e instanceof Error ? e.message : String(e));

/** Names from the core down to `id`. */
export function pathNames(nodes: IdeaNode[], id: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  for (let n = byId.get(id); n; n = n.parent ? byId.get(n.parent) : undefined) out.unshift(n.name);
  return out;
}

/** A brain made by `mapIdea`. `opened` is false when the user opened, deleted or switched brains while it was mapping. */
export interface Mapped { id: string; title: string; opened: boolean }

/**
 * New brain from a typed idea: map it with the LLM, then create and open it. Resolves the created brain, or null when
 * nothing was created. A brain created after the user moved elsewhere is saved and listed but not opened.
 */
export async function mapIdea(text: string): Promise<Mapped | null> {
  const idea = text.trim();
  if (store().ui.busy) return null;
  if (idea.length < 3) {
    store().setStatus('Type a few words first');
    return null;
  }
  getController()?.pause();
  store().select(null);
  // A brain opened, deleted or reset while the LLM maps means the user moved on: save the new brain but do not open it.
  const since = openEpoch();
  store().setBusy('map');
  store().setStatus('Mapping your idea…');
  try {
    const { data, meta } = await controllerApi().llm.map({ idea: idea.slice(0, 2000) });
    store().setLastSource(meta.source);
    const { title, summary, nodes } = fromBranches(data, THEMES[store().theme].ink);
    const brain = await createBrain(title, summary, nodes, [], { since });
    if (!brain) {
      store().setStatus('The new brain was not saved');
      return null;
    }
    track('map', { source: meta.source, nodes: nodes.length });
    const opened = store().brain?.id === brain.id;
    store().setStatus(opened ? `${nodes.length} nodes · ${providerText(meta)}` : `Mapped “${brain.title}”. Open it and press Run agents.`);
    return { id: brain.id, title: brain.title, opened };
  } catch (e) {
    store().setStatus(`Could not map the idea: ${errorText(e)}`);
    return null;
  } finally {
    store().setBusy(null);
  }
}
