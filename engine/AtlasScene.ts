import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGround, type Ground } from '@/engine/ground';
import { THEMES } from '@/engine/themes';
import type { Mode, ThemeId } from '@/engine/types';

export type FrameCallback = (dt: number, now: number) => void;

export interface AtlasThree {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
}

export interface AtlasLayers { labels: HTMLElement; agents: HTMLElement }

// Prototype numbers (idea-atlas-agents.prototype.js lines 410–424).
const FOG_NEAR = 24, FOG_FAR = 52;
const FOV = 38, NEAR = 0.1, FAR = 200;
const CAMERA_START: [number, number, number] = [15, 9, 18];
const DAMPING = 0.06, MIN_DISTANCE = 5, MAX_DISTANCE = 48, AUTO_ROTATE_SPEED = 0.35;
const MAX_DT = 100;

/**
 * Scene lifecycle: renderer, camera, controls, fog, animation loop, resize and dispose.
 * Nodes, labels and agents plug in through onFrame() and `three` (Tasks 11–12).
 */
export class AtlasScene {
  private theme: ThemeId;
  private mode: Mode;
  private autoRotate = true;
  private subscribers: FrameCallback[] = [];
  private last: number | null = null;
  private el: HTMLElement | null = null;
  private ro: ResizeObserver | null = null;
  private ground: Ground | null = null;
  private _three: AtlasThree | null = null;
  private _layers: AtlasLayers | null = null;

  constructor(opts: { theme: ThemeId; mode: Mode }) {
    this.theme = opts.theme;
    this.mode = opts.mode;
  }

  get three(): AtlasThree {
    if (!this._three) throw new Error('AtlasScene.three is not available before mount() or after dispose()');
    return this._three;
  }

  get layers(): AtlasLayers {
    if (!this._layers) throw new Error('AtlasScene.layers is not available before mount() or after dispose()');
    return this._layers;
  }

  // initThree, lines 410–424 and 539–544.
  mount(el: HTMLElement, labelLayer: HTMLElement, agentLabelLayer: HTMLElement): void {
    if (this._three) throw new Error('AtlasScene is already mounted');
    const theme = THEMES[this.theme];
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // setSize is called with updateStyle = false, so the canvas fills `el` through CSS.
    Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null; // transparent canvas; the page background comes from CSS
    scene.fog = new THREE.Fog(theme.bg, FOG_NEAR, FOG_FAR);

    const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
    camera.position.set(...CAMERA_START);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = DAMPING;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
    controls.autoRotate = this.autoRotate;

    this.el = el;
    this._three = { scene, camera, renderer, controls };
    this._layers = { labels: labelLayer, agents: agentLabelLayer };
    this.ground = createGround({ scene }, theme, this.mode);

    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    this.ro = new ResizeObserver(size);
    this.ro.observe(el);
    size();

    this.last = null;
    renderer.setAnimationLoop(this.tick);
  }

  // tick, line 628 onward: only time, ground, controls and render live here.
  private tick = (now: number): void => {
    const t = this._three;
    if (!t || !this.ground) return;
    const dt = Math.min(MAX_DT, this.last === null ? 0 : now - this.last);
    this.last = now;
    this.ground.update(this.mode, dt);
    for (const cb of this.subscribers.slice()) cb(dt, now);
    t.controls.update();
    t.renderer.render(t.scene, t.camera);
  };

  onFrame(cb: FrameCallback): () => void {
    this.subscribers.push(cb);
    return () => {
      const i = this.subscribers.indexOf(cb);
      if (i >= 0) this.subscribers.splice(i, 1);
    };
  }

  setMode(m: Mode): void {
    this.mode = m;
  }

  // applyTheme, lines 390–395 (the ground and fog part).
  setTheme(id: ThemeId): void {
    this.theme = id;
    if (!this._three || !this.ground) return;
    const theme = THEMES[id];
    (this._three.scene.fog as THREE.Fog).color.set(theme.bg);
    this.ground.recolor(theme);
  }

  setAutoRotate(on: boolean): void {
    this.autoRotate = on;
    if (this._three) this._three.controls.autoRotate = on;
  }

  // componentWillUnmount, lines 402–408.
  dispose(): void {
    this.subscribers = [];
    const t = this._three;
    if (!t) return;
    t.renderer.setAnimationLoop(null);
    this.ro?.disconnect();
    this.ro = null;
    this.ground?.dispose();
    this.ground = null;
    t.controls.dispose();
    t.renderer.dispose();
    if (this.el && t.renderer.domElement.parentNode === this.el) this.el.removeChild(t.renderer.domElement);
    this.el = null;
    this._three = null;
    this._layers = null;
  }
}
