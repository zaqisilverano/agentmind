'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import type { AgentId, Brain, CrossLink, IdeaNode } from '@/engine/types';
import { apiClient, type ApiClient, type LlmResult } from '@/lib/apiClient';
import { configureController, type ControllerApi } from '@/lib/controller';
import { fallback } from '@/lib/llm/fallback';
import type { MapReplyOut } from '@/lib/llm/schemas';
import { sampleBrain } from '@/lib/sample/toolLibrary';
import { useStore } from '@/lib/store';
import { configureSync } from '@/lib/sync';

const NOW = '2026-10-16T00:00:00.000Z';
const BY: Record<string, AgentId> = { b0c0: 'researcher', b1c1: 'researcher', b2c1: 'builder', b3c0: 'customer', b4c0: 'skeptic', b4c1: 'skeptic' };

function fixture(id: string, number: number, title?: string): Brain {
  const { title: sampleTitle, summary, nodes } = sampleBrain('#1B1A17');
  return {
    id,
    number,
    title: title ?? sampleTitle,
    summary,
    round: 4,
    synth: {
      path: ['n0', 'b2', 'b2c1'],
      verdict: 'Start with a deposit-backed lending shelf in one community center.',
      brief: 'Renters need occasional tools, not ownership. A deposit system keeps losses low without insurance. Fifty tools and one partner library are enough to test demand.',
    },
    nodes: nodes.map(n => (BY[n.id] ? { ...n, by: BY[n.id] } : n)),
    links: [{ a: 'b2c1', b: 'b4c1', why: 'Deposits double as condition checks.', by: 'builder' }],
    log: [
      { seq: 1, agent: 'researcher', text: 'Renters keep telling me storage is the real pain.', node: 'b1c1', tag: 'R1 · +1' },
      { seq: 2, agent: 'builder', text: 'A refundable deposit covers most damage.', node: 'b2c1', tag: 'R2 · +1' },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const BRAINS: Record<string, Brain> = {
  'dev-1': fixture('dev-1', 1),
  'dev-2': { ...fixture('dev-2', 2, 'Night Market'), synth: null },
};

declare global { interface Window { __store?: typeof useStore } }

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const LATENCY = 150;
const THINK = 400;
const FALLBACK = { source: 'fallback' as const, attempts: 0 };

/** Brain writes "succeed" after a short delay and answer with the store's copy, which sync already updated. */
async function echo(): Promise<Brain> {
  await wait(LATENCY);
  const b = structuredClone(useStore.getState().brain as Brain);
  BRAINS[b.id] = b;
  return b;
}

const llm = async <T,>(data: T): Promise<LlmResult<T>> => {
  await wait(THINK);
  return { data, meta: FALLBACK };
};

/** No database here: brain routes are echoed locally and the LLM routes run the offline fallback in the browser. */
const syncApi: ApiClient = {
  ...apiClient,
  getBrain: async (id: string) => { await wait(LATENCY); return structuredClone(BRAINS[id]); },
  createBrain: async (body) => {
    await wait(LATENCY);
    const number = Object.keys(BRAINS).length + 1;
    const now = new Date().toISOString();
    const brain: Brain = { id: `dev-${number}`, number, title: body.title, summary: body.summary ?? '', round: 0, synth: null, nodes: body.nodes as IdeaNode[], links: (body.links ?? []) as CrossLink[], log: [], createdAt: now, updatedAt: now };
    BRAINS[brain.id] = brain;
    return structuredClone(brain);
  },
  deleteBrain: async (id: string) => { await wait(LATENCY); delete BRAINS[id]; return { ok: true as const }; },
  patchBrain: echo, addNodes: echo, patchNode: echo, deleteNode: echo, addLinks: echo, applyRound: echo, setTakeaway: echo,
};

const controllerApi: ControllerApi = {
  me: async () => ({
    user: { id: '7f3c9a12-4b5e-4d6f-8a90-1b2c3d4e5f60' },
    brains: Object.values(BRAINS).map(b => ({ id: b.id, number: b.number, title: b.title, nodeCount: b.nodes.length, updatedAt: b.updatedAt })),
  }),
  llm: {
    map: (body) => llm(fallback.map(body.idea) as MapReplyOut),
    expand: (body) => llm(fallback.expand(body.path, body.question)),
    agentRound: (body) => llm(fallback.agentRound(body.agent, body.target as IdeaNode, body.nodes as IdeaNode[])),
    takeaway: (body) => llm(fallback.takeaway(body.nodes as IdeaNode[], body.links as CrossLink[])),
  },
};

/** Stubs the network, then renders the real shell; AppController loads the fixture user and opens the first brain. */
export function PanelsDev() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    configureSync({ api: syncApi });
    configureController({ api: controllerApi });
    window.__store = useStore;
    setReady(true);
    return () => {
      configureSync();
      configureController();
      delete window.__store;
    };
  }, []);

  return ready ? <AppShell /> : null;
}
