import type { Brain } from '@/engine/types';
import { sampleBrain } from '@/lib/sample/toolLibrary';

export function fixtureBrain(): Brain {
  const { title, summary, nodes } = sampleBrain('#111');
  return {
    id: 'fixture',
    number: 1,
    title,
    summary,
    round: 1,
    synth: { path: ['n0', 'b2', 'b2c1'], verdict: 'Pursue Deposit system.', brief: 'One. Two. Three.' },
    nodes: [
      ...nodes,
      { id: 'b0c0xzz0', name: 'Shared garage', note: 'A neighbour hosts the tools.', userNote: 'keep', kind: 'Problem', parent: 'b0c0', depth: 3, color: '#E0482B', by: 'builder', critic: false, position: 0 },
    ],
    links: [{ a: 'b0c0', b: 'b2c1', why: 'w', by: 'builder' }],
    log: [{ seq: 1, agent: 'builder', text: 't', node: 'b0c0', tag: 'R1 · +1' }],
    createdAt: '2026-10-16T00:00:00.000Z',
    updatedAt: '2026-10-16T00:00:00.000Z',
  };
}
