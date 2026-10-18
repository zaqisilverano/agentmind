import type { z } from 'zod';
import type { Brain, CrossLink, IdeaNode } from '@/engine/types';
import type { AddLinksBody, AddNodesBody, CreateBrainBody, PatchBrainBody, PatchNodeBody, RoundBody, TakeawayBody } from '@/lib/brains/schemas';
import type { AgentRoundBody, MapBody, TakeawayBody as LlmTakeawayBody } from '@/lib/llm/bodies';
import type { AgentRoundReplyOut, MapReplyOut, TakeawayReplyOut } from '@/lib/llm/schemas';

/** A non-2xx response. `message` is the server's `{ error }` text when there is one. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface BrainListRow { id: string; number: number; title: string; nodeCount: number; updatedAt: string }
/** The configured LLM: `configured` is false without an API key (offline fallback); `label` is for display only. */
export interface ProviderInfo { configured: boolean; label: string }
export interface MeResponse { user: { id: string; createdAt?: string }; brains: BrainListRow[]; provider: ProviderInfo }
export interface LlmMeta { source: 'model' | 'fallback'; model?: string; ms?: number; attempts: number; error?: string }
export interface LlmResult<T> { data: T; meta: LlmMeta }

export type CreateBrainRequest = z.input<typeof CreateBrainBody>;
export type PatchBrainRequest = z.input<typeof PatchBrainBody>;
export type PatchNodeRequest = z.input<typeof PatchNodeBody>;
export type RoundRequest = z.input<typeof RoundBody>;
export type TakeawayRequest = z.input<typeof TakeawayBody>;
export type MapRequest = z.input<typeof MapBody>;
export type AgentRoundRequest = z.input<typeof AgentRoundBody>;
export type LlmTakeawayRequest = z.input<typeof LlmTakeawayBody>;
export type AddNodesRequest = z.input<typeof AddNodesBody>;
export type AddLinksRequest = z.input<typeof AddLinksBody>;

interface Config { fetch?: typeof fetch; baseUrl: string }
let config: Config = { baseUrl: '' };

/** Injects `fetch` (tests) and a base URL (server-side use). Omitted fields reset to the default. */
export function configureApiClient(opts: { fetch?: typeof fetch; baseUrl?: string } = {}): void {
  config = { fetch: opts.fetch, baseUrl: opts.baseUrl ?? '' };
}

/** Sends one request and returns the parsed JSON envelope. Network failures surface as the native TypeError. */
async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const doFetch = config.fetch ?? globalThis.fetch;
  const init: RequestInit = { method, credentials: 'same-origin' };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await doFetch(`${config.baseUrl}${path}`, init);
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    parsed = undefined;
  }
  if (!res.ok) {
    const msg = parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string' ? parsed.error : res.statusText || `request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  if (parsed === undefined) throw new ApiError(res.status, 'invalid response body');
  return parsed;
}

/** Brain routes: `{ data }` envelope, unwrapped. */
async function data<T>(method: string, path: string, body?: unknown): Promise<T> {
  return (await request(method, path, body) as { data: T }).data;
}

/** LLM routes: `{ data, meta }` envelope, returned whole. */
async function llm<T>(path: string, body: unknown): Promise<LlmResult<T>> {
  return (await request('POST', path, body)) as LlmResult<T>;
}

const brainPath = (id: string, tail = ''): string => `/api/brains/${encodeURIComponent(id)}${tail}`;

export const apiClient = {
  me: () => data<MeResponse>('GET', '/api/me'),
  restore: (id: string) => data<{ ok: true }>('POST', '/api/me/restore', { id }),
  health: () => request('GET', '/api/health') as Promise<{ ok: boolean; db: boolean }>,
  listBrains: () => data<BrainListRow[]>('GET', '/api/brains'),
  createBrain: (body: CreateBrainRequest) => data<Brain>('POST', '/api/brains', body),
  getBrain: (id: string) => data<Brain>('GET', brainPath(id)),
  patchBrain: (id: string, body: PatchBrainRequest) => data<Brain>('PATCH', brainPath(id), body),
  deleteBrain: (id: string) => data<{ ok: true }>('DELETE', brainPath(id)),
  addNodes: (id: string, nodes: IdeaNode[]) => data<Brain>('POST', brainPath(id, '/nodes'), { nodes }),
  patchNode: (id: string, body: PatchNodeRequest) => data<Brain>('PATCH', brainPath(id, '/nodes'), body),
  deleteNode: (id: string, nodeId: string) => data<Brain>('DELETE', brainPath(id, '/nodes'), { id: nodeId }),
  addLinks: (id: string, links: CrossLink[]) => data<Brain>('POST', brainPath(id, '/links'), { links }),
  applyRound: (id: string, body: RoundRequest) => data<Brain>('POST', brainPath(id, '/rounds'), body),
  setTakeaway: (id: string, body: TakeawayRequest) => data<Brain>('POST', brainPath(id, '/takeaway'), body),
  llm: {
    map: (body: MapRequest) => llm<MapReplyOut>('/api/llm/map', body),
    agentRound: (body: AgentRoundRequest) => llm<AgentRoundReplyOut>('/api/llm/agent-round', body),
    takeaway: (body: LlmTakeawayRequest) => llm<TakeawayReplyOut>('/api/llm/takeaway', body),
  },
};

export type ApiClient = typeof apiClient;
