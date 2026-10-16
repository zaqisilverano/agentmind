'use client';

import { useEffect, type RefObject } from 'react';
import type { AtlasScene } from '@/engine/AtlasScene';
import { controllerApi, createController, setController } from '@/lib/controller';
import { useStore } from '@/lib/store';
import { selectBrain } from '@/lib/sync';

export interface AppControllerProps {
  /** Filled by `Atlas.onReady`; read on every agent event, so the runner works whenever the scene mounts. */
  sceneRef: RefObject<AtlasScene | null>;
}

/**
 * Mounted once by AppShell (also in focus mode). Loads the user and their brains, opens the most recent one,
 * and publishes the controller that owns the single AgentRunner. Renders nothing.
 */
export function AppController({ sceneRef }: AppControllerProps) {
  useEffect(() => {
    const controller = createController(() => sceneRef.current);
    setController(controller);
    return () => {
      controller.dispose();
      setController(null);
    };
  }, [sceneRef]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const me = await controllerApi().me();
        if (!live) return;
        useStore.getState().hydrate(me);
        const first = me.brains[0];
        if (first) await selectBrain(first.id);
      } catch {
        if (live) useStore.getState().setStatus('Could not reach the server');
      }
    })();
    return () => { live = false; };
  }, []);

  return null;
}
