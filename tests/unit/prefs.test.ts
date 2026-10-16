import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREFS_KEY, loadPrefs, readPrefs } from '@/lib/prefs';
import { initialState, useStore } from '@/lib/store';

let mem: Map<string, string>;

beforeEach(() => {
  mem = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } });
  useStore.setState(initialState);
});
afterEach(() => vi.unstubAllGlobals());

describe('prefs', () => {
  it('ignores malformed or invalid saved values', () => {
    mem.set(PREFS_KEY, JSON.stringify({ mode: 'bogus', theme: 'blueprint', settings: { rounds: 7 }, ui: { leftHidden: 'yes' } }));
    expect(readPrefs()).toEqual({ theme: 'blueprint' });
    mem.set(PREFS_KEY, '{not json');
    expect(readPrefs()).toEqual({});
  });

  it('loads into the store and saves on change', () => {
    mem.set(PREFS_KEY, JSON.stringify({ mode: 'terrain', settings: { rounds: 20 }, ui: { leftHidden: true } }));
    loadPrefs();
    const s = useStore.getState();
    expect([s.mode, s.theme, s.settings.rounds, s.ui.leftHidden]).toEqual(['terrain', 'atlas', 20, true]);
    s.setTheme('observatory');
    expect(JSON.parse(mem.get(PREFS_KEY)!)).toEqual({ mode: 'terrain', theme: 'observatory', settings: { rounds: 20 }, ui: { leftHidden: true } });
  });

  it('is a no-op without a window', () => {
    vi.unstubAllGlobals();
    expect(() => loadPrefs()).not.toThrow();
    expect(readPrefs()).toEqual({});
  });
});
