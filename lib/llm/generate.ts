import type { ZodType } from 'zod';
import { getEnv } from '@/lib/env';
import { extractJson } from './extractJson';
import { chat, ProviderError, type ChatDeps } from './provider';

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

/** Client-safe description of a failure. Detail stays in the server log. */
function publicError(e: unknown): string {
  if (e instanceof ProviderError) return `provider ${e.status}`;
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return 'timeout';
  return 'provider error';
}

/**
 * Model call, validated with `schema`, retried once with the errors, then the local fallback.
 * Never throws because of the model. A throwing `fallback` is a programming error: it is
 * called exactly once and surfaces as `Error('fallback failed: ...')`, the only throw path.
 * `meta.error` is safe to send to the browser; full detail goes to console.error.
 */
export async function generate<T>(
  schema: ZodType<T>,
  system: string,
  user: string,
  fallback: () => T,
  deps: ChatDeps = {},
): Promise<{ data: T; meta: GenerateMeta }> {
  let attempts = 0;
  const attempt = async (): Promise<{ data: T; meta: GenerateMeta } | { error: string }> => {
    try {
      const env = deps.env ?? getEnv();
      if (!env.LLM_API_KEY) return { error: 'no LLM_API_KEY' };
      const chatDeps = { fetch: deps.fetch, env };
      let message = user;
      let total = 0;
      for (let i = 0; i < 2; i++) {
        attempts += 1;
        const { text, ms, model } = await chat({ system, user: message }, chatDeps);
        total += ms;
        const p = parse(schema, text);
        if (p.ok) return { data: p.data, meta: { source: 'model', model, ms: total, attempts } };
        console.error(`[llm] invalid output (attempt ${attempts}): ${p.issues}`);
        message = `${user}\n\nYour previous output was invalid: ${p.issues}\nReturn corrected JSON only.`;
      }
      return { error: 'invalid output' };
    } catch (e) {
      console.error('[llm] call failed:', e instanceof Error ? e.message : e);
      return { error: publicError(e) };
    }
  };

  const out = await attempt();
  if ('meta' in out) return out;
  try {
    return { data: fallback(), meta: { source: 'fallback', attempts, error: out.error } };
  } catch (e) {
    throw new Error(`fallback failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
