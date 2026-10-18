import { THEMES } from '@/engine/themes';
import type { IdeaNode } from '@/engine/types';
import type { LlmMeta } from '@/lib/apiClient';
import { controllerApi, getController } from '@/lib/controller';
import { fromBranches } from '@/lib/ids';
import { useStore, type Provider } from '@/lib/store';
import { createBrain } from '@/lib/sync';

const store = () => useStore.getState();

/** "offline fallback" or the model name, for status lines and the Settings menu. */
export const providerText = (p: Provider | LlmMeta | null): string => (!p ? '—' : p.source === 'fallback' ? 'offline fallback' : p.model ?? '—');

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

/** New brain from a typed idea: map it with the LLM, then create and open it. Resolves true when the brain was created. */
export async function mapIdea(text: string): Promise<boolean> {
  const idea = text.trim();
  if (store().ui.busy) return false;
  if (idea.length < 3) {
    store().setStatus('Type a few words first');
    return false;
  }
  getController()?.pause();
  store().select(null);
  store().setBusy('map');
  store().setStatus('Mapping your idea…');
  try {
    const { data, meta } = await controllerApi().llm.map({ idea: idea.slice(0, 2000) });
    store().setProvider(meta);
    const { title, summary, nodes } = fromBranches(data, THEMES[store().theme].ink);
    const brain = await createBrain(title, summary, nodes);
    store().setStatus(brain ? `${nodes.length} nodes · ${providerText(meta)}` : 'The new brain was not saved');
    return brain !== null;
  } catch (e) {
    store().setStatus(`Could not map the idea: ${errorText(e)}`);
    return false;
  } finally {
    store().setBusy(null);
  }
}
