import type { Mode, ThemeId } from '@/engine/types';
import { useStore, type Rounds } from '@/lib/store';

export const PREFS_KEY = 'ab_prefs';

export interface Prefs { mode: Mode; theme: ThemeId; settings: { rounds: Rounds }; ui: { leftHidden: boolean } }

const MODES: readonly string[] = ['constellation', 'orbit', 'terrain'];
const THEMES: readonly string[] = ['atlas', 'observatory', 'blueprint'];

/** Reads and validates saved preferences. Anything missing, malformed or unreadable is dropped. */
export function readPrefs(): Partial<Prefs> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== 'object') return {};
    const o = p as Record<string, unknown>;
    const out: Partial<Prefs> = {};
    if (typeof o.mode === 'string' && MODES.includes(o.mode)) out.mode = o.mode as Mode;
    if (typeof o.theme === 'string' && THEMES.includes(o.theme)) out.theme = o.theme as ThemeId;
    const rounds = (o.settings as { rounds?: unknown } | undefined)?.rounds;
    if (rounds === 5 || rounds === 10 || rounds === 20) out.settings = { rounds };
    const leftHidden = (o.ui as { leftHidden?: unknown } | undefined)?.leftHidden;
    if (typeof leftHidden === 'boolean') out.ui = { leftHidden };
    return out;
  } catch {
    return {};
  }
}

export function writePrefs(prefs: Prefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage full or blocked: preferences are a convenience, not data
  }
}

const pick = (s: ReturnType<typeof useStore.getState>): Prefs => ({ mode: s.mode, theme: s.theme, settings: s.settings, ui: { leftHidden: s.ui.leftHidden } });

let unsubscribe: (() => void) | null = null;

/** Applies saved preferences to the store, then saves them whenever they change. Call once on mount; safe to call again. */
export function loadPrefs(): void {
  if (typeof window === 'undefined') return;
  const saved = readPrefs();
  useStore.setState((s) => ({
    ...(saved.mode && { mode: saved.mode }),
    ...(saved.theme && { theme: saved.theme }),
    ...(saved.settings && { settings: saved.settings }),
    ...(saved.ui && { ui: { ...s.ui, ...saved.ui } }),
  }));
  unsubscribe?.();
  let last = JSON.stringify(pick(useStore.getState()));
  unsubscribe = useStore.subscribe((s) => {
    const next = pick(s);
    const str = JSON.stringify(next);
    if (str === last) return;
    last = str;
    writePrefs(next);
  });
}
