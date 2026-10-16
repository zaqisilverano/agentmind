'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import type { AgentId, Brain } from '@/engine/types';
import { apiClient } from '@/lib/apiClient';
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

/** Hydrates the store with fixture brains (no network for brain switching) and renders the real shell. */
export function PanelsDev() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    configureSync({ api: { ...apiClient, getBrain: async (id: string) => structuredClone(BRAINS[id]) } });
    const store = useStore.getState();
    store.hydrate({
      user: { id: '7f3c9a12-4b5e-4d6f-8a90-1b2c3d4e5f60' },
      brains: Object.values(BRAINS).map(b => ({ id: b.id, number: b.number, title: b.title, nodeCount: b.nodes.length, updatedAt: b.updatedAt })),
    });
    store.openBrain(structuredClone(BRAINS['dev-1']));
    window.__store = useStore;
    setReady(true);
    return () => {
      configureSync();
      delete window.__store;
    };
  }, []);

  return ready ? <AppShell /> : null;
}
