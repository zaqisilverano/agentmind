import { KINDS, KIND_COLORS, type IdeaNode, type MapReply } from '@/engine/types';

type BranchKind = (typeof KINDS)[number];

const isBranchKind = (k: string): k is BranchKind => (KINDS as readonly string[]).includes(k);

export function fromBranches(o: MapReply, ink: string): { title: string; summary: string; nodes: IdeaNode[] } {
  const nodes: IdeaNode[] = [
    { id: 'n0', name: o.title || 'Untitled', note: o.summary || '', userNote: '', kind: 'Core', parent: null, depth: 0, color: ink, by: null, critic: false, position: 0 },
  ];
  (o.branches || []).slice(0, 7).forEach((b, i) => {
    const kind: BranchKind = isBranchKind(b.kind) ? b.kind : KINDS[i % KINDS.length];
    const id = 'b' + i;
    nodes.push({ id, name: b.name, note: b.note || '', userNote: '', kind, parent: 'n0', depth: 1, color: KIND_COLORS[kind], by: null, critic: false, position: i });
    (b.children || []).slice(0, 5).forEach((c, j) =>
      nodes.push({ id: id + 'c' + j, name: c.name, note: c.note || '', userNote: '', kind, parent: id, depth: 2, color: KIND_COLORS[kind], by: null, critic: false, position: j }),
    );
  });
  return { title: o.title, summary: o.summary, nodes };
}

export const childId = (parentId: string, k: number, stamp: string = Date.now().toString(36)): string => `${parentId}x${stamp}${k}`;
