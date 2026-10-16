import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGround, type Ground } from '@/engine/ground';
import { createLabels, type Labels } from '@/engine/labels';
import { buildPeaks, heightAt, type Vec3 } from '@/engine/layout';
import { createNodeGraph, type NodeGraph } from '@/engine/nodes';
import { THEMES } from '@/engine/themes';
import type { Brain, Mode, ThemeId } from '@/engine/types';

export type FrameCallback = (dt: number, now: number) => void;
export type PickCallback = (id: string | null) => void;

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
const LAG = 260, FOCUS_RATE = 0.6, CLICK_SLOP = 5; // tick line 739, picking line 535

/**
 * Scene lifecycle: renderer, camera, controls, fog, animation loop, resize and dispose.
 * Owns the node graph and label overlay (Task 11); agents plug in through onFrame() and `three` (Task 12).
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
  private nodes: NodeGraph | null = null;
  private labels: Labels | null = null;
  private brain: Brain | null = null;
  private shown = false;
  private selected: string | null = null;
  private showPath = false;
  private pickers: PickCallback[] = [];
  private down: [number, number] | null = null;
  private width = 1;
  private height = 1;
  private unlisten: (() => void) | null = null;

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
    this.nodes = createNodeGraph({ scene, camera }, theme, { surfaceY: (x, z) => this.ground?.surfaceY(x, z) ?? 0 });
    this.labels = createLabels(labelLayer, theme);
    this.nodes.select(this.selected);
    if (this.brain) this.applyBrain(!this.shown, null);
    this.listen(el, renderer.domElement, camera);

    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      this.width = w; this.height = h;
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

  // tick, line 628 onward. Order: ground → nodes → labels → onFrame subscribers → controls → render.
  private tick = (now: number): void => {
    const t = this._three;
    if (!t || !this.ground) return;
    const dt = Math.min(MAX_DT, this.last === null ? 0 : now - this.last);
    this.last = now;
    this.ground.update(this.mode, dt);
    const nodes = this.nodes!;
    nodes.layoutTick(this.mode, now, dt);
    const focus = nodes.focus();
    if (focus) t.controls.target.lerp(focus, (1 - Math.exp(-dt / LAG)) * FOCUS_RATE);
    t.controls.autoRotate = this.autoRotate && !this.selected;
    // Labels project with last frame's camera matrices (one-frame lag; the camera moves slowly).
    this.labels!.update(t.camera, id => nodes.anchorOf(id), this.selected, nodes.related(this.selected),
      this.width, this.height, nodes.hotIds());
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

  // Picking, lines 525–538: raycast on pointerup only when the pointer moved less than 5 px since pointerdown.
  private listen(el: HTMLElement, canvas: HTMLCanvasElement, camera: THREE.Camera): void {
    const pick = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      camera.updateMatrixWorld();
      return this.nodes?.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1) ?? null;
    };
    const onDown = (e: PointerEvent) => { this.down = [e.clientX, e.clientY]; el.style.cursor = 'grabbing'; };
    const onUp = (e: PointerEvent) => {
      el.style.cursor = 'grab';
      if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < CLICK_SLOP) {
        const id = pick(e);
        for (const cb of this.pickers.slice()) cb(id);
      }
      this.down = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return;
      const id = pick(e);
      this.nodes?.setHovered(id);
      el.style.cursor = id ? 'pointer' : 'grab';
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointermove', onMove);
    this.unlisten = () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
    };
  }

  // buildGraph, lines 545–595, plus the ground's peaks and orbit rings (lines 582–585).
  private applyBrain(fresh: boolean, spawnFrom: Vec3 | null): void {
    const brain = this.brain, nodes = this.nodes, ground = this.ground;
    if (!brain || !nodes || !this.labels || !ground) return;
    nodes.rebuild(brain, fresh, performance.now(), spawnFrom);
    this.labels.sync(brain.nodes);
    const peaks = buildPeaks(brain.nodes);
    ground.setHeightField((x, z) => heightAt(peaks, x, z));
    ground.setBranches(brain.nodes.filter(n => n.depth === 1).sort((a, b) => a.position - b.position).map(n => n.id));
    this.applyPath();
    this.shown = true;
  }

  private applyPath(): void {
    this.nodes?.setPath(this.showPath && this.brain?.synth ? this.brain.synth.path : null);
  }

  /**
   * Show a brain. `fresh` (default: true for the first brain shown, false after) restarts every node from its parent
   * with the depth/index stagger; otherwise existing nodes keep their place and new ones spawn (at `spawnFrom` if given).
   */
  setBrain(brain: Brain, opts: { fresh?: boolean; spawnFrom?: Vec3 | null } = {}): void {
    this.brain = brain;
    this.applyBrain(opts.fresh ?? !this.shown, opts.spawnFrom ?? null);
  }

  /** Select a node (or clear). Auto-rotate pauses while something is selected; the camera eases toward it. */
  select(id: string | null): void {
    this.selected = id;
    this.nodes?.select(id);
  }

  setShowPath(on: boolean): void {
    this.showPath = on;
    this.applyPath();
  }

  /** Clicks on the canvas report the picked node id, or null for empty space. Selection is the caller's decision. */
  onPick(cb: PickCallback): () => void {
    this.pickers.push(cb);
    return () => {
      const i = this.pickers.indexOf(cb);
      if (i >= 0) this.pickers.splice(i, 1);
    };
  }

  /** Current (eased) world position of a node. */
  positionOf(id: string): Vec3 | undefined {
    return this.nodes?.positionOf(id);
  }

  /** Layout target of a node for the current mode. */
  targetOf(id: string): Vec3 | undefined {
    return this.nodes?.targetOf(id);
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
    this.nodes?.recolor(theme);
    this.labels?.recolor(theme);
  }

  /** Allow auto-rotate (the caller turns it off while a run is active). It only spins while nothing is selected. */
  setAutoRotate(on: boolean): void {
    this.autoRotate = on;
    if (this._three) this._three.controls.autoRotate = on && !this.selected;
  }

  // componentWillUnmount, lines 402–408.
  dispose(): void {
    this.subscribers = [];
    this.pickers = [];
    const t = this._three;
    if (!t) return;
    t.renderer.setAnimationLoop(null);
    this.unlisten?.();
    this.unlisten = null;
    this.down = null;
    this.labels?.dispose();
    this.labels = null;
    this.nodes?.dispose();
    this.nodes = null;
    this.shown = false;
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
