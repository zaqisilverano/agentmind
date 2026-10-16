import type { ZodType } from 'zod';
import { getEnv } from '@/lib/env';
import { extractJson } from './extractJson';
import { chat, type ChatDeps } from './provider';

export interface GenerateMeta { source: 'model' | 'fallback'; model?: string; ms?: number; attempts: number; error?: string }

type Parsed<T> = { ok: true; data: T } | { ok: false; issues: string };

function parse<T>(schema: ZodType<T>, text: string): Parsed<T> {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, issues: e instanceof Error ? e.message : String(e) };
  }
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, issues: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ') };
}

/** Model call, validated with `schema`, retried once with the errors, then the local fallback. Never throws. */
export async function generate<T>(
  schema: ZodType<T>,
  system: string,
  user: string,
  fallback: () => T,
  deps: ChatDeps = {},
): Promise<{ data: T; meta: GenerateMeta }> {
  let attempts = 0;
  try {
    const env = deps.env ?? getEnv();
    if (!env.LLM_API_KEY) return { data: fallback(), meta: { source: 'fallback', attempts, error: 'no LLM_API_KEY' } };
    const chatDeps = { fetch: deps.fetch, env };
    let message = user;
    let lastIssues = '';
    let total = 0;
    for (let i = 0; i < 2; i++) {
      attempts += 1;
      const { text, ms, model } = await chat({ system, user: message }, chatDeps);
      total += ms;
      const p = parse(schema, text);
      if (p.ok) return { data: p.data, meta: { source: 'model', model, ms: total, attempts } };
      lastIssues = p.issues;
      message = `${user}\n\nYour previous output was invalid: ${p.issues}\nReturn corrected JSON only.`;
    }
    return { data: fallback(), meta: { source: 'fallback', attempts, error: lastIssues } };
  } catch (e) {
    return { data: fallback(), meta: { source: 'fallback', attempts, error: e instanceof Error ? e.message : String(e) } };
  }
}
