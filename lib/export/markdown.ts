import type { Brain, IdeaNode } from '@/engine/types';

export interface TreeNode { name: string; kind: string; note: string; myNote: string; children: TreeNode[]; }
export interface Tree {
  title: string;
  summary: string;
  branches: TreeNode[];
  links: { from: string; to: string; why: string; by: string }[];
  synthesis: { verdict: string; brief: string; path: string[] } | null;
}

export function toTree(brain: Brain): Tree {
  const { nodes } = brain;
  const byId = new Map<string, IdeaNode>(nodes.map(n => [n.id, n]));
  const nm = (id: string) => byId.get(id)?.name ?? '';
  const build = (n: IdeaNode): TreeNode => ({ name: n.name, kind: n.kind, note: n.note || '', myNote: n.userNote || '', children: nodes.filter(c => c.parent === n.id).map(build) });
  const root = nodes.find(n => n.depth === 0);
  return {
    title: brain.title,
    summary: brain.summary,
    branches: root ? build(root).children : [],
    links: brain.links.map(l => ({ from: nm(l.a), to: nm(l.b), why: l.why, by: l.by })),
    synthesis: brain.synth ? { verdict: brain.synth.verdict, brief: brain.synth.brief, path: brain.synth.path.map(nm).filter(Boolean) } : null,
  };
}

export function toMarkdown(brain: Brain): string {
  const t = toTree(brain);
  const out: string[] = ['# ' + t.title, '', t.summary || '', ''];
  const oneLine = (s: string) => s.split(/\r?\n/).join(' ');
  const walk = (n: TreeNode, lvl: number) => {
    const pad = '  '.repeat(lvl);
    if (lvl === 0) {
      out.push('## ' + n.name + ' (' + n.kind + ')');
      if (n.note) out.push('', oneLine(n.note));
      out.push('');
    } else out.push(pad + '- **' + n.name + '**' + (n.note ? ' — ' + oneLine(n.note) : ''));
    if (n.myNote) out.push(pad + '  > My note: ' + oneLine(n.myNote));
    n.children.forEach(c => walk(c, lvl + 1));
    if (lvl === 0) out.push('');
  };
  t.branches.forEach(b => walk(b, 0));
  if (t.synthesis) out.push('## Key takeaway', '', '**' + t.synthesis.verdict + '**', '', t.synthesis.brief, '', 'Strongest path: ' + t.synthesis.path.join(' → '), '');
  if (t.links.length) {
    out.push('## Cross-links', '');
    t.links.forEach(l => out.push('- ' + l.from + ' → ' + l.to + (l.why ? ' (' + l.why + ')' : '')));
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
