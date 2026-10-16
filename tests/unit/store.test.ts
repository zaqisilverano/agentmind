import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Brain } from '@/engine/types';
import type { ApiClient } from '@/lib/apiClient';
import { initialState, useStore } from '@/lib/store';
import * as sync from '@/lib/sync';
import { fixtureBrain } from '../fixtures/brain';

type Fake = { [K in keyof ApiClient]: K extends 'llm' ? ApiClient['llm'] : ReturnType<typeof vi.fn> };

function fakeApi(returns: Brain): Fake {
  const ok = () => vi.fn().mockResolvedValue(returns);
  return {
    me: vi.fn(), restore: vi.fn(), health: vi.fn(), listBrains: vi.fn(),
    createBrain: ok(), getBrain: ok(), patchBrain: ok(), deleteBrain: vi.fn().mockResolvedValue({ ok: true }),
    addNodes: ok(), patchNode: ok(), deleteNode: ok(), addLinks: ok(), applyRound: ok(), setTakeaway: ok(),
    llm: { map: vi.fn(), expand: vi.fn(), agentRound: vi.fn(), takeaway: vi.fn() },
  } as unknown as Fake;
}

let api: Fake;
let brain: Brain;

beforeEach(() => {
  brain = fixtureBrain();
  api = fakeApi(brain);
  sync.configureSync({ api: api as unknown as ApiClient });
  useStore.setState({
    ...initialState,
    brain,
    brains: [{ id: brain.id, number: 1, title: brain.title, nodeCount: brain.nodes.length, updatedAt: brain.updatedAt }],
  });
});

describe('select', () => {
  it('selects an existing node', () => {
    useStore.getState().select('b0');
    expect(useStore.getState().selected).toBe('b0');
  });
  it('yields null for an id that is not in the brain', () => {
    useStore.getState().select('b0');
    useStore.getState().select('nope');
    expect(useStore.getState().selected).toBeNull();
  });
});

describe('editNode', () => {
  it('updates the store synchronously, then calls the API once', async () => {
    const p = sync.editNode('b0', { name: 'Renamed' });
    expect(useStore.getState().brain!.nodes.find((n) => n.id === 'b0')!.name).toBe('Renamed');
    expect(api.patchNode).toHaveBeenCalledTimes(1);
    await p;
    expect(api.patchNode).toHaveBeenCalledWith(brain.id, { id: 'b0', name: 'Renamed' });
    expect(useStore.getState().syncError).toBeNull();
  });

  it('retries once on a network error, then sets syncError; retry() clears it once the API recovers', async () => {
    api.patchNode.mockRejectedValue(new TypeError('Failed to fetch'));
    await sync.editNode('b0', { name: 'Renamed' });
    expect(api.patchNode).toHaveBeenCalledTimes(2);
    const err = useStore.getState().syncError;
    expect(err?.label).toBeTruthy();
    expect(useStore.getState().brain!.nodes.find((n) => n.id === 'b0')!.name).toBe('Renamed'); // no rollback

    api.patchNode.mockResolvedValue(brain);
    await err!.retry();
    expect(api.patchNode).toHaveBeenLastCalledWith(brain.id, { id: 'b0', name: 'Renamed' });
    expect(useStore.getState().syncError).toBeNull();
  });

  it('does not retry a server error but still reports it', async () => {
    api.patchNode.mockRejectedValue(new Error('boom'));
    await sync.editNode('b0', { note: 'x' });
    expect(api.patchNode).toHaveBeenCalledTimes(1);
    expect(useStore.getState().syncError).not.toBeNull();
  });

  it('keeps the error when retry() fails again', async () => {
    api.patchNode.mockRejectedValue(new TypeError('offline'));
    await sync.editNode('b0', { name: 'A' });
    await useStore.getState().syncError!.retry();
    expect(useStore.getState().syncError).not.toBeNull();
  });
});

describe('saveUserNote', () => {
  it('skips the call when unchanged and patches when changed', async () => {
    await sync.saveUserNote('b0c0xzz0', 'keep');
    expect(api.patchNode).not.toHaveBeenCalled();
    await sync.saveUserNote('b0c0xzz0', 'new');
    expect(api.patchNode).toHaveBeenCalledWith(brain.id, { id: 'b0c0xzz0', userNote: 'new' });
    expect(useStore.getState().brain!.nodes.find((n) => n.id === 'b0c0xzz0')!.userNote).toBe('new');
  });
});

describe('deleteSubtree', () => {
  it('removes the node, its descendants and their links, and clears the selection', async () => {
    const before = useStore.getState().brain!.nodes;
    const doomed = new Set(['b0']);
    for (let grew = true; grew; ) {
      grew = false;
      for (const n of before) if (n.parent && doomed.has(n.parent) && !doomed.has(n.id)) { doomed.add(n.id); grew = true; }
    }
    expect(doomed.size).toBeGreaterThan(1);
    useStore.getState().select('b0c0xzz0');
    const p = sync.deleteSubtree('b0');
    const after = useStore.getState();
    expect(after.brain!.nodes.some((n) => doomed.has(n.id))).toBe(false);
    expect(after.brain!.nodes).toHaveLength(before.length - doomed.size);
    expect(after.brain!.links.some((l) => doomed.has(l.a) || doomed.has(l.b))).toBe(false);
    expect(after.selected).toBeNull();
    expect(after.brains[0].nodeCount).toBe(after.brain!.nodes.length);
    await p;
    expect(api.deleteNode).toHaveBeenCalledWith(brain.id, 'b0');
  });
  it('leaves the core alone', async () => {
    await sync.deleteSubtree('n0');
    expect(api.deleteNode).not.toHaveBeenCalled();
    expect(useStore.getState().brain!.nodes.some((n) => n.id === 'n0')).toBe(true);
  });
});

describe('addChildren / addLinks', () => {
  it('appends new nodes only, and posts only the new ones', async () => {
    const existing = brain.nodes[1];
    const fresh = { ...existing, id: 'b1c0xnew0', parent: 'b1', depth: 2 };
    await sync.addChildren([existing, fresh]);
    expect(useStore.getState().brain!.nodes.filter((n) => n.id === existing.id)).toHaveLength(1);
    expect(useStore.getState().brain!.nodes.some((n) => n.id === 'b1c0xnew0')).toBe(true);
    expect(api.addNodes).toHaveBeenCalledWith(brain.id, [fresh]);
  });
  it('dedupes links on a~b', async () => {
    const dupe = { a: 'b0c0', b: 'b2c1', why: 'again', by: 'skeptic' as const };
    const fresh = { a: 'b1', b: 'b3', why: 'new', by: 'skeptic' as const };
    await sync.addLinks([dupe, fresh, fresh]);
    expect(useStore.getState().brain!.links).toHaveLength(2);
    expect(api.addLinks).toHaveBeenCalledWith(brain.id, [fresh]);
  });
  it('makes no call when nothing is new', async () => {
    await sync.addLinks([{ a: 'b0c0', b: 'b2c1', why: '', by: 'builder' }]);
    expect(api.addLinks).not.toHaveBeenCalled();
  });
});

describe('applyRound', () => {
  it('applies locally with a provisional seq, then replaces the brain with the server copy', async () => {
    const server: Brain = { ...brain, round: 2, log: [...brain.log, { seq: 7, agent: 'customer', text: 'srv', node: 'n0', tag: 'R2 · +1' }] };
    api.applyRound.mockResolvedValue(server);
    const node = { ...brain.nodes[1], id: 'b1c0xr20', parent: 'b1', depth: 2 };
    const p = sync.applyRound({ round: 2, nodes: [node], links: [], log: { agent: 'customer', text: 'local', node: 'b1c0xr20', tag: 'R2 · +1' } });
    const local = useStore.getState().brain!;
    expect(local.round).toBe(2);
    expect(local.nodes.some((n) => n.id === 'b1c0xr20')).toBe(true);
    expect(local.log.at(-1)).toMatchObject({ seq: 2, text: 'local' });
    expect(await p).toBe(true);
    expect(api.applyRound).toHaveBeenCalledWith(brain.id, expect.objectContaining({ round: 2, log: expect.objectContaining({ seq: 2 }) }));
    expect(useStore.getState().brain).toEqual(server);
  });
  it('does not replace a brain the user has since left', async () => {
    api.applyRound.mockResolvedValue({ ...brain, round: 9 });
    const p = sync.applyRound({ round: 2, nodes: [], links: [], log: { agent: 'customer', text: 't', node: 'n0', tag: 'x' } });
    const other = { ...brain, id: 'other' };
    useStore.getState().openBrain(other);
    await p;
    expect(useStore.getState().brain!.id).toBe('other');
  });
  it('resolves false and sets syncError when the save fails, even with an older error pending', async () => {
    const older = { label: 'Edit node', retry: async () => {} };
    useStore.setState({ syncError: older });
    api.applyRound.mockRejectedValue(new Error('500'));
    const ok = await sync.applyRound({ round: 2, nodes: [], links: [], log: { agent: 'customer', text: 't', node: 'n0', tag: 'x' } });
    expect(ok).toBe(false);
    expect(useStore.getState().syncError?.label).toBe('Save round');
  });
});

describe('setTakeaway', () => {
  it('applies locally then adopts the server brain', async () => {
    const synth = { path: ['n0', 'b1'], verdict: 'v', brief: 'b' };
    const server: Brain = { ...brain, synth };
    api.setTakeaway.mockResolvedValue(server);
    const p = sync.setTakeaway(synth, { agent: 'strategist', text: 't', node: 'b1', tag: 'Takeaway' });
    expect(useStore.getState().brain!.synth).toEqual(synth);
    expect(useStore.getState().brain!.log.at(-1)).toMatchObject({ seq: 2, tag: 'Takeaway' });
    expect(await p).toBe(true);
    expect(useStore.getState().brain).toEqual(server);
  });
  it('resolves false and sets syncError when the save fails', async () => {
    api.setTakeaway.mockRejectedValue(new Error('500'));
    const ok = await sync.setTakeaway({ path: ['n0'], verdict: 'v', brief: 'b' }, { agent: 'strategist', text: 't', node: 'n0', tag: 'Takeaway' });
    expect(ok).toBe(false);
    expect(useStore.getState().syncError?.label).toBe('Save takeaway');
  });
});

describe('renameBrain', () => {
  it('updates the brain and its list row, then patches', async () => {
    const p = sync.renameBrain('New title');
    expect(useStore.getState().brain!.title).toBe('New title');
    expect(useStore.getState().brains[0].title).toBe('New title');
    await p;
    expect(api.patchBrain).toHaveBeenCalledWith(brain.id, { title: 'New title' });
  });
});

describe('createBrain / selectBrain / deleteBrain', () => {
  it('creates, opens and prepends to the list', async () => {
    const created: Brain = { ...brain, id: 'new', number: 2, title: 'Fresh' };
    api.createBrain.mockResolvedValue(created);
    const out = await sync.createBrain('Fresh', 's', created.nodes, []);
    expect(api.createBrain).toHaveBeenCalledWith({ title: 'Fresh', summary: 's', nodes: created.nodes, links: [] });
    expect(out).toEqual(created);
    expect(useStore.getState().brain!.id).toBe('new');
    expect(useStore.getState().brains.map((b) => b.id)).toEqual(['new', brain.id]);
  });

  it('createBrain pauses a run and is not overwritten by a slower earlier selectBrain', async () => {
    const other: Brain = { ...brain, id: 'other', title: 'Other' };
    const created: Brain = { ...brain, id: 'new', number: 2, title: 'Fresh' };
    let release!: (b: Brain) => void;
    api.getBrain.mockReturnValue(new Promise<Brain>((r) => (release = r)));
    api.createBrain.mockResolvedValue(created);
    const sel = sync.selectBrain('other');
    useStore.getState().setRun({ active: true, paused: false });
    const cre = sync.createBrain('Fresh', 's', created.nodes);
    expect(useStore.getState().run).toMatchObject({ active: false, paused: true });
    await cre;
    release(other);
    await sel;
    expect(useStore.getState().brain!.id).toBe('new');
  });

  it('selectBrain pauses a run, clears the selection, and loads the brain', async () => {
    const other: Brain = { ...brain, id: 'other', title: 'Other' };
    api.getBrain.mockResolvedValue(other);
    useStore.getState().select('b0');
    useStore.getState().setRun({ active: true, paused: false });
    const p = sync.selectBrain('other');
    expect(useStore.getState().run).toMatchObject({ active: false, paused: true });
    await p;
    expect(useStore.getState().brain!.id).toBe('other');
    expect(useStore.getState().selected).toBeNull();
  });

  it('deleteBrain removes the row and opens the next brain when the current one went', async () => {
    const other: Brain = { ...brain, id: 'other', title: 'Other' };
    useStore.setState((s) => ({ brains: [...s.brains, { id: 'other', number: 0, title: 'Other', nodeCount: 1, updatedAt: '' }] }));
    api.getBrain.mockResolvedValue(other);
    useStore.getState().select('b0');
    useStore.getState().setRun({ active: true, paused: false });
    let release!: (v: { ok: true }) => void;
    api.deleteBrain.mockReturnValue(new Promise((r) => (release = r)));
    const p = sync.deleteBrain(brain.id);
    // Closed before the request returns.
    const s = useStore.getState();
    expect(s.brains.map((b) => b.id)).toEqual(['other']);
    expect(s.brain).toBeNull();
    expect(s.selected).toBeNull();
    expect(s.run).toMatchObject({ active: false, paused: true });
    release({ ok: true });
    await p;
    expect(api.deleteBrain).toHaveBeenCalledWith(brain.id);
    expect(api.getBrain).toHaveBeenCalledWith('other');
    expect(useStore.getState().brain!.id).toBe('other');
  });

  it('deleteBrain of the last brain leaves nothing open and shows the empty-state status', async () => {
    useStore.getState().setStatus('Takeaway ready');
    await sync.deleteBrain(brain.id);
    expect(api.deleteBrain).toHaveBeenCalledWith(brain.id);
    expect(api.getBrain).not.toHaveBeenCalled();
    expect(useStore.getState()).toMatchObject({ brain: null, brains: [], selected: null });
    expect(useStore.getState().run.status).toBe(sync.EMPTY_STATUS);
  });

  it('deleteBrain does not reopen anything when the user opened another brain while the DELETE was in flight', async () => {
    const third: Brain = { ...brain, id: 'third', title: 'Third' };
    useStore.setState((s) => ({ brains: [...s.brains, { id: 'other', number: 2, title: 'Other', nodeCount: 1, updatedAt: '' }, { id: 'third', number: 3, title: 'Third', nodeCount: 1, updatedAt: '' }] }));
    let release!: (v: { ok: true }) => void;
    api.deleteBrain.mockReturnValue(new Promise((r) => (release = r)));
    api.getBrain.mockResolvedValue(third);
    const p = sync.deleteBrain(brain.id);
    await sync.selectBrain('third');
    release({ ok: true });
    await p;
    expect(api.getBrain).toHaveBeenCalledTimes(1);
    expect(useStore.getState().brain!.id).toBe('third');
  });

  it('deleteBrain of a non-current brain leaves the open brain alone', async () => {
    useStore.setState((s) => ({ brains: [...s.brains, { id: 'x', number: 0, title: 'X', nodeCount: 1, updatedAt: '' }] }));
    await sync.deleteBrain('x');
    expect(api.getBrain).not.toHaveBeenCalled();
    expect(useStore.getState().brain!.id).toBe(brain.id);
  });
});

describe('switchUser', () => {
  const row = (id: string) => ({ id, number: 1, title: id, nodeCount: 1, updatedAt: '' });

  it('drops the old user state at once, and a slower earlier selectBrain does not reopen the old brain', async () => {
    const old: Brain = { ...brain, id: 'old', title: 'Old' };
    const fresh: Brain = { ...brain, id: 'new', title: 'New' };
    let release!: (b: Brain) => void;
    api.getBrain.mockReturnValueOnce(new Promise<Brain>((r) => (release = r))).mockResolvedValueOnce(fresh);
    useStore.getState().select('b0');
    useStore.getState().setRun({ active: true, paused: false, phase: 'diverge', agent: 'builder' });
    useStore.getState().setSyncError({ label: 'Edit node', retry: async () => undefined });
    const sel = sync.selectBrain('old');
    const sw = sync.switchUser({ user: { id: 'u2' }, brains: [row('new')] });
    const mid = useStore.getState();
    expect([mid.brain, mid.selected, mid.syncError, mid.user?.id]).toEqual([null, null, null, 'u2']);
    expect(mid.run).toMatchObject({ active: false, paused: true, phase: null, agent: null });
    expect(mid.brains.map((b) => b.id)).toEqual(['new']);
    await sw;
    release(old);
    await sel;
    expect(useStore.getState().brain!.id).toBe('new');
    expect(api.getBrain).toHaveBeenLastCalledWith('new');
  });

  it('with no brains ends with brain null and the run paused, even if an earlier selectBrain resolves later', async () => {
    const old: Brain = { ...brain, id: 'old', title: 'Old' };
    let release!: (b: Brain) => void;
    api.getBrain.mockReturnValueOnce(new Promise<Brain>((r) => (release = r)));
    useStore.getState().setRun({ active: true, paused: false });
    const sel = sync.selectBrain('old');
    await sync.switchUser({ user: { id: 'u2' }, brains: [] });
    release(old);
    await sel;
    const s = useStore.getState();
    expect(s.brain).toBeNull();
    expect(s.brains).toEqual([]);
    expect(s.run).toMatchObject({ active: false, paused: true, status: sync.EMPTY_STATUS });
    expect(api.getBrain).toHaveBeenCalledTimes(1);
  });
});
