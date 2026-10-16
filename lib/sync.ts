import type { Brain, CrossLink, IdeaNode, LogEntry, Takeaway } from '@/engine/types';
import { ApiError, apiClient, type ApiClient, type BrainListRow, type MeResponse, type PatchNodeRequest } from '@/lib/apiClient';
import { initialState, useStore } from '@/lib/store';

/**
 * Every mutation applies to the store first, then calls the API. A network error (TypeError) is retried once.
 * On final failure `syncError` holds the label and a `retry` that re-sends the same call. There is no rollback.
 * Mutations never reject: failure is reported through `syncError`. `applyRound` and `setTakeaway` also resolve false
 * when the save failed, so the agent runner can stop without reading (possibly older) `syncError` state.
 */

let api: ApiClient = apiClient;

export function configureSync(opts: { api?: ApiClient } = {}): void {
  api = opts.api ?? apiClient;
}

const store = () => useStore.getState();
const currentId = (): string | null => store().brain?.id ?? null;

async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    if (e instanceof TypeError) return call();
    throw e;
  }
}

/** Runs `call` (retrying once on network error), then `onOk(result)`. On failure sets `syncError`. Resolves true on success. */
async function send<T>(label: string, call: () => Promise<T>, onOk?: (result: T) => void | Promise<void>): Promise<boolean> {
  const run = async (isRetry: boolean): Promise<boolean> => {
    try {
      const result = await withRetry(call);
      if (isRetry) store().setSyncError(null);
      await onOk?.(result);
      return true;
    } catch (e) {
      const retry = async (): Promise<void> => void (await run(true));
      store().setSyncError(e instanceof ApiError ? { label, message: e.message, retry } : { label, retry });
      return false;
    }
  };
  return run(false);
}

/** Replaces the open brain with the server's copy, unless the user has moved to another brain meanwhile. */
const adopt = (id: string) => (server: Brain): void => {
  if (currentId() === id) store().patchBrain(() => server);
};

const nextSeq = (b: Brain): number => b.log.reduce((m, e) => Math.max(m, e.seq), 0) + 1;

function toRow(b: Brain): BrainListRow {
  return { id: b.id, number: b.number, title: b.title, nodeCount: b.nodes.length, updatedAt: b.updatedAt };
}

let selectToken = 0;

/** Not optimistic: the brain is fetched first. Pauses any run straight away. */
export async function selectBrain(id: string): Promise<void> {
  const token = ++selectToken;
  store().setRun({ active: false, paused: true });
  await send('Open brain', () => api.getBrain(id), (brain) => {
    if (token === selectToken) store().openBrain(brain);
  });
}

/**
 * Drops everything that belongs to the current identity: invalidates any in-flight `selectBrain`/`createBrain`,
 * stops the run, closes the brain and clears the list and any pending sync error. The user row is left alone.
 */
export function resetSession(): void {
  ++selectToken;
  useStore.setState({ run: { ...initialState.run, paused: true }, brain: null, selected: null, syncError: null, brains: [] });
}

/** After the cookie changed hands (Restore ID): reset, adopt the new user and list, then open their first brain. */
export async function switchUser(me: MeResponse): Promise<void> {
  resetSession();
  store().hydrate(me);
  const first = me.brains[0];
  if (first) await selectBrain(first.id);
}

export async function createBrain(title: string, summary: string, nodes: IdeaNode[], links: CrossLink[] = []): Promise<Brain | null> {
  const token = ++selectToken;
  store().setRun({ active: false, paused: true });
  let created: Brain | null = null;
  await send('Create brain', () => api.createBrain({ title, summary, nodes, links }), (brain) => {
    created = brain;
    useStore.setState((s) => ({ brains: [toRow(brain), ...s.brains.filter((r) => r.id !== brain.id)] }));
    if (token === selectToken) store().openBrain(brain);
  });
  return created;
}

/**
 * Drops the list row at once. When it is the open brain, also closes it at once (pauses the run, clears brain and
 * selection, invalidates in-flight opens) before the DELETE goes out, then opens the next most recent brain, unless
 * the user opened or created another one meanwhile.
 */
export async function deleteBrain(id: string): Promise<void> {
  const wasCurrent = currentId() === id;
  useStore.setState((s) => ({ brains: s.brains.filter((r) => r.id !== id) }));
  let token = selectToken;
  if (wasCurrent) {
    token = ++selectToken;
    store().setRun({ active: false, paused: true });
    useStore.setState({ brain: null, selected: null });
  }
  await send('Delete brain', () => api.deleteBrain(id), async () => {
    if (!wasCurrent || token !== selectToken) return;
    const next = store().brains[0];
    if (next) await selectBrain(next.id);
  });
}

export async function renameBrain(title: string): Promise<void> {
  const id = currentId();
  if (!id) return;
  store().patchBrain((b) => ({ ...b, title }));
  await send('Rename brain', () => api.patchBrain(id, { title }));
}

export async function editNode(nodeId: string, patch: { name?: string; note?: string }): Promise<void> {
  const id = currentId();
  if (!id) return;
  const fields: { name?: string; note?: string } = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.note !== undefined) fields.note = patch.note;
  if (Object.keys(fields).length === 0) return;
  const body: PatchNodeRequest = { id: nodeId, ...fields };
  store().patchBrain((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === nodeId ? { ...n, ...fields } : n)) }));
  await send('Edit node', () => api.patchNode(id, body));
}

export async function saveUserNote(nodeId: string, userNote: string): Promise<void> {
  const brain = store().brain;
  const node = brain?.nodes.find((n) => n.id === nodeId);
  if (!brain || !node || node.userNote === userNote) return;
  store().patchBrain((b) => ({ ...b, nodes: b.nodes.map((n) => (n.id === nodeId ? { ...n, userNote } : n)) }));
  await send('Save note', () => api.patchNode(brain.id, { id: nodeId, userNote }));
}

/** Removes a node, everything below it and every link touching them. The core cannot be deleted. */
export async function deleteSubtree(nodeId: string): Promise<void> {
  const brain = store().brain;
  if (!brain || nodeId === 'n0' || !brain.nodes.some((n) => n.id === nodeId)) return;
  const doomed = new Set([nodeId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of brain.nodes) {
      if (n.parent !== null && doomed.has(n.parent) && !doomed.has(n.id)) {
        doomed.add(n.id);
        grew = true;
      }
    }
  }
  store().patchBrain((b) => ({
    ...b,
    nodes: b.nodes.filter((n) => !doomed.has(n.id)),
    links: b.links.filter((l) => !doomed.has(l.a) && !doomed.has(l.b)),
  }));
  const sel = store().selected;
  if (sel !== null && doomed.has(sel)) useStore.setState({ selected: null });
  await send('Delete node', () => api.deleteNode(brain.id, nodeId));
}

/** Resolves false when the save failed (nothing to add counts as success). */
export async function addChildren(nodes: IdeaNode[]): Promise<boolean> {
  const brain = store().brain;
  if (!brain) return false;
  const have = new Set(brain.nodes.map((n) => n.id));
  const fresh = nodes.filter((n) => !have.has(n.id) && have.add(n.id));
  if (fresh.length === 0) return true;
  store().patchBrain((b) => ({ ...b, nodes: [...b.nodes, ...fresh] }));
  return send('Add ideas', () => api.addNodes(brain.id, fresh));
}

const linkKey = (l: { a: string; b: string }): string => `${l.a}~${l.b}`;

export async function addLinks(links: CrossLink[]): Promise<void> {
  const brain = store().brain;
  if (!brain) return;
  const have = new Set(brain.links.map(linkKey));
  const fresh = links.filter((l) => !have.has(linkKey(l)) && have.add(linkKey(l)));
  if (fresh.length === 0) return;
  store().patchBrain((b) => ({ ...b, links: [...b.links, ...fresh] }));
  await send('Add links', () => api.addLinks(brain.id, fresh));
}

export interface RoundInput { round: number; nodes: IdeaNode[]; links: CrossLink[]; log: Omit<LogEntry, 'seq'> }

/**
 * Applies one agent round locally, persists it in one request, then adopts the server's brain (authoritative log seqs).
 * Resolves true when the round was saved.
 */
export async function applyRound(input: RoundInput): Promise<boolean> {
  const brain = store().brain;
  if (!brain) return false;
  const log: LogEntry = { ...input.log, seq: nextSeq(brain) };
  const have = new Set(brain.nodes.map((n) => n.id));
  const nodes = input.nodes.filter((n) => !have.has(n.id));
  const linkSeen = new Set(brain.links.map(linkKey));
  const links = input.links.filter((l) => !linkSeen.has(linkKey(l)) && linkSeen.add(linkKey(l)));
  store().patchBrain((b) => ({ ...b, round: input.round, nodes: [...b.nodes, ...nodes], links: [...b.links, ...links], log: [...b.log, log] }));
  return send('Save round', () => api.applyRound(brain.id, { round: input.round, nodes, links, log }), adopt(brain.id));
}

/** Resolves true when the takeaway was saved. */
export async function setTakeaway(synth: Takeaway, log: Omit<LogEntry, 'seq'>): Promise<boolean> {
  const brain = store().brain;
  if (!brain) return false;
  const entry: LogEntry = { ...log, seq: nextSeq(brain) };
  store().patchBrain((b) => ({ ...b, synth, log: [...b.log, entry] }));
  return send('Save takeaway', () => api.setTakeaway(brain.id, { synth, log: entry }), adopt(brain.id));
}
