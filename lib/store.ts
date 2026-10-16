import { create } from 'zustand';
import type { AgentId, Brain, Mode, ThemeId } from '@/engine/types';
import type { BrainListRow, MeResponse } from '@/lib/apiClient';

export type Phase = 'plan' | 'diverge' | 'connect' | 'takeaway';
export type Rounds = 5 | 10 | 20;

export interface RunState { active: boolean; paused: boolean; round: number; total: number; phase: Phase | null; agent: AgentId | null; status: string }
export interface UiState { leftHidden: boolean; focus: boolean; takeawayOpen: boolean; logOpen: boolean; openDropdown: string | null }
export interface Provider { source: 'model' | 'fallback'; model?: string }
export interface SyncError { label: string; retry: () => Promise<void> }

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
  provider: Provider | null;
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
  setTakeawayOpen: (open: boolean) => void;
  setLogOpen: (open: boolean) => void;
  setRun: (partial: Partial<RunState>) => void;
  setStatus: (text: string) => void;
  setProvider: (meta: Provider) => void;
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
  run: { active: false, paused: false, round: 0, total: 0, phase: null, agent: null, status: '' },
  ui: { leftHidden: false, focus: false, takeawayOpen: true, logOpen: true, openDropdown: null },
  provider: null,
  syncError: null,
};

export const useStore = create<State & Actions>()((set) => ({
  ...initialState,
  hydrate: (me) => set({ user: me.user, brains: me.brains }),
  openBrain: (brain) => set({ brain, selected: null }),
  select: (id) => set((s) => ({ selected: id !== null && s.brain?.nodes.some((n) => n.id === id) ? id : null })),
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => set({ theme }),
  setRounds: (rounds) => set({ settings: { rounds } }),
  toggleLeft: () => set((s) => ({ ui: { ...s.ui, leftHidden: !s.ui.leftHidden } })),
  setFocus: (focus) => set((s) => ({ ui: { ...s.ui, focus } })),
  setOpenDropdown: (openDropdown) => set((s) => ({ ui: { ...s.ui, openDropdown } })),
  setTakeawayOpen: (takeawayOpen) => set((s) => ({ ui: { ...s.ui, takeawayOpen } })),
  setLogOpen: (logOpen) => set((s) => ({ ui: { ...s.ui, logOpen } })),
  setRun: (partial) => set((s) => ({ run: { ...s.run, ...partial } })),
  setStatus: (status) => set((s) => ({ run: { ...s.run, status } })),
  setProvider: (meta) => set({ provider: meta.model === undefined ? { source: meta.source } : { source: meta.source, model: meta.model } }),
  setSyncError: (syncError) => set({ syncError }),
  patchBrain: (fn) =>
    set((s) => {
      if (!s.brain) return {};
      const brain = fn(s.brain);
      const brains = s.brains.map((r) => (r.id === brain.id ? { ...r, title: brain.title, nodeCount: brain.nodes.length } : r));
      return { brain, brains };
    }),
}));
