import type { AgentEvent, AgentId, Brain, CrossLink, IdeaNode, LogEntry, Takeaway } from '@/engine/types';
import { agentForRound } from '@/lib/agents/roster';
import { makeKids } from '@/lib/agents/makeKids';
import { pickTarget } from '@/lib/agents/pickTarget';
import type { apiClient, LlmMeta } from '@/lib/apiClient';
import { mapLines } from '@/lib/llm/prompts';
import type { RoundInput } from '@/lib/sync';

export type Phase = 'plan' | 'diverge' | 'connect' | 'takeaway';

interface Events {
  phase: (phase: Phase | null, agent: AgentId | null, targetName?: string) => void;
  status: (text: string) => void;
  log: (entry: LogEntry) => void;
  round: (n: number) => void;
  finished: () => void;
  error: (message: string) => void;
}

export interface RunnerDeps {
  api: { agentRound: typeof apiClient.llm.agentRound; takeaway: typeof apiClient.llm.takeaway };
  sync: { applyRound: (body: RoundInput) => Promise<void>; setTakeaway: (synth: Takeaway, log: Omit<LogEntry, 'seq'>) => Promise<void> };
  getBrain: () => Brain | null;
  /** Sends a choreography event to the scene; resolves when the scene's animation for it has finished. */
  scene: (event: AgentEvent) => Promise<void>;
  ink: () => string;
  /** True when the last sync call failed (the real sync layer reports failures through the store, not by rejecting). */
  syncFailed: () => boolean;
  onMeta?: (meta: LlmMeta) => void;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
  now?: () => number;
}

const THINK_MS = 1200;
const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Per-run helpers shared by the round loop and the takeaway step. */
interface Ctx {
  brain: () => Brain | null;
  alive: () => boolean;
  think: (agent: AgentId, target: string, verb: string) => void;
  meta: (m: LlmMeta) => void;
  sleep: (ms: number) => Promise<void>;
  show: (agent: AgentId) => void;
}

const pathTo = (nodes: IdeaNode[], id: string): string[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  for (let n = byId.get(id); n; n = n.parent ? byId.get(n.parent) : undefined) out.unshift(n.id);
  return out;
};

/** Plain async loop: one agent per round plans, travels, thinks, spawns and links; then the Strategist writes the takeaway. */
export class AgentRunner {
  private handlers: { [K in keyof Events]: Set<Events[K]> } = { phase: new Set(), status: new Set(), log: new Set(), round: new Set(), finished: new Set(), error: new Set() };
  private current: Promise<void> | null = null;
  private paused = false;
  private hits: { brainId: string; counts: Record<string, number> } = { brainId: '', counts: {} };

  constructor(private deps: RunnerDeps) {}

  get running(): boolean {
    return this.current !== null;
  }

  on<K extends keyof Events>(event: K, cb: Events[K]): () => void {
    (this.handlers[event] as Set<Events[K]>).add(cb);
    return () => void (this.handlers[event] as Set<Events[K]>).delete(cb);
  }

  pause(): void {
    this.paused = true;
  }

  start(brainId: string, rounds: number): Promise<void> {
    if (this.current) return this.current;
    this.paused = false;
    // Deferred a microtask so `current` is set before the loop emits its first event (handlers see running === true).
    const run = Promise.resolve().then(() => this.loop(brainId, rounds)).finally(() => {
      this.current = null;
      this.emit('phase', null, null);
    });
    this.current = run;
    return run;
  }

  private emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    for (const cb of this.handlers[event] as Set<(...a: Parameters<Events[K]>) => void>) cb(...args);
  }

  private async loop(brainId: string, rounds: number): Promise<void> {
    const { deps } = this;
    const sleep = deps.sleep ?? defaultSleep;
    const rand = deps.rand ?? Math.random;
    const now = deps.now ?? Date.now;
    const brain = (): Brain | null => { const b = deps.getBrain(); return b && b.id === brainId ? b : null; };
    const alive = (): boolean => brain() !== null && !this.paused;
    const meta = (m: LlmMeta): void => deps.onMeta?.(m);
    const think = (agent: AgentId, target: string, verb: string): void => void deps.scene({ type: 'think', agent, target, verb }).catch(() => undefined);
    /** The agent currently on stage; cleared by `done`, and sent `done` on any other exit. */
    let shown: AgentId | null = null;
    const ctx: Ctx = { brain, alive, think, meta, sleep, show: (a) => { shown = a; } };
    const leave = async (): Promise<void> => {
      if (shown === null) return;
      const agent = shown;
      shown = null;
      await deps.scene({ type: 'done', agent });
    };
    let failed = false;
    const fail = (e: unknown): void => {
      failed = true;
      this.paused = true;
      this.emit('error', e instanceof Error ? e.message : String(e));
    };

    if (this.hits.brainId !== brainId) this.hits = { brainId, counts: {} };
    let completed = brain()?.round ?? 0;
    const startRound = completed;
    let finished = false;
    try {
      for (let i = 0; i < rounds && alive(); i++) {
        const before = brain();
        if (!before) break;
        const r = before.round + 1;
        const agent = agentForRound(r - 1);
        const target = pickTarget(agent, before.nodes, this.hits.counts, rand);
        if (!target) break;
        this.hits.counts[target.id] = (this.hits.counts[target.id] ?? 0) + 1;
        const idea = { title: before.title, summary: before.summary };

        this.emit('phase', 'plan', agent.id, target.name);
        this.emit('status', `${agent.name} is eyeing ${target.name}`);
        shown = agent.id;
        await deps.scene({ type: 'plan', agent: agent.id, target: target.id });
        await deps.scene({ type: 'travel', agent: agent.id, path: pathTo(before.nodes, target.id) });
        if (!alive()) break;

        this.emit('phase', 'diverge', agent.id, target.name);
        this.emit('status', `${agent.name} is sprouting ideas on ${target.name}`);
        think(agent.id, target.id, 'sprouting ideas on');
        const [reply] = await Promise.all([
          deps.api.agentRound({ agent: agent.id, idea, mapLines: mapLines(before.nodes), links: before.links, target, nodes: before.nodes }),
          sleep(THINK_MS),
        ]);
        meta(reply.meta);
        if (!alive()) break;

        const children = makeKids(target, reply.data.children, agent, deps.ink(), now().toString(36));
        const links = this.validLinks(before.nodes.concat(children), before.links, reply.data.links, target.id, agent.id);
        const entry: Omit<LogEntry, 'seq'> = { agent: agent.id, text: reply.data.thought, node: target.id, tag: `R${r} · +${children.length}` };

        // Spawn first so the children burst from the agent, then prepare each arc before it exists in the brain.
        await deps.scene({ type: 'spawn', agent: agent.id, target: target.id });
        for (const l of links) {
          if (brain() === null) break;
          await deps.scene({ type: 'prepareLink', agent: agent.id, a: l.a, b: l.b });
        }
        // applyRound patches whichever brain the store holds, so never call it after a switch (a pause alone still persists).
        if (brain() === null) break;
        await deps.sync.applyRound({ round: r, nodes: children, links, log: entry });
        if (deps.syncFailed()) throw new Error('Round not saved');
        completed = r;

        const names = new Map((brain()?.nodes ?? before.nodes.concat(children)).map((n) => [n.id, n.name]));
        let at = target.id;
        for (const l of links) {
          if (brain() === null) break;
          if (l.a !== at) await deps.scene({ type: 'travel', agent: agent.id, path: [at, l.a] });
          at = l.a;
          this.emit('phase', 'connect', agent.id, target.name);
          this.emit('status', `${agent.name} is linking ${names.get(l.a)} to ${names.get(l.b)}`);
          await deps.scene({ type: 'link', agent: agent.id, a: l.a, b: l.b });
          at = l.b;
        }
        if (brain() !== null) {
          this.emit('log', { ...entry, seq: 0 });
          this.emit('round', r);
        }
        await leave();
      }

      if (alive() && completed - startRound >= rounds) {
        const b = brain();
        if (b && (await this.takeaway(b, ctx))) {
          await leave();
          finished = true;
        }
      }
    } catch (e) {
      fail(e);
    } finally {
      try {
        await leave();
      } catch {
        // the scene is gone; nothing left to hide
      }
    }

    if (finished) {
      this.emit('status', `Done · ${rounds} rounds`);
      this.emit('finished');
    } else if (!failed) {
      this.emit('status', this.paused && brain() !== null && completed > startRound ? `Paused after round ${completed}` : '');
    }
  }

  private validLinks(nodes: IdeaNode[], existing: CrossLink[], proposed: { a: string; b: string; why: string }[], targetId: string, by: AgentId): CrossLink[] {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const branchOf = (id: string): string | undefined => {
      let n = byId.get(id);
      while (n && n.depth > 1) n = n.parent ? byId.get(n.parent) : undefined;
      return n?.id;
    };
    const have = new Set(existing.map((l) => [l.a, l.b].sort().join('~')));
    const out: CrossLink[] = [];
    for (const l of proposed) {
      if (!l || !byId.has(l.a) || !byId.has(l.b) || l.a === l.b || branchOf(l.a) === branchOf(l.b)) continue;
      const key = [l.a, l.b].sort().join('~');
      if (have.has(key)) continue;
      have.add(key);
      // The agent stands at the target, so the arc leaves from it.
      out.push(l.b === targetId ? { a: l.b, b: l.a, why: l.why, by } : { a: l.a, b: l.b, why: l.why, by });
    }
    return out;
  }

  /** Strategist step. Resolves true when the takeaway was written, false when the run stopped first. */
  private async takeaway(b: Brain, { brain, alive, think, meta, sleep, show }: Ctx): Promise<boolean> {
    const { deps } = this;
    this.emit('phase', 'takeaway', 'strategist', b.title);
    this.emit('status', 'Strategist is writing the key takeaway…');
    show('strategist');
    await deps.scene({ type: 'plan', agent: 'strategist', target: 'n0' });
    think('strategist', 'n0', 'pondering');
    const [reply] = await Promise.all([
      deps.api.takeaway({ idea: { title: b.title, summary: b.summary }, mapLines: mapLines(b.nodes), links: b.links, nodes: b.nodes }),
      sleep(THINK_MS),
    ]);
    meta(reply.meta);
    const now = brain();
    if (!now || !alive()) return false;

    let leaf = now.nodes.find((n) => n.id === reply.data.leaf);
    if (!leaf) {
      const linked = new Set(now.links.flatMap((l) => [l.a, l.b]));
      const score = (n: IdeaNode): number => n.depth + (linked.has(n.id) ? 1.5 : 0) + (n.kind === 'Next step' ? 0.5 : 0);
      leaf = now.nodes.reduce((best, n) => (score(n) > score(best) ? n : best), now.nodes[0]);
    }
    const synth: Takeaway = { path: pathTo(now.nodes, leaf.id), verdict: reply.data.verdict, brief: reply.data.brief };
    const entry: Omit<LogEntry, 'seq'> = { agent: 'strategist', text: synth.verdict, node: leaf.id, tag: 'Takeaway' };
    await deps.sync.setTakeaway(synth, entry);
    if (deps.syncFailed()) throw new Error('Takeaway not saved');
    this.emit('log', { ...entry, seq: 0 });
    return true;
  }
}
