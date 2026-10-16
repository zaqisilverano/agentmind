import type { AgentId, CrossLink, IdeaNode, MapReply } from '@/engine/types';
import type { AgentRoundReplyOut, ExpandReplyOut, TakeawayReplyOut } from './schemas';

const STOP = new Set('that this with from into have will your their about which where when what there they them would could should make like want just more than also some been very app idea for and the are can our out use who how'.split(' '));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Offline replacement for the map call: schema-valid output built from the idea's own words.
function map(text: string): MapReply {
  const words = [...new Set((text.toLowerCase().match(/[a-zà-ÿ]{4,}/g) || []).filter(w => !STOP.has(w)))];
  const kw = (i: number) => (words.length ? cap(words[i % words.length]) : '');
  const title = words.slice(0, 3).map(cap).join(' ') || 'Untitled Idea';
  const t = (kind: string, name: string, note: string, kids: string[]) => ({ name, kind, note, children: kids.filter(Boolean).map(n => ({ name: n, note: '' })) });
  return {
    title,
    summary: text.trim().slice(0, 400),
    branches: [
      t('Problem', 'What hurts today', 'The friction this idea removes.', [kw(0) && kw(0) + ' friction', 'Status quo cost', 'Who complains']),
      t('People', 'Who it serves', 'The first group that would care.', ['Early adopters', kw(1) && kw(1) + ' users', 'Skeptics']),
      t('Mechanism', 'How it works', 'The core loop behind ' + title + '.', [kw(2) && kw(2) + ' engine', 'Input', 'Output']),
      t('Value', 'Why it matters', 'What gets better if it works.', ['Time saved', 'Money saved', kw(3)]),
      t('Risk', 'What could break', 'Assumptions that need testing.', ['Adoption', 'Cost to run', 'Copycats']),
      t('Next step', 'First move', 'The smallest test worth running.', ['Sketch it', 'Talk to 5 people', 'Prototype']),
    ],
  };
}

function expand(path: string[], question?: string): ExpandReplyOut {
  const children = [
    { name: 'Who it helps', note: 'The people who feel this most.' },
    { name: 'How it starts', note: 'The smallest first version.' },
    { name: 'What it costs', note: 'What it takes to run it.' },
  ];
  if (question) children.push({ name: 'Answer: ' + question.slice(0, 40), note: 'Grown from the question asked on ' + path[path.length - 1] });
  return { children };
}

const F: Record<AgentId, [string, string][]> = {
  researcher: [['Who feels it most', 'The group with the sharpest version of this pain.'], ['Evidence to gather', 'What would prove this is real.']],
  builder: [['Core workflow', 'The steps a user goes through.'], ['Running cost', 'What it costs per user to operate.']],
  customer: [['Why I would pay', 'The moment it becomes worth money.'], ['Why I would return', 'The habit it builds.']],
  skeptic: [['Weak assumption', 'The belief this rests on.'], ['Cheap test', 'How to check it this week.']],
  strategist: [['This week', 'The first concrete move.'], ['Success signal', 'How we know it worked.']],
};

const branchOf = (n: IdeaNode, nodes: IdeaNode[]): IdeaNode => {
  let cur = n;
  while (cur.depth > 1 && cur.parent) {
    const p = nodes.find(x => x.id === cur.parent);
    if (!p) break;
    cur = p;
  }
  return cur;
};

// Deterministic port of the prototype's fallbackRound: the link target is picked by map size, not randomly.
function agentRound(agent: AgentId, target: IdeaNode, nodes: IdeaNode[]): AgentRoundReplyOut {
  const own = branchOf(target, nodes).id;
  const others = nodes.filter(n => n.depth >= 1 && n.id !== target.id && n.parent !== target.id && branchOf(n, nodes).id !== own);
  const other = others.length ? others[nodes.length % others.length] : undefined;
  return {
    thought: 'I expanded ' + target.name + '.',
    children: F[agent].map(([name, note]) => ({ name, note })),
    links: other ? [{ a: target.id, b: other.id, why: 'Possible connection' }] : [],
  };
}

const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + '.');

function takeaway(nodes: IdeaNode[], links: CrossLink[]): TakeawayReplyOut {
  const linked = new Set(links.flatMap(l => [l.a, l.b]));
  const score = (n: IdeaNode) => n.depth + (linked.has(n.id) ? 1.5 : 0) + (n.kind === 'Next step' ? 0.5 : 0);
  const leaf = nodes.reduce((best, n) => (score(n) > score(best) ? n : best), nodes[0]);
  const branch = branchOf(leaf, nodes);
  return {
    leaf: leaf.id,
    verdict: `Pursue ${leaf.name}.`,
    brief: [
      `${branch.name} is the strongest thread because it is the most developed.`,
      `The biggest risk is that ${sentence(branch.note || 'it does not survive contact with users')}`,
      `The first move is to test ${leaf.name} with five people this week.`,
    ].join(' '),
  };
}

export const fallback = { map, expand, agentRound, takeaway };
