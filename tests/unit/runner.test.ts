import { describe, it, expect } from 'vitest';
import type { AgentEvent, Brain, LogEntry } from '@/engine/types';
import { AgentRunner } from '@/lib/agents/runner';
import type { AgentRoundReplyOut, TakeawayReplyOut } from '@/lib/llm/schemas';
import type { LlmMeta } from '@/lib/apiClient';
import { sampleBrain } from '@/lib/sample/toolLibrary';

const META: LlmMeta = { source: 'model', model: 'm', ms: 1, attempts: 1 };
const TAKEAWAY: TakeawayReplyOut = { leaf: 'b2c1', verdict: 'Pursue Deposit system.', brief: 'One. Two. Three.' };

type L = { a: string; b: string; why: string };

function setup(opts: { links?: (target: string) => L[] } = {}) {
  const sb = sampleBrain('#111');
  const brain: Brain = { id: 'brain-1', number: 1, title: sb.title, summary: sb.summary, round: 0, synth: null, nodes: sb.nodes, links: [], log: [], createdAt: '', updatedAt: '' };
  const h = {
    brain,
    current: brain as Brain | null,
    events: [] as AgentEvent[],
    rounds: [] as { round: number; tag: string; links: number; nodes: number }[],
    takeaways: [] as { path: string[]; leaf: string }[],
    emitted: [] as string[],
    metas: [] as LlmMeta[],
    clock: 1000,
    fail: false,
    failApplyFlag: false,
    failTakeawayFlag: false,
    leaf: 'b2c1',
    onTakeaway: () => {},
    onRound: (_n: number) => {},
    onAgentRound: (_body: { target: { id: string } }) => {},
    onApplied: (_n: number) => {},
    onScene: (_e: AgentEvent) => {},
  };
  const runner = new AgentRunner({
    api: {
      agentRound: async (body) => {
        h.onAgentRound(body);
        const reply: AgentRoundReplyOut = {
          thought: 'I noticed something.',
          children: [{ name: 'Idea one', note: 'n1' }, { name: 'Idea two', note: 'n2' }],
          links: (opts.links ?? ((t) => [{ a: t, b: 'b4c0', why: 'both about loss' }]))(body.target.id).slice(0, 1),
        };
        return { data: reply, meta: META };
      },
      takeaway: async () => { h.onTakeaway(); return { data: { ...TAKEAWAY, leaf: h.leaf }, meta: META }; },
    },
    sync: {
      applyRound: async (body) => {
        if (h.fail) throw new Error('disk full');
        brain.round = body.round;
        brain.nodes.push(...body.nodes);
        brain.links.push(...body.links);
        const entry: LogEntry = { ...body.log, seq: brain.log.length + 1 };
        brain.log.push(entry);
        h.rounds.push({ round: body.round, tag: body.log.tag, links: body.links.length, nodes: body.nodes.length });
        h.onApplied(body.round);
        return !h.failApplyFlag;
      },
      setTakeaway: async (synth, log) => {
        brain.synth = synth;
        brain.log.push({ ...log, seq: brain.log.length + 1 });
        h.takeaways.push({ path: synth.path, leaf: log.node });
        return !h.failTakeawayFlag;
      },
    },
    getBrain: () => h.current,
    scene: async (e) => { h.onScene(e); h.events.push(e); },
    ink: () => '#111',
    sleep: async () => {},
    rand: () => 0,
    now: () => h.clock++,
    onMeta: (m) => { h.metas.push(m); },
  });
  runner.on('round', (n) => { h.emitted.push(`round:${n}`); h.onRound(n); });
  runner.on('finished', () => h.emitted.push('finished'));
  runner.on('error', (m) => h.emitted.push(`error:${m}`));
  runner.on('status', (s) => h.emitted.push(`status:${s}`));
  runner.on('phase', (p) => h.emitted.push(`phase:${p}`));
  return { h, runner };
}

const types = (events: AgentEvent[]) => events.map((e) => e.type);

describe('AgentRunner', () => {
  it('runs rounds then the takeaway in contract order and persists each round', async () => {
    const { h, runner } = setup();
    await runner.start('brain-1', 2);

    const round = ['plan', 'travel', 'think', 'spawn', 'prepareLink', 'link', 'done'];
    expect(types(h.events)).toEqual([...round, ...round, 'plan', 'think', 'done']);

    expect(h.rounds.map((r) => [r.round, r.tag, r.nodes, r.links])).toEqual([[1, 'R1 · +2', 2, 1], [2, 'R2 · +2', 2, 1]]);
    expect(h.takeaways).toHaveLength(1);
    expect(h.takeaways[0].path[0]).toBe('n0');
    expect(h.takeaways[0].path.at(-1)).toBe('b2c1');
    expect(h.brain.synth?.verdict).toBe('Pursue Deposit system.');
    expect(h.brain.log.at(-1)).toMatchObject({ agent: 'strategist', tag: 'Takeaway', node: 'b2c1' });
    expect(h.emitted).toContain('finished');
    expect(h.emitted).toContain('status:Done · 2 rounds');
    expect(h.emitted.filter((e) => e.startsWith('round:'))).toEqual(['round:1', 'round:2']);
    expect(runner.running).toBe(false);
    expect(h.metas).toHaveLength(3);
  });

  it('agents rotate by absolute round and the link leaves from the target', async () => {
    const { h, runner } = setup();
    await runner.start('brain-1', 2);
    const plans = h.events.filter((e) => e.type === 'plan');
    expect(plans.map((p) => p.agent)).toEqual(['researcher', 'builder', 'strategist']);
    const t = h.events.find((e) => e.type === 'travel');
    expect(t && t.type === 'travel' && t.path[0]).toBe('n0');
    const link = h.events.find((e) => e.type === 'link');
    const plan = plans[0];
    expect(link && link.type === 'link' && plan.type === 'plan' && link.a).toBe(plan.type === 'plan' ? plan.target : '');
  });

  it('sends spawn before the children reach the brain, and prepareLink before the link is in the brain', async () => {
    const { h, runner } = setup();
    const seen: string[] = [];
    const before = h.brain.nodes.length;
    h.onScene = (e) => {
      if (e.type === 'spawn') seen.push(`spawn nodes=${h.brain.nodes.length - before}`);
      if (e.type === 'prepareLink') seen.push(`prepare links=${h.brain.links.length}`);
      if (e.type === 'link') seen.push(`link links=${h.brain.links.length}`);
    };
    await runner.start('brain-1', 1);
    expect(seen).toEqual(['spawn nodes=0', 'prepare links=0', 'link links=1']);
  });

  it('omits link events when the reply has no links', async () => {
    const { h, runner } = setup({ links: () => [] });
    await runner.start('brain-1', 1);
    expect(types(h.events)).toEqual(['plan', 'travel', 'think', 'spawn', 'done', 'plan', 'think', 'done']);
  });

  it.each([
    ['same branch', (t: string) => [{ a: t, b: 'b0c1', why: '' }]],
    ['unknown id', (t: string) => [{ a: t, b: 'zzz', why: '' }]],
    ['self link', (t: string) => [{ a: t, b: t, why: '' }]],
    ['already present (reversed)', () => [{ a: 'b4c0', b: 'b0c0', why: '' }]],
  ])('drops an invalid link: %s', async (_name, links) => {
    const { h, runner } = setup({ links });
    h.brain.links.push({ a: 'b0c0', b: 'b4c0', why: '', by: 'builder' });
    await runner.start('brain-1', 1);
    expect(types(h.events)).toEqual(['plan', 'travel', 'think', 'spawn', 'done', 'plan', 'think', 'done']);
    expect(h.rounds[0].links).toBe(0);
  });

  it('flips a link whose far end is the target so the agent leaves from the target', async () => {
    const { h, runner } = setup({ links: (t) => [{ a: 'b4c0', b: t, why: '' }] });
    await runner.start('brain-1', 1);
    const plan = h.events.find((e) => e.type === 'plan');
    const link = h.events.find((e) => e.type === 'link');
    expect(plan?.type === 'plan' && link?.type === 'link' && link.a === plan.target && link.b === 'b4c0').toBe(true);
  });

  it('pause from the first round event stops before round 2: no takeaway, no finished, done emitted', async () => {
    const { h, runner } = setup();
    h.onRound = () => runner.pause();
    await runner.start('brain-1', 2);
    expect(h.rounds.map((r) => r.round)).toEqual([1]);
    expect(h.takeaways).toHaveLength(0);
    expect(h.emitted).not.toContain('finished');
    expect(h.emitted).toContain('status:Paused after round 1');
    expect(types(h.events).at(-1)).toBe('done');
    expect(types(h.events).filter((t) => t === 'plan')).toHaveLength(1);
    expect(runner.running).toBe(false);
  });

  it('stops when the brain id changes mid-run, emitting done for the visible agent', async () => {
    const { h, runner } = setup();
    h.onAgentRound = () => { h.current = { ...h.brain, id: 'other' }; };
    await runner.start('brain-1', 2);
    expect(types(h.events)).toEqual(['plan', 'travel', 'think', 'done']);
    expect(h.rounds).toHaveLength(0);
    expect(h.emitted).not.toContain('finished');
  });

  it('stops when the brain is deleted between rounds', async () => {
    const { h, runner } = setup();
    h.onApplied = () => { h.current = null; };
    await runner.start('brain-1', 3);
    expect(h.rounds).toHaveLength(1);
    expect(h.takeaways).toHaveLength(0);
    expect(types(h.events).at(-1)).toBe('done');
  });

  it('an applyRound rejection emits error, ends with done and stops', async () => {
    const { h, runner } = setup();
    h.fail = true;
    await runner.start('brain-1', 2);
    expect(h.emitted.some((e) => e === 'error:disk full')).toBe(true);
    expect(h.emitted).not.toContain('finished');
    expect(types(h.events).filter((t) => t === 'plan')).toHaveLength(1);
    expect(types(h.events).at(-1)).toBe('done');
    expect(h.takeaways).toHaveLength(0);
    expect(runner.running).toBe(false);
  });

  it('falls back to the heuristic leaf (depth + 1.5 if linked) when the reply leaf is unknown', async () => {
    const { h, runner } = setup();
    h.leaf = 'nope';
    await runner.start('brain-1', 1);
    const last = h.takeaways[0];
    // linked target b0c0 scores 2 + 1.5, beating its unlinked depth-3 children (3)
    expect(last.leaf).toBe('b0c0');
    expect(last.path).toEqual(['n0', 'b0', 'b0c0']);
  });

  it('pausing during the takeaway writes nothing and does not finish', async () => {
    const { h, runner } = setup();
    h.onTakeaway = () => runner.pause();
    await runner.start('brain-1', 1);
    expect(h.takeaways).toHaveLength(0);
    expect(h.emitted).not.toContain('finished');
    expect(types(h.events).at(-1)).toBe('done');
  });

  it('never calls applyRound when the brain is switched during the spawn hold', async () => {
    const { h, runner } = setup();
    h.onScene = (e) => { if (e.type === 'spawn') h.current = { ...h.brain, id: 'other' }; };
    await runner.start('brain-1', 2);
    expect(h.rounds).toHaveLength(0);
    expect(h.brain.nodes.length).toBe(sampleBrain('#111').nodes.length);
    expect(types(h.events)).toEqual(['plan', 'travel', 'think', 'spawn', 'done']);
    expect(h.emitted).not.toContain('finished');
  });

  it('still persists the in-flight round when paused during spawn', async () => {
    const { h, runner } = setup();
    h.onScene = (e) => { if (e.type === 'spawn') runner.pause(); };
    await runner.start('brain-1', 2);
    expect(h.rounds.map((r) => r.round)).toEqual([1]);
    expect(h.takeaways).toHaveLength(0);
  });

  it('applyRound resolving false emits error, pauses and stops', async () => {
    const { h, runner } = setup();
    h.failApplyFlag = true;
    await runner.start('brain-1', 3);
    expect(h.emitted).toContain('error:Round not saved');
    expect(h.emitted).not.toContain('finished');
    expect(h.emitted.some((e) => e.startsWith('status:Paused'))).toBe(false);
    expect(h.rounds).toHaveLength(1);
    expect(h.takeaways).toHaveLength(0);
    expect(types(h.events).filter((t) => t === 'plan')).toHaveLength(1);
    expect(types(h.events).at(-1)).toBe('done');
    expect(runner.running).toBe(false);
  });

  it('setTakeaway resolving false emits error and does not finish', async () => {
    const { h, runner } = setup();
    h.failTakeawayFlag = true;
    await runner.start('brain-1', 1);
    expect(h.takeaways).toHaveLength(1);
    expect(h.emitted).toContain('error:Takeaway not saved');
    expect(h.emitted).not.toContain('finished');
    expect(types(h.events).at(-1)).toBe('done');
    expect(runner.running).toBe(false);
  });

  it('is running before the first event, so a re-entrant start is a no-op', async () => {
    const { runner } = setup();
    let seen: boolean | null = null;
    let again: Promise<void> | null = null;
    let first: Promise<void> | null = null;
    runner.on('phase', (p) => {
      if (p !== 'plan' || seen !== null) return;
      seen = runner.running;
      again = runner.start('brain-1', 1);
    });
    first = runner.start('brain-1', 1);
    await first;
    expect(seen).toBe(true);
    expect(again).toBe(first);
  });

  it('start while running returns the same promise', async () => {
    const { runner } = setup();
    const a = runner.start('brain-1', 1);
    const b = runner.start('brain-1', 1);
    expect(b).toBe(a);
    expect(runner.running).toBe(true);
    await a;
  });

  it('on() returns an unsubscribe function', async () => {
    const { runner } = setup();
    const seen: number[] = [];
    const off = runner.on('round', (n) => seen.push(n));
    off();
    await runner.start('brain-1', 1);
    expect(seen).toEqual([]);
  });
});
