import { afterEach, describe, expect, it, vi } from 'vitest';
import { track } from '@/lib/analytics';

afterEach(() => vi.unstubAllGlobals());

describe('track', () => {
  it('is a no-op on the server (no window)', () => {
    expect(typeof window).toBe('undefined');
    expect(() => track('run', { rounds: 5 })).not.toThrow();
  });
  it('is a no-op when Umami has not loaded', () => {
    vi.stubGlobal('window', {});
    expect(() => track('map', { source: 'model', nodes: 12 })).not.toThrow();
  });
  it('calls through to window.umami.track', () => {
    const umami = { track: vi.fn() };
    vi.stubGlobal('window', { umami });
    track('download', { format: 'json' });
    track('run');
    expect(umami.track).toHaveBeenNthCalledWith(1, 'download', { format: 'json' });
    expect(umami.track).toHaveBeenNthCalledWith(2, 'run', undefined);
  });
  it('swallows errors from the tracker', () => {
    vi.stubGlobal('window', { umami: { track: () => { throw new Error('blocked'); } } });
    expect(() => track('expand', { rounds: 5, focus: 'no' })).not.toThrow();
  });
});
