'use client';

import { useEffect, useRef } from 'react';
import { AtlasScene } from '@/engine/AtlasScene';
import type { Brain, Mode, ThemeId } from '@/engine/types';

export interface AtlasProps {
  brain: Brain | null;
  mode: Mode;
  theme: ThemeId;
  selected: string | null;
  showPath: boolean;
  onPick: (id: string | null) => void;
  onReady?: (scene: AtlasScene) => void;
  className?: string;
}

const FILL = 'absolute inset-0';

/** Mounts the Three.js atlas once and pushes prop changes into it. The scene owns the canvas and both label layers. */
export function Atlas({ brain, mode, theme, selected, showPath, onPick, onReady, className }: AtlasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AtlasScene | null>(null);
  // Latest props for the mount effect and the pick subscription, so the scene is created once.
  const latest = useRef({ mode, theme, onPick, onReady });
  latest.current = { mode, theme, onPick, onReady };

  useEffect(() => {
    const el = canvasRef.current, labels = labelRef.current, agents = agentRef.current;
    if (!el || !labels || !agents) return;
    const scene = new AtlasScene({ theme: latest.current.theme, mode: latest.current.mode });
    scene.mount(el, labels, agents);
    sceneRef.current = scene;
    const unsub = scene.onPick(id => latest.current.onPick(id));
    latest.current.onReady?.(scene);
    return () => {
      unsub();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // A different brain (opened or newly mapped) grows in from the core; edits to the same brain keep node positions.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!brain || !scene) return;
    scene.setBrain(brain, shownId.current !== brain.id ? { fresh: true } : {});
    shownId.current = brain.id;
  }, [brain]);
  useEffect(() => { sceneRef.current?.setMode(mode); }, [mode]);
  useEffect(() => { sceneRef.current?.setTheme(theme); }, [theme]);
  useEffect(() => { sceneRef.current?.select(selected); }, [selected]);
  useEffect(() => { sceneRef.current?.setShowPath(showPath); }, [showPath]);

  return (
    <div className={`overflow-hidden ${className ?? 'fixed inset-0'}`}>
      <div ref={canvasRef} className={FILL} style={{ cursor: 'grab' }} />
      <div ref={labelRef} className={`${FILL} pointer-events-none overflow-hidden`} />
      <div ref={agentRef} className={`${FILL} pointer-events-none overflow-hidden`} />
    </div>
  );
}
