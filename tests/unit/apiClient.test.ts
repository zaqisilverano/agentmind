import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, configureApiClient } from '@/lib/apiClient';

const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

afterEach(() => configureApiClient());

describe('apiClient', () => {
  it('sends JSON with same-origin credentials and unwraps { data }', async () => {
    const f = vi.fn().mockReturnValue(reply({ data: { id: 'b1' } }));
    configureApiClient({ fetch: f as unknown as typeof fetch, baseUrl: 'http://x' });
    const out = await apiClient.patchNode('b 1', { id: 'n1', name: 'A' });
    expect(out).toEqual({ id: 'b1' });
    expect(f).toHaveBeenCalledWith('http://x/api/brains/b%201/nodes', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'n1', name: 'A' }),
    });
  });

  it('sends no body or content-type on GET', async () => {
    const f = vi.fn().mockReturnValue(reply({ data: [] }));
    configureApiClient({ fetch: f as unknown as typeof fetch });
    await apiClient.listBrains();
    expect(f).toHaveBeenCalledWith('/api/brains', { method: 'GET', credentials: 'same-origin' });
  });

  it('returns { data, meta } whole from LLM routes', async () => {
    const env = { data: { children: [] }, meta: { source: 'fallback', attempts: 0 } };
    configureApiClient({ fetch: vi.fn().mockReturnValue(reply(env)) as unknown as typeof fetch });
    expect(await apiClient.llm.expand({ title: 't', summary: '', path: ['a'], existing: [] })).toEqual(env);
  });

  it('throws ApiError with the server message on non-2xx', async () => {
    configureApiClient({ fetch: vi.fn().mockReturnValue(reply({ error: 'unknown id' }, 404)) as unknown as typeof fetch });
    await expect(apiClient.restore('x')).rejects.toMatchObject({ name: 'ApiError', status: 404, message: 'unknown id' });
    await expect(apiClient.restore('x')).rejects.toBeInstanceOf(ApiError);
  });

  it('lets network errors through as TypeError', async () => {
    configureApiClient({ fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch });
    await expect(apiClient.me()).rejects.toBeInstanceOf(TypeError);
  });
});
