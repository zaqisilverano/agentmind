// Usage: pnpm eval   (reads .env when present; without LLM_API_KEY every call reports "fallback")
import { z } from 'zod';
import prompts from './eval-prompts.json';
import { AGENTS } from '@/lib/agents/roster';
import { loadEnv } from '@/lib/env';
import { fallback } from '@/lib/llm/fallback';
import { generate, type GenerateMeta } from '@/lib/llm/generate';
import { mapLines, PROMPTS } from '@/lib/llm/prompts';
import { AgentRoundReplySchema, ExpandReplySchema, MapReplySchema, TakeawayReplySchema } from '@/lib/llm/schemas';
import { fromBranches } from '@/lib/ids';

// The eval only needs the LLM settings; the DB and cookie values are placeholders so the shared env schema validates.
const env = loadEnv({ DATABASE_URL: 'unused', COOKIE_SECRET: 'x'.repeat(32), ...process.env });
const gen = <T>(schema: z.ZodType<T>, system: string, user: string, fb: () => T) => generate(schema, system, user, fb, { env });

const results: { label: string; meta: GenerateMeta }[] = [];
const record = (label: string, meta: GenerateMeta) => {
  results.push({ label, meta });
  const detail = `${meta.source.padEnd(8)} attempts=${meta.attempts} ${meta.ms ?? '-'}ms${meta.error ? `  (${meta.error.slice(0, 100)})` : ''}`;
  console.log(`${label.padEnd(42)} ${detail}`);
};

async function main() {
  for (const idea of prompts as string[]) {
    const { meta } = await gen(MapReplySchema, PROMPTS.map.system, PROMPTS.map.user(idea), () => fallback.map(idea));
    record(`map: ${idea.slice(0, 34)}`, meta);
  }

  const first = (prompts as string[])[0];
  const { title, summary, nodes } = fromBranches(fallback.map(first), '#111111');
  const target = nodes.find((n) => n.id === 'b0')!;
  const researcher = AGENTS.find((a) => a.id === 'researcher')!;
  const lines = mapLines(nodes);

  record(
    'expand: b0',
    (await gen(ExpandReplySchema, PROMPTS.expand.system, PROMPTS.expand.user({ title, summary, path: [title, target.name], existing: nodes.filter((n) => n.parent === 'b0').map((n) => n.name) }), () => fallback.expand([title, target.name]))).meta,
  );
  record(
    'agent-round: researcher on b0',
    (await gen(AgentRoundReplySchema, PROMPTS.agentRound.system(researcher), PROMPTS.agentRound.user({ idea: { title, summary }, mapLines: lines, links: [], target, critic: researcher.critic }), () => fallback.agentRound('researcher', target, nodes))).meta,
  );
  const takeaway = await gen(
    TakeawayReplySchema.refine((t) => nodes.some((n) => n.id === t.leaf), { message: 'leaf must be an existing node id' }) as z.ZodType<z.infer<typeof TakeawayReplySchema>>,
    PROMPTS.takeaway.system,
    PROMPTS.takeaway.user({ idea: { title, summary }, mapLines: lines, links: [] }),
    () => fallback.takeaway(nodes, []),
  );
  record('takeaway', takeaway.meta);

  const modelCalls = results.filter((r) => r.meta.source === 'model');
  const retried = results.filter((r) => r.meta.attempts > 1).length;
  const timed = results.filter((r) => r.meta.ms !== undefined);
  const avg = timed.length ? Math.round(timed.reduce((s, r) => s + (r.meta.ms ?? 0), 0) / timed.length) : 0;
  console.log(`\ncalls=${results.length} pass=${modelCalls.length}/${results.length} (${Math.round((100 * modelCalls.length) / results.length)}%) retried=${retried} avg=${avg}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
