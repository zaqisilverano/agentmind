import { create } from 'zustand';
import type { AgentId, Brain, Mode, ThemeId } from '@/engine/types';
import type { BrainListRow, MeResponse, ProviderInfo } from '@/lib/apiClient';

export type Phase = 'plan' | 'diverge' | 'connect' | 'takeaway';
export type Rounds = 5 | 10 | 20;

/** `scope` is the node a scoped run ("Expand with agents") works under, null for a full run or no run. */
export interface RunState { active: boolean; paused: boolean; round: number; total: number; phase: Phase | null; agent: AgentId | null; status: string; scope: string | null }
/** `busy` marks an LLM call started from the UI outside a run (mapping a new brain); one at a time. */
export type Busy = 'map' | null;
/** Loading of the user and brain list: `pending` until `/api/me` answers, then `ready`, or `failed` if it could not be reached. */
export type Boot = 'pending' | 'ready' | 'failed';
/** The bottom sheet open in the mobile layout; one at a time. */
export type SheetId = 'brain' | 'settings' | 'map' | 'agents' | 'log' | 'key' | 'node';
export interface UiState { leftHidden: boolean; focus: boolean; takeawayOpen: boolean; logOpen: boolean; openDropdown: string | null; showPath: boolean; busy: Busy; boot: Boot; sheet: SheetId | null }
/** Which side answered the last LLM call: the configured model or the offline fallback. Null before the first call. */
export type LlmSource = 'model' | 'fallback' | null;
/** A failed save. `message` is the server's error text when it sent one (e.g. "this brain is full (300 nodes)"). */
export interface SyncError { label: string; message?: string; retry: () => Promise<void> }

export interface State {
  user: MeResponse['user'] | null;
  brains: BrainListRow[];
  brain: Brain | null;
  selected: string | null;
  mode: Mode;
  theme: ThemeId;
  settings: { rounds: Rounds };
  run: RunState;
  ui: UiState;
  /** The configured LLM from `/api/me`; null until it answers. */
  provider: ProviderInfo | null;
  lastSource: LlmSource;
  syncError: SyncError | null;
}

export interface Actions {
  hydrate: (me: MeResponse) => void;
  openBrain: (brain: Brain) => void;
  select: (id: string | null) => void;
  setMode: (mode: Mode) => void;
  setTheme: (theme: ThemeId) => void;
  setRounds: (rounds: Rounds) => void;
  toggleLeft: () => void;
  setFocus: (focus: boolean) => void;
  setOpenDropdown: (id: string | null) => void;
  /** Opens one mobile sheet (closing any other) or, with null, closes it. */
  setSheet: (sheet: SheetId | null) => void;
  setTakeawayOpen: (open: boolean) => void;
  setShowPath: (show: boolean) => void;
  setLogOpen: (open: boolean) => void;
  setBusy: (busy: Busy) => void;
  setBoot: (boot: Boot) => void;
  setRun: (partial: Partial<RunState>) => void;
  setStatus: (text: string) => void;
  /** Records which side answered an LLM call; the provider label is left as it is. */
  setLastSource: (source: 'model' | 'fallback') => void;
  setSyncError: (err: SyncError | null) => void;
  /** Low-level: replaces the current brain with `fn(brain)`. Used by sync; keeps the list row's title and node count in step. */
  patchBrain: (fn: (b: Brain) => Brain) => void;
}

export const initialState: State = {
  user: null,
  brains: [],
  brain: null,
  selected: null,
  mode: 'constellation',
  theme: 'atlas',
  settings: { rounds: 10 },
  run: { active: false, paused: false, round: 0, total: 0, phase: null, agent: null, status: '', scope: null },
  ui: { leftHidden: false, focus: false, takeawayOpen: true, logOpen: true, openDropdown: null, showPath: true, busy: null, boot: 'pending', sheet: null },
  provider: null,
  lastSource: null,
  syncError: null,
};

export const useStore = create<State & Actions>()((set) => ({
  ...initialState,
  hydrate: (me) => set({ user: me.user, brains: me.brains, provider: me.provider }),
  openBrain: (brain) => set({ brain, selected: null }),
  select: (id) => set((s) => ({ selected: id !== null && s.brain?.nodes.some((n) => n.id === id) ? id : null })),
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => set({ theme }),
  setRounds: (rounds) => set({ settings: { rounds } }),
  toggleLeft: () => set((s) => ({ ui: { ...s.ui, leftHidden: !s.ui.leftHidden } })),
  setFocus: (focus) => set((s) => ({ ui: { ...s.ui, focus } })),
  setOpenDropdown: (openDropdown) => set((s) => ({ ui: { ...s.ui, openDropdown } })),
  setSheet: (sheet) => set((s) => ({ ui: { ...s.ui, sheet } })),
  setTakeawayOpen: (takeawayOpen) => set((s) => ({ ui: { ...s.ui, takeawayOpen } })),
  setShowPath: (showPath) => set((s) => ({ ui: { ...s.ui, showPath } })),
  setLogOpen: (logOpen) => set((s) => ({ ui: { ...s.ui, logOpen } })),
  setBusy: (busy) => set((s) => ({ ui: { ...s.ui, busy } })),
  setBoot: (boot) => set((s) => ({ ui: { ...s.ui, boot } })),
  setRun: (partial) => set((s) => ({ run: { ...s.run, ...partial } })),
  setStatus: (status) => set((s) => ({ run: { ...s.run, status } })),
  setLastSource: (lastSource) => set({ lastSource }),
  setSyncError: (syncError) => set({ syncError }),
  patchBrain: (fn) =>
    set((s) => {
      if (!s.brain) return {};
      const brain = fn(s.brain);
      const brains = s.brains.map((r) => (r.id === brain.id ? { ...r, title: brain.title, nodeCount: brain.nodes.length } : r));
      return { brain, brains };
    }),
}));

/**
 * The empty state: `/api/me` has answered, no brain is open and none is saved (a first visit, or the last one was
 * deleted). False while loading, when loading failed, and while switching between brains.
 */
export const selectIsEmpty = (s: State): boolean => s.ui.boot === 'ready' && s.brain === null && s.brains.length === 0;
