'use client';

import { useStore } from '@/lib/store';
import { Panel } from '@/components/ui/Panel';
import { NodeCardBody, NodeDot, nodeKindLabel } from './NodeCardBody';

/**
 * Right-hand card for the selected node: kind and level with ×, then the shared card body (path, name with Edit,
 * AI note, My notes, child chips, cross-links, Expand with agents → and a two-step Delete). Key it by the node id so
 * switching nodes resets the edit form and saves the note.
 */
export function NodeCard({ id }: { id: string }) {
  const node = useStore(s => s.brain?.nodes.find(n => n.id === id));
  const select = useStore(s => s.select);
  if (!node) return null;

  return (
    <Panel data-testid="node-card" className="fixed top-[100px] right-11 z-[3] flex max-h-[calc(100%-254px)] w-[322px] max-w-[calc(100%-88px)] flex-col">
      <div className="flex flex-none items-center gap-[10px] border-b border-ink px-[14px] py-[10px]">
        <NodeDot color={node.color} />
        <span className="flex-1 text-[10.5px] uppercase tracking-[0.16em]">{nodeKindLabel(node)}</span>
        <button type="button" title="Close" aria-label="Close" onClick={() => select(null)} className="cursor-pointer border-none bg-transparent px-0.5 font-mono text-[14px] leading-[normal] text-ink">×</button>
      </div>
      <NodeCardBody id={id} />
    </Panel>
  );
}
