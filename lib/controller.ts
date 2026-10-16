import type { AtlasScene } from '@/engine/AtlasScene';
import { THEMES } from '@/engine/themes';
import { AgentRunner, type RunnerDeps } from '@/lib/agents/runner';
import { apiClient, type ApiClient } from '@/lib/apiClient';
import { useStore } from '@/lib/store';
import { applyRound, setTakeaway } from '@/lib/sync';

/** The API calls the UI makes outside the sync layer: loading the user, and the four LLM routes. */
export type ControllerApi = Pick<ApiClient, 'me' | 'llm'>;

let api: ControllerApi = apiClient;

/** Injects the API (dev pages and tests). Omitted resets to the real client. */
export function configureController(opts: { api?: ControllerApi } = {}): void {
  api = opts.api ?? apiClient;
}

export const controllerApi = (): ControllerApi => api;

export interface Controller {
  /** Starts a run of `settings.rounds` rounds on the open brain. No-op without a brain or while the last run is still winding down. */
  startRun: () => void;
  /** Stops the run after the current step. */
  pause: () => void;
  /** True while the runner's loop is still going, including the wind-down after `pause()`. */
  readonly running: boolean;
  dispose: () => void;
}

let current: Controller | null = null;
export const setController = (c: Controller | null): void => { current = c; };
export const getController = (): Controller | null => current;

const store = () => useStore.getState();

/**
 * Owns the one AgentRunner. It is created on the first run and wired to the scene through `scene()`, so it does not
 * matter whether the Atlas has mounted yet. Runner events land in the store; runner `log` events are ignored because
 * `sync.applyRound` already appended the entry. Also pauses the runner when the open brain changes, and clears a
 * selection whose node no longer exists.
 */
export function createController(scene: () => AtlasScene | null, overrides: Partial<RunnerDeps> = {}): Controller {
  let runner: AgentRunner | null = null;
  const offs: (() => void)[] = [];

  const ensure = (): AgentRunner => {
    if (runner) return runner;
    const r = new AgentRunner({
      api: { agentRound: (body) => api.llm.agentRound(body), takeaway: (body) => api.llm.takeaway(body) },
      sync: { applyRound, setTakeaway },
      getBrain: () => store().brain,
      scene: (ev) => scene()?.agent(ev) ?? Promise.resolve(),
      ink: () => THEMES[store().theme].ink,
      syncFailed: () => store().syncError !== null,
      onMeta: (meta) => store().setProvider(meta),
      ...overrides,
    });
    offs.push(
      r.on('phase', (phase, agent) => store().setRun({ phase, agent })),
      r.on('status', (text) => store().setStatus(text)),
      r.on('round', (round) => store().setRun({ round })),
      r.on('finished', () => {
        store().setRun({ active: false, paused: false, phase: null, agent: null });
        store().setTakeawayOpen(true);
        store().setShowPath(true);
      }),
      r.on('error', (message) => {
        store().setRun({ active: false, paused: true });
        store().setStatus(message);
      }),
    );
    runner = r;
    return r;
  };

  let brainId = store().brain?.id ?? null;
  offs.push(
    useStore.subscribe((s) => {
      const id = s.brain?.id ?? null;
      if (id !== brainId) {
        brainId = id;
        runner?.pause();
        // At once, so the new brain never shows the old run's "Round x/total".
        if (s.run.active || !s.run.paused) s.setRun({ active: false, paused: true });
      }
      if (s.selected !== null && !s.brain?.nodes.some((n) => n.id === s.selected)) s.select(null);
    }),
  );

  return {
    get running() {
      return runner?.running ?? false;
    },
    startRun() {
      const s = store();
      const brain = s.brain;
      if (!brain) return;
      const r = ensure();
      if (r.running) return;
      const rounds = s.settings.rounds;
      // A stale error would make the runner's syncFailed() abort the first round.
      s.setSyncError(null);
      s.select(null);
      s.setRun({ active: true, paused: false, round: brain.round, total: brain.round + rounds, phase: null, agent: null, status: '' });
      void r.start(brain.id, rounds).finally(() => store().setRun({ active: false, phase: null, agent: null }));
    },
    pause() {
      if (runner?.running) store().setStatus('Pausing after this round…');
      runner?.pause();
      store().setRun({ active: false, paused: true });
    },
    dispose() {
      runner?.pause();
      for (const off of offs.splice(0)) off();
      runner = null;
    },
  };
}
