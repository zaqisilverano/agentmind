'use client';

import { useState } from 'react';
import type { IdeaNode } from '@/engine/types';
import { pathNames } from '@/lib/grow';
import { expandWithAgents } from '@/lib/run';
import { useStore } from '@/lib/store';
import { deleteSubtree, editNode, renameBrain } from '@/lib/sync';
import { Pill } from '@/components/ui/Pill';
import { Textarea } from '@/components/ui/Textarea';
import { TwoStepDelete } from '@/components/ui/TwoStepDelete';
import { MyNotes } from './MyNotes';

const SMALL_BTN = 'cursor-pointer border border-ink font-mono uppercase leading-[normal]';

/** "Core idea", or "Problem · level 1 · by researcher": the node card's header line. */
export const nodeKindLabel = (node: IdeaNode): string =>
  node.depth === 0 ? 'Core idea' : `${node.kind} · level ${node.depth}${node.by ? ` · by ${node.by}` : ''}`;

/** The node's colour dot for the card header. */
export const NodeDot = ({ color }: { color: string }) => (
  <span className="h-[10px] w-[10px] flex-none rounded-full border border-ink" style={{ background: color }} />
);

/**
 * The node card below its header: path, name with Edit, AI note, My notes, child chips and cross-links in a scrolling
 * area, then Expand with agents → (a scoped agent run on this node) and a two-step Delete (not on the core). Shared by the desktop card and the mobile
 * node sheet. Key it by the node id so switching nodes resets the edit form and saves the note.
 */
export function NodeCardBody({ id }: { id: string }) {
  const brainId = useStore(s => s.brain?.id ?? '');
  const nodes = useStore(s => s.brain?.nodes);
  const links = useStore(s => s.brain?.links);
  const busy = useStore(s => s.ui.busy);
  const running = useStore(s => s.run.active || s.run.phase !== null);
  const select = useStore(s => s.select);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const node = nodes?.find(n => n.id === id);
  if (!nodes || !node) return null;

  const byId = new Map(nodes.map(n => [n.id, n]));
  const path = pathNames(nodes, id).slice(0, -1).join(' / ') || 'Origin';
  const children = nodes.filter(n => n.parent === id);
  const crossLinks = (links ?? []).flatMap(l => {
    const other = l.a === id ? l.b : l.b === id ? l.a : null;
    const o = other ? byId.get(other) : undefined;
    return o ? [{ key: `${l.a}~${l.b}`, node: o, why: l.why }] : [];
  });

  const startEdit = () => {
    setName(node.name);
    setDesc(node.note);
    setEditing(true);
  };
  const saveEdit = () => {
    const nextName = name.trim().slice(0, 60);
    const nextNote = desc.trim().slice(0, 300);
    if (nextName && (nextName !== node.name || nextNote !== node.note)) {
      void editNode(id, { name: nextName, note: nextNote });
      if (id === 'n0' && nextName !== node.name) void renameBrain(nextName);
    }
    setEditing(false);
  };
  const remove = () => {
    const parent = node.parent;
    void deleteSubtree(id);
    // As in the prototype: stay on the parent branch, but not on the core.
    select(parent && parent !== 'n0' ? parent : null);
  };

  return (
    <>
      <div className="flex min-h-0 flex-col gap-[10px] overflow-y-auto px-4 pt-4 pb-[18px]">
        <div className="text-[10px] tracking-[0.06em] text-muted">{path}</div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              value={name}
              maxLength={60}
              aria-label="Name"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEdit();
                // Handled here: a surrounding sheet must not also close on this Esc.
                if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
              }}
              className="box-border w-full border border-ink bg-bg px-2 py-1.5 font-serif text-[24px] text-ink focus:outline-none"
            />
            <Textarea variant="serif" value={desc} maxLength={300} aria-label="Description" onChange={e => setDesc(e.target.value)} />
            <div className="flex gap-1.5">
              <button type="button" onClick={saveEdit} className={`${SMALL_BTN} flex-1 bg-ink p-[7px] text-[10px] tracking-[0.12em] text-panel`}>Save</button>
              <button type="button" onClick={() => setEditing(false)} className={`${SMALL_BTN} flex-1 bg-panel p-[7px] text-[10px] tracking-[0.12em] text-ink`}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 font-serif text-[32px] leading-none">{node.name}</div>
              <button type="button" onClick={startEdit} className={`${SMALL_BTN} mt-1 flex-none bg-bg px-[7px] py-1 text-[9.5px] tracking-[0.12em] text-ink hover:bg-ink hover:text-panel`}>Edit</button>
            </div>
            <div className="font-serif text-[17px] leading-[1.35] text-pretty text-soft">{node.note || '—'}</div>
          </>
        )}
        <MyNotes nodeId={id} brainId={brainId} value={node.userNote} />
        {children.length > 0 && (
          <div data-testid="node-children" className="mt-1 flex flex-wrap gap-1.5">
            {children.map(c => <Pill key={c.id} onClick={() => select(c.id)}>{c.name}</Pill>)}
          </div>
        )}
        {crossLinks.length > 0 && (
          <div className="mt-1 flex flex-col gap-1.5 border-t border-dashed border-rule pt-[10px]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Cross-links</div>
            {crossLinks.map(x => (
              <button key={x.key} type="button" onClick={() => select(x.node.id)} className="flex cursor-pointer flex-col gap-0.5 text-left text-ink hover:text-accent">
                <span className="font-mono text-[11px] uppercase leading-[normal] tracking-[0.06em]">↔ {x.node.name}</span>
                {x.why && <span className="font-serif text-[15px] text-soft">{x.why}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-none border-t border-ink">
        <button
          type="button"
          disabled={busy !== null || running}
          title={running ? 'Agents are running' : undefined}
          data-node={id}
          onClick={() => expandWithAgents(id)}
          className="flex-1 cursor-pointer bg-ink px-4 py-[13px] text-left font-mono text-[11px] uppercase leading-[normal] tracking-[0.14em] text-panel hover:bg-accent hover:text-on-accent disabled:cursor-default disabled:bg-ink disabled:text-panel/50"
        >
          {running ? 'Agents running…' : 'Expand with agents →'}
        </button>
        {id !== 'n0' && <TwoStepDelete key={id} title="Delete node and its branches" onConfirm={remove} className="border-l border-ink" />}
      </div>
    </>
  );
}
