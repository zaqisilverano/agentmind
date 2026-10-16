import type { Agent } from '@/lib/agents/roster';

export interface AgentIconProps {
  agent: Pick<Agent, 'color' | 'icon' | 'eyes' | 'eyeFill' | 'pupils'>;
  /** Rendered width in px; height keeps the 18×16 ratio. */
  size?: number;
}

/**
 * The agent's flat shape with its eyes, as an 18×16 SVG. The body carries a same-colour stroke
 * (as in the prototype) so thin shapes read at small sizes; there is no contrasting outline.
 */
export function AgentIcon({ agent, size = 18 }: AgentIconProps) {
  return (
    <svg width={size} height={(size * 16) / 18} viewBox="0 0 18 16" aria-hidden="true" className="flex-none overflow-visible">
      <path d={agent.icon} fill={agent.color} stroke={agent.color} strokeWidth={1.4} strokeLinejoin="round" />
      {agent.eyes && <path d={agent.eyes} fill={agent.eyeFill} />}
      {agent.pupils && <path d={agent.pupils} fill="#1B1A17" />}
    </svg>
  );
}
