import { THEMES } from '@/engine/themes';
import { BRAIN_FULL_MESSAGE, MAX_NODES_PER_BRAIN } from '@/lib/brains/limits';
import { KINDS, KIND_COLORS, type IdeaNode } from '@/engine/types';
import type { LlmMeta } from '@/lib/apiClient';
import { controllerApi, getController } from '@/lib/controller';
import { childId, fromBranches } from '@/lib/ids';
import { useStore, type Provider } from '@/lib/store';
import { addChildren, createBrain } from '@/lib/sync';

const store = () => useStore.getState();

/** "offline fallback" or the model name, for status lines and the Settings menu. */
export const providerText = (p: Provider | LlmMeta | null): string => (!p ? '—' : p.source === 'fallback' ? 'offline fallback' : p.model ?? '—');

/**
 * A run (or its wind-down after Pause, while a phase is still set) owns the map: a user expand computed from another
 * snapshot would race the agent's children on the same node.
 */
export const runBusy = (): boolean => {
  const { run } = store();
  return run.active || run.phase !== null || (getController()?.running ?? false);
};

const errorText = (e: unknown): string => (e instanceof TypeError ? 'network error' : e instanceof Error ? e.message : String(e));

/**
 * Children for a user-initiated expand (no agent): kind and colour inherited from the target, except that children of
 * the core cycle through the six kinds. `position` continues after the target's existing children.
 */
export function expandKids(target: IdeaNode, kids: { name: string; note?: string }[], existing: number, stamp: string = Date.now().toString(36)): IdeaNode[] {
  return kids
    .filter((c) => c && c.name)
    .slice(0, 5)
    .map((c, k) => {
      const kind = target.depth === 0 ? KINDS[k % KINDS.length] : target.kind;
      return {
        id: childId(target.id, k, stamp),
        name: c.name,
        note: c.note ?? '',
        userNote: '',
        kind,
        parent: target.id,
        depth: target.depth + 1,
        color: target.depth === 0 ? KIND_COLORS[kind as (typeof KINDS)[number]] : target.color,
        by: null,
        critic: false,
        position: existing + k,
      };
    });
}

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

/** Grows one node with 3–5 children from the LLM; `question` is the "Ask node" text. Resolves true when children were added. */
export async function expandNode(id: string, question?: string): Promise<boolean> {
  const brain = store().brain;
  const node = brain?.nodes.find((n) => n.id === id);
  if (!brain || !node || store().ui.busy || runBusy()) return false;
  if (brain.nodes.length >= MAX_NODES_PER_BRAIN) {
    store().setStatus(BRAIN_FULL_MESSAGE);
    return false;
  }
  const q = question?.trim().slice(0, 300) || undefined;
  store().setBusy('expand');
  store().setStatus(q ? `Asking: ${q}…` : `Expanding ${node.name}…`);
  try {
    const { data, meta } = await controllerApi().llm.expand({
      title: brain.title.slice(0, 80),
      summary: brain.summary.slice(0, 400),
      path: pathNames(brain.nodes, id).slice(-20),
      existing: brain.nodes.filter((n) => n.parent === id).map((n) => n.name).slice(0, 60),
      ...(q ? { question: q } : {}),
    });
    store().setProvider(meta);
    const now = store().brain;
    const target = now?.id === brain.id ? now.nodes.find((n) => n.id === id) : undefined;
    if (!now || !target) {
      store().setStatus('');
      return false;
    }
    const room = Math.max(0, MAX_NODES_PER_BRAIN - now.nodes.length);
    if (room === 0) {
      store().setStatus(BRAIN_FULL_MESSAGE);
      return false;
    }
    const kids = expandKids(target, data.children, now.nodes.filter((n) => n.parent === id).length).slice(0, room);
    if (!(await addChildren(kids))) {
      store().setStatus(store().syncError?.message ?? `The ideas for ${target.name} were not saved`);
      return false;
    }
    store().setStatus(`+${kids.length} on ${target.name} · ${providerText(meta)}`);
    return kids.length > 0;
  } catch (e) {
    store().setStatus(`Could not expand ${node.name}: ${errorText(e)}`);
    return false;
  } finally {
    store().setBusy(null);
  }
}
