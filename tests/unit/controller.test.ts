import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KIND_COLORS, type Brain, type IdeaNode } from '@/engine/types';
import { ApiError, type ApiClient } from '@/lib/apiClient';
import { configureController, createController, type ControllerApi } from '@/lib/controller';
import { expandKids, expandNode, mapIdea, pathNames } from '@/lib/grow';
import { fallback } from '@/lib/llm/fallback';
import { initialState, useStore } from '@/lib/store';
import { configureSync } from '@/lib/sync';
import { fixtureBrain } from '../fixtures/brain';

const META = { source: 'fallback' as const, attempts: 0 };
const echo = vi.fn(async () => structuredClone(useStore.getState().brain as Brain));

const llm: ControllerApi = {
  me: vi.fn(),
  llm: {
    map: vi.fn(async (b) => ({ data: fallback.map(b.idea) as never, meta: META })),
    expand: vi.fn(async (b) => ({ data: fallback.expand(b.path, b.question), meta: META })),
    agentRound: vi.fn(async (b) => ({ data: fallback.agentRound(b.agent, b.target as IdeaNode, b.nodes as IdeaNode[]), meta: META })),
    takeaway: vi.fn(async (b) => ({ data: fallback.takeaway(b.nodes as IdeaNode[], [] ), meta: META })),
  },
};

let brain: Brain;

/** Pads the fixture brain with depth-1 nodes until it holds `total` nodes. */
const padTo = (b: Brain, total: number): Brain => ({
  ...b,
  nodes: [...b.nodes, ...Array.from({ length: total - b.nodes.length }, (_, i) => ({ ...b.nodes[1], id: `pad${i}`, name: `Pad ${i}`, parent: 'n0', depth: 1, position: 100 + i }))],
});

beforeEach(() => {
  vi.clearAllMocks();
  brain = fixtureBrain();
  configureController({ api: llm });
  configureSync({
    api: {
      applyRound: echo, setTakeaway: echo, addNodes: echo, patchNode: echo,
      createBrain: vi.fn(async (body) => ({ ...brain, id: 'new', title: body.title, nodes: body.nodes as IdeaNode[], links: [], log: [], synth: null, round: 0 })),
    } as unknown as ApiClient,
  });
  useStore.setState({ ...initialState, brain, brains: [] });
});

describe('expandKids', () => {
  it('children of the core cycle through the kinds and their colours', () => {
    const core = brain.nodes.find(n => n.id === 'n0')!;
    const kids = expandKids(core, [{ name: 'a' }, { name: 'b' }, { name: '' }], 6, 'st');
    expect(kids.map(k => [k.id, k.kind, k.color, k.position, k.depth, k.by])).toEqual([
      ['n0xst0', 'Problem', KIND_COLORS.Problem, 6, 1, null],
      ['n0xst1', 'People', KIND_COLORS.People, 7, 1, null],
    ]);
  });
  it('deeper children inherit kind and colour', () => {
    const b2 = brain.nodes.find(n => n.id === 'b2')!;
    const [k] = expandKids(b2, [{ name: 'x', note: 'y' }], 0, 's');
    expect(k).toMatchObject({ parent: 'b2', kind: b2.kind, color: b2.color, note: 'y', userNote: '', critic: false });
  });
  it('pathNames runs from the core to the node', () => {
    expect(pathNames(brain.nodes, 'b2c1')).toEqual([brain.nodes[0].name, brain.nodes.find(n => n.id === 'b2')!.name, brain.nodes.find(n => n.id === 'b2c1')!.name]);
  });
});

describe('grow', () => {
  it('expandNode adds children under the node and reports the provider', async () => {
    const before = brain.nodes.filter(n => n.parent === 'b2').length;
    expect(await expandNode('b2', 'Who pays?')).toBe(true);
    const s = useStore.getState();
    expect(s.brain!.nodes.filter(n => n.parent === 'b2').length).toBe(before + 4);
    expect(llm.llm.expand).toHaveBeenCalledWith(expect.objectContaining({ question: 'Who pays?', path: pathNames(brain.nodes, 'b2') }));
    expect(s.run.status).toMatch(/^\+4 on .* · offline fallback$/);
    expect(s.ui.busy).toBeNull();
  });
  it('expandNode is refused while a run is active or still winding down', async () => {
    useStore.getState().setRun({ active: true });
    expect(await expandNode('b2')).toBe(false);
    useStore.getState().setRun({ active: false, phase: 'connect' });
    expect(await expandNode('b2')).toBe(false);
    expect(llm.llm.expand).not.toHaveBeenCalled();
  });
  it('expandNode on a full brain shows the limit without calling the LLM', async () => {
    useStore.setState({ brain: padTo(brain, 300) });
    expect(await expandNode('b2')).toBe(false);
    expect(useStore.getState().run.status).toBe('this brain is full (300 nodes)');
    expect(llm.llm.expand).not.toHaveBeenCalled();
  });
  it('expandNode adds only what fits and shows the server message when the save is refused', async () => {
    useStore.setState({ brain: padTo(brain, 298) });
    expect(await expandNode('b2')).toBe(true);
    expect(useStore.getState().brain!.nodes).toHaveLength(300);
    useStore.setState({ brain: padTo(brain, 296) });
    const addNodes = vi.fn(async () => { throw new ApiError(400, 'this brain is full (300 nodes)'); });
    configureSync({ api: { addNodes } as unknown as ApiClient });
    expect(await expandNode('b2')).toBe(false);
    expect(useStore.getState().run.status).toBe('this brain is full (300 nodes)');
    expect(useStore.getState().syncError).toMatchObject({ label: 'Add ideas', message: 'this brain is full (300 nodes)' });
  });
  it('mapIdea creates and opens a new brain', async () => {
    expect(await mapIdea('a tool library for renters')).toBe(true);
    const s = useStore.getState();
    expect(s.brain!.id).toBe('new');
    expect(s.run.status).toBe(`${s.brain!.nodes.length} nodes · offline fallback`);
  });
  it('mapIdea refuses a too-short idea without calling the LLM', async () => {
    expect(await mapIdea('ab')).toBe(false);
    expect(llm.llm.map).not.toHaveBeenCalled();
  });
});

describe('controller', () => {
  const run = async () => {
    const c = createController(() => null, { sleep: async () => {} });
    c.startRun();
    await vi.waitFor(() => expect(useStore.getState().run.active).toBe(false), { timeout: 5000 });
    c.dispose();
  };

  it('a run keeps a pending sync error, applies each round once and opens the takeaway', async () => {
    const pending = { label: 'Edit node', retry: async () => {} };
    useStore.setState({ settings: { rounds: 5 }, syncError: pending, selected: 'b2' });
    useStore.getState().setTakeawayOpen(false);
    useStore.getState().setShowPath(false);
    const log = brain.log.length;
    await run();
    const s = useStore.getState();
    expect(s.syncError).toBe(pending);
    expect(s.selected).toBeNull();
    expect(s.brain!.round).toBe(brain.round + 5);
    expect(s.brain!.log.length).toBe(log + 6);
    expect(s.run).toMatchObject({ active: false, paused: false, phase: null, agent: null, round: brain.round + 5, total: brain.round + 5, status: 'Done · 5 rounds' });
    expect(s.ui.takeawayOpen).toBe(true);
    expect(s.ui.showPath).toBe(true);
  });

  it('a full brain stops the run with the limit in the status line', async () => {
    useStore.setState({ brain: padTo(brain, 300) });
    await run();
    expect(useStore.getState().run).toMatchObject({ active: false, paused: true, status: 'this brain is full (300 nodes)' });
    expect(llm.llm.agentRound).not.toHaveBeenCalled();
  });

  it('a round the server refuses as full stops the run with its message', async () => {
    configureSync({ api: { applyRound: vi.fn(async () => { throw new ApiError(400, 'this brain is full (300 nodes)'); }) } as unknown as ApiClient });
    await run();
    const s = useStore.getState();
    expect(s.run).toMatchObject({ active: false, paused: true, status: 'this brain is full (300 nodes)' });
    expect(llm.llm.agentRound).toHaveBeenCalledTimes(1);
    expect(llm.llm.takeaway).not.toHaveBeenCalled();
  });

  it('a round that fails without a server message stops the run as "Round not saved"', async () => {
    configureSync({ api: { applyRound: vi.fn(async () => { throw new Error('boom'); }) } as unknown as ApiClient });
    await run();
    expect(useStore.getState().run).toMatchObject({ active: false, paused: true, status: 'Round not saved' });
    expect(useStore.getState().syncError).toMatchObject({ label: 'Save round' });
    expect(useStore.getState().syncError?.message).toBeUndefined();
  });

  it('a brain switch stops the run in the store at once', () => {
    const c = createController(() => null);
    useStore.getState().setRun({ active: true, paused: false, round: 3, total: 8 });
    useStore.getState().openBrain({ ...brain, id: 'other' });
    expect(useStore.getState().run).toMatchObject({ active: false, paused: true });
    c.dispose();
  });

  it('clears a selection whose node disappears', () => {
    const c = createController(() => null);
    useStore.getState().select('b2');
    useStore.getState().patchBrain(b => ({ ...b, nodes: b.nodes.filter(n => n.id !== 'b2') }));
    expect(useStore.getState().selected).toBeNull();
    c.dispose();
  });
});
