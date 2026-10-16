import { getEnv, type Env } from '@/lib/env';

export type LlmEnv = Pick<Env, 'LLM_API_KEY' | 'LLM_BASE_URL' | 'LLM_MODEL' | 'LLM_REASONING_EFFORT'>;
export interface ChatDeps { fetch?: typeof fetch; env?: LlmEnv }

export class ProviderError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`provider returned ${status}: ${body}`);
    this.name = 'ProviderError';
  }
}

const TIMEOUT_MS = 60_000;

/** One chat completion against an OpenAI-compatible endpoint. Throws ProviderError on non-2xx. */
export async function chat(input: { system: string; user: string }, deps: ChatDeps = {}): Promise<{ text: string; ms: number; model: string }> {
  const env = deps.env ?? getEnv();
  const doFetch = deps.fetch ?? fetch;
  const started = Date.now();
  const res = await doFetch(`${env.LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_API_KEY}` },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      ...(env.LLM_REASONING_EFFORT ? { chat_template_kwargs: { reasoning_effort: env.LLM_REASONING_EFFORT } } : {}),
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new ProviderError(res.status, (await res.text()).slice(0, 300));
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return { text: data.choices?.[0]?.message?.content ?? '', ms: Date.now() - started, model: env.LLM_MODEL };
}
