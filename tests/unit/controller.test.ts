import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Brain, IdeaNode } from '@/engine/types';
import { ApiError, type ApiClient } from '@/lib/apiClient';
import { subtreeIds } from '@/lib/agents/pickTarget';
import { configureController, createController, setController, type ControllerApi } from '@/lib/controller';
import { mapIdea, pathNames } from '@/lib/grow';
import { expandWithAgents, runAction, startFromInput } from '@/lib/run';
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

describe('grow', () => {
  it('pathNames runs from the core to the node', () => {
    expect(pathNames(brain.nodes, 'b2c1')).toEqual([brain.nodes[0].name, brain.nodes.find(n => n.id === 'b2')!.name, brain.nodes.find(n => n.id === 'b2c1')!.name]);
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

describe('startFromInput', () => {
  const idle = () => vi.waitFor(() => expect(useStore.getState().run.active).toBe(false), { timeout: 5000 });
  let c: ReturnType<typeof createController>;
  beforeEach(() => {
    c = createController(() => null, { sleep: async () => {} });
    setController(c);
    useStore.setState({ settings: { rounds: 5 } });
    return () => {
      c.dispose();
      setController(null);
    };
  });

  it('runAction: node selected → scope, text → map, open brain → run, nothing → null', () => {
    const s = useStore.getState();
    expect(runAction('', s)).toBe('run');
    expect(runAction('  an idea ', s)).toBe('map');
    expect(runAction('', { ...s, selected: 'b2' })).toBe('scope');
    expect(runAction('focus', { ...s, selected: 'b2' })).toBe('scope');
    expect(runAction('', { ...s, brain: null })).toBeNull();
    expect(runAction('x', { ...s, brain: null })).toBe('map');
  });

  it('text and no selection: maps a new brain, then runs the agents on it', async () => {
    expect(await startFromInput('a tool library for renters')).toBe(true);
    expect(llm.llm.map).toHaveBeenCalledWith({ idea: 'a tool library for renters' });
    expect(useStore.getState().brain!.id).toBe('new');
    expect(useStore.getState().run).toMatchObject({ active: true, scope: null });
    await idle();
    const s = useStore.getState();
    expect(s.brain!.round).toBe(5);
    expect(s.brain!.synth).not.toBeNull();
    expect(s.run.status).toBe('Done · 5 rounds');
    expect(llm.llm.takeaway).toHaveBeenCalledTimes(1);
  });

  it('a failed map keeps the text, shows the error and starts no run', async () => {
    vi.mocked(llm.llm.map).mockRejectedValueOnce(new Error('upstream down'));
    expect(await startFromInput('a tool library for renters')).toBe(false);
    const s = useStore.getState();
    expect(s.brain!.id).toBe(brain.id);
    expect(s.run.status).toBe('Could not map the idea: upstream down');
    expect(s.run.active).toBe(false);
    expect(s.ui.busy).toBeNull();
    expect(llm.llm.agentRound).not.toHaveBeenCalled();
  });

  it('empty input with an open brain: a full run on it', async () => {
    expect(await startFromInput('  ')).toBe(true);
    expect(llm.llm.map).not.toHaveBeenCalled();
    await idle();
    expect(useStore.getState().brain!.round).toBe(brain.round + 5);
    expect(useStore.getState().run.status).toBe('Done · 5 rounds');
  });

  it('empty input and no brain: nothing happens', async () => {
    useStore.setState({ brain: null });
    expect(await startFromInput('')).toBe(false);
    expect(llm.llm.map).not.toHaveBeenCalled();
    expect(useStore.getState().run.active).toBe(false);
  });

  it('a selected node: a scoped run with the text as focus, inside the subtree, no takeaway', async () => {
    useStore.getState().setTakeawayOpen(false);
    useStore.getState().select('b2');
    const synth = useStore.getState().brain!.synth;
    expect(await startFromInput(' who pays? ')).toBe(true);
    expect(llm.llm.map).not.toHaveBeenCalled();
    expect(useStore.getState().run).toMatchObject({ active: true, scope: 'b2' });
    expect(useStore.getState().selected).toBeNull();
    await idle();
    const s = useStore.getState();
    const calls = vi.mocked(llm.llm.agentRound).mock.calls.map(([b]) => b);
    expect(calls).toHaveLength(5);
    const scope = subtreeIds(s.brain!.nodes, 'b2');
    expect(calls.every(b => scope.has(b.target.id) && b.focus === 'who pays?')).toBe(true);
    expect(llm.llm.takeaway).not.toHaveBeenCalled();
    expect(s.brain!.synth).toEqual(synth);
    expect(s.ui.takeawayOpen).toBe(false);
    expect(s.run).toMatchObject({ active: false, scope: null, status: `Done · 5 rounds on ${brain.nodes.find(n => n.id === 'b2')!.name}` });
  });

  it('a selected node and no text: a scoped run without focus', async () => {
    useStore.getState().select('b2');
    expect(await startFromInput('')).toBe(true);
    await idle();
    expect(vi.mocked(llm.llm.agentRound).mock.calls.every(([b]) => b.focus === undefined)).toBe(true);
  });

  it('is a no-op while a run is active, winding down, or mapping', async () => {
    useStore.getState().setRun({ active: true });
    expect(await startFromInput('an idea here')).toBe(false);
    useStore.getState().setRun({ active: false, phase: 'connect' });
    expect(await startFromInput('')).toBe(false);
    useStore.getState().setRun({ phase: null });
    useStore.getState().setBusy('map');
    expect(await startFromInput('an idea here')).toBe(false);
    expect(llm.llm.map).not.toHaveBeenCalled();
    expect(llm.llm.agentRound).not.toHaveBeenCalled();
  });

  it('expandWithAgents starts a scoped run on the node; refused while a run is going', async () => {
    useStore.getState().setRun({ active: true });
    expandWithAgents('b2');
    expect(llm.llm.agentRound).not.toHaveBeenCalled();
    useStore.getState().setRun({ active: false });
    expandWithAgents('b2');
    expect(useStore.getState().run.scope).toBe('b2');
    await idle();
    const scope = subtreeIds(useStore.getState().brain!.nodes, 'b2');
    expect(vi.mocked(llm.llm.agentRound).mock.calls.every(([b]) => scope.has(b.target.id))).toBe(true);
  });

  it('a scope node that is not in the brain starts nothing', () => {
    c.startRun({ scope: 'nope' });
    expect(useStore.getState().run.active).toBe(false);
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
