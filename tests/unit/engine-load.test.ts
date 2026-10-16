// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { AtlasScene } from '@/engine/AtlasScene';
import { createGround } from '@/engine/ground';
import { THEMES } from '@/engine/themes';
import { GROUND_Y } from '@/engine/layout';
import { createNodeGraph } from '@/engine/nodes';
import { createLabels } from '@/engine/labels';
import { createAgents } from '@/engine/agents';
import { sampleBrain } from '@/lib/sample/toolLibrary';
import * as THREE from 'three';

describe('engine modules load', () => {
  it('exposes the AtlasScene API', () => {
    expect(typeof AtlasScene).toBe('function');
    for (const m of ['mount', 'dispose', 'setTheme', 'setMode', 'onFrame', 'setAutoRotate', 'setBrain', 'select', 'setShowPath', 'onPick', 'positionOf', 'targetOf', 'agent', 'setReveal', 'arcPoint'] as const) {
      expect(AtlasScene.prototype[m]).toBeTypeOf('function');
    }
  });

  it('exposes createAgents', () => {
    expect(createAgents).toBeTypeOf('function');
  });

  it('agent events resolve at once before mount', async () => {
    const scene = new AtlasScene({ theme: 'atlas', mode: 'constellation' });
    await expect(scene.agent({ type: 'plan', agent: 'researcher', target: 'n0' })).resolves.toBeUndefined();
    await expect(scene.agent({ type: 'done', agent: 'researcher' })).resolves.toBeUndefined();
    scene.dispose();
  });

  it('exposes createGround', () => {
    expect(createGround).toBeTypeOf('function');
  });

  it('constructs without touching WebGL, and three throws before mount', () => {
    const scene = new AtlasScene({ theme: 'atlas', mode: 'constellation' });
    expect(scene).toBeInstanceOf(AtlasScene);
    expect(() => scene.three).toThrow(/mount/);
    expect(() => scene.layers).toThrow(/mount/);
    scene.setTheme('observatory');
    scene.setMode('terrain');
    scene.setAutoRotate(false);
    const off = scene.onFrame(() => {});
    expect(off).toBeTypeOf('function');
    off();
    scene.dispose();
  });

  it('ground eases, builds orbit rings, applies a height field and disposes', () => {
    const scene = new THREE.Scene();
    const g = createGround({ scene }, THEMES.atlas, 'constellation');
    expect(scene.children).toContain(g.group);
    expect(g.group.children).toHaveLength(7 + 1 + 46); // rings r=2..14, spokes, ridgelines
    g.setBranches(['n1', 'n2', 'n3']);
    expect(g.orbitGroup.children).toHaveLength(3);
    g.setHeightField(() => 2);
    for (let i = 0; i < 200; i++) g.update('terrain', 16);
    expect(g.group.position.y).toBeCloseTo(GROUND_Y.terrain, 2);
    const ridge = g.group.children[g.group.children.length - 1] as THREE.Line;
    expect(ridge.geometry.attributes.position.getY(5)).toBeCloseTo(2, 1);
    g.dispose();
    expect(scene.children).not.toContain(g.group);
    expect(g.orbitGroup.children).toHaveLength(0);
  });

  it('exposes createNodeGraph and createLabels', () => {
    expect(createNodeGraph).toBeTypeOf('function');
    expect(createLabels).toBeTypeOf('function');
  });

  it('labels sync one div per node, remove stale ones and empty the layer on dispose', () => {
    const layer = document.createElement('div');
    const labels = createLabels(layer, THEMES.atlas);
    const nodes = sampleBrain('#1B1A17').nodes;
    labels.sync(nodes);
    expect(layer.querySelectorAll('div.atlas-label')).toHaveLength(24);
    const core = layer.querySelector('div.atlas-label[data-depth="0"]') as HTMLElement;
    expect(core.textContent).toBe('Tool Library');
    const branch = layer.querySelector('div.atlas-label[data-depth="1"]') as HTMLElement;
    expect(branch.dataset.kind).toBe('Problem');
    expect(branch.children).toHaveLength(2);
    expect(branch.children[1].textContent).toBe('Idle ownership');

    labels.sync(nodes.slice(0, 7));
    expect(layer.querySelectorAll('div.atlas-label')).toHaveLength(7);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(15, 9, 18);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    labels.update(camera, id => (id === nodes[0].id ? { x: 0, y: 0, z: 0, r: 0.85, s: 1 } : undefined), null, null, 800, 600);
    expect(Number(core.style.opacity)).toBe(1);
    expect(core.style.transform).toMatch(/^translate\(/);
    expect(Number(branch.style.opacity)).toBe(0);

    labels.dispose();
    expect(layer.children).toHaveLength(0);
  });

  it('node graph ticks before any brain is set', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    const g = createNodeGraph({ scene, camera }, THEMES.atlas);
    expect(() => g.layoutTick('constellation', 16, 16)).not.toThrow();
    g.dispose();
  });

  it('node graph spawns, eases to targets, picks, diffs and disposes without a renderer', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(15, 9, 18);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const g = createNodeGraph({ scene, camera }, THEMES.atlas);
    const sample = sampleBrain('#1B1A17');
    const brain = { id: 'b', number: 1, title: sample.title, summary: sample.summary, round: 0, synth: null, nodes: sample.nodes,
      links: [{ a: sample.nodes[1].id, b: sample.nodes[2].id, why: '', by: 'researcher' as const }], log: [], createdAt: '', updatedAt: '' };
    g.rebuild(brain, true, 0);
    expect(g.nodes).toHaveLength(24);
    expect(g.anchorOf(sample.nodes[23].id)).toBeUndefined(); // not born yet
    for (let now = 16; now < 8000; now += 16) g.layoutTick('constellation', now, 16);
    const core = sample.nodes[0].id, leaf = sample.nodes[23].id;
    const p = g.positionOf(leaf)!, t = g.targetOf(leaf)!;
    expect(Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z)).toBeLessThan(1e-3);
    expect(g.anchorOf(core)!.s).toBeCloseTo(1, 3);
    expect(g.pick(0, 0)).toBe(core); // the core sits at the origin, straight ahead
    expect(g.related(leaf)!.has(core)).toBe(true);
    g.rebuild({ ...brain, nodes: sample.nodes.slice(0, 7), links: [] }, false, 8000);
    expect(g.positionOf(leaf)).toBeUndefined();
    expect(g.positionOf(sample.nodes[1].id)).toBeDefined();
    g.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
