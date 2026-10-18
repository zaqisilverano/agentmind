import type { CrossLink, IdeaNode } from '@/engine/types';

interface IdeaRef { title: string; summary: string }

/** One line per node: `id | name | kind | parent <id|->`. */
export const mapLines = (nodes: IdeaNode[]): string =>
  nodes.map(n => `${n.id} | ${n.name} | ${n.kind} | parent ${n.parent || '-'}`).join('\n');

/** Longest focus note, after cleaning. */
export const FOCUS_MAX = 300;

/**
 * The user's focus note as one safe prompt line: control characters (newlines and tabs included) become spaces,
 * whitespace collapses to single spaces, then it is trimmed and capped at FOCUS_MAX. Empty becomes undefined.
 */
export const cleanFocus = (focus: string | undefined): string | undefined =>
  focus?.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FOCUS_MAX).trim() || undefined;

export const PROMPTS = {
  map: {
    system: 'You are a cartographer of ideas. You break an idea into a clear map. Reply with JSON only.',
    user: (idea: string): string =>
      `Map this idea: "${idea}"\nReturn JSON: {"title": "2-4 word name", "summary": "one plain sentence", "branches": [{"name": "2-4 words", "kind": "Problem|People|Mechanism|Value|Risk|Next step", "note": "one sentence", "children": [{"name": "1-4 words", "note": "one sentence"}]}]}. Give 5-6 branches, use each kind at most once, 2-4 children each.`,
  },
  expand: {
    system: 'You expand one node of an idea map. Reply with JSON only.',
    user: (a: { title: string; summary: string; path: string[]; note?: string; existing: string[]; question?: string }): string =>
      `Idea: ${a.title} — ${a.summary}\nNode: ${a.path.join(' > ')}${a.note ? ` (${a.note})` : ''}\nExisting children: ${a.existing.join(', ')}${a.question ? `\nThe user asks: "${a.question}". Answer by growing this node.` : ''}\nReturn {"children":[{"name":"1-4 words","note":"one sentence"}]} with 3-4 new, specific sub-ideas.`,
  },
  agentRound: {
    system: (agent: { name: string; brief: string }): string =>
      `You are the ${agent.name} agent on a brainstorming team. ${agent.brief} Reply with JSON only.`,
    user: (a: { idea: IdeaRef; mapLines: string; links: CrossLink[]; target: IdeaNode; critic?: boolean; focus?: string }): string => {
      const focus = cleanFocus(a.focus);
      return `Idea: ${a.idea.title} — ${a.idea.summary}\nMap (id | name | kind | parent):\n${a.mapLines}\nExisting cross-links: ${a.links.map(l => `${l.a}~${l.b}`).join(', ') || 'none'}\n\nYour target node: ${a.target.id} (${a.target.name})${a.target.note ? ` — ${a.target.note}` : ''}${focus ? `\nThe user wants you to focus on: ${focus}` : ''}\nReturn {"thought":"one sentence, first person, what you noticed","children":[{"name":"1-4 words","note":"one sentence"}],"links":[{"a":"node id","b":"node id","why":"under 10 words"}]}. Give 2-3 new children for the target that are not already on the map${a.critic ? ', framed as critiques or risks of the target' : ''}. Give 0-1 links from the target to a node in a different branch, only when the connection is real.`;
    },
  },
  takeaway: {
    system: 'You are the Strategist agent. You converge a brainstorm into one clear direction. Reply with JSON only.',
    user: (a: { idea: IdeaRef; mapLines: string; links: CrossLink[] }): string =>
      `Idea: ${a.idea.title} — ${a.idea.summary}\nMap (id | name | kind | parent):\n${a.mapLines}\nCross-links:\n${a.links.map(l => `${l.a} ~ ${l.b}: ${l.why}`).join('\n') || 'none'}\n\nPick the single strongest node to pursue (prefer a deep, well-supported leaf). Return {"leaf":"node id","verdict":"one sentence direction","brief":"three sentences: why this path, the biggest risk, the first move"}.`,
  },
};
