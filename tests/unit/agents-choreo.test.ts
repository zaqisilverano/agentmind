// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { createAgents, HOVER_LIFT, type Agents } from '@/engine/agents';
import { AGENTS } from '@/lib/agents/roster';
import { THEMES } from '@/engine/themes';

const DT = 16;

function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(15, 9, 18);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const layer = document.createElement('div');
  const agents = createAgents({ scene, camera }, layer, AGENTS, THEMES.atlas);
  agents.setSize(800, 600);
  let now = 1000;
  /** Tick until `done()` is true or `max` frames pass; returns the number of frames ticked. */
  const run = async (max: number, done: () => boolean = () => false) => {
    let n = 0;
    while (n < max && !done()) {
      now += DT;
      agents.tick(DT, now, camera);
      n++;
      await Promise.resolve();
    }
    return n;
  };
  const probe = (id: string) => agents.group.children.find(c => c.userData.agent === id)!;
  return { scene, camera, layer, agents, run, probe };
}

const track = (p: Promise<void>) => { const s = { done: false }; p.then(() => { s.done = true; }); return s; };

let current: Agents | null = null;
afterEach(() => { current?.dispose(); current = null; });

describe('agent choreography (no WebGL)', () => {
  it('builds five hidden probes in one scene group', () => {
    const { scene, agents } = setup();
    current = agents;
    expect(scene.children).toContain(agents.group);
    expect(agents.group.children).toHaveLength(5);
    for (const c of agents.group.children) expect(c.visible).toBe(false);
    expect(agents.group.children.map(c => c.userData.agent)).toEqual(AGENTS.map(a => a.id));
    expect(agents.active()).toBe(false);
  });

  it('show pops the agent in and resolves from the frame loop', async () => {
    const { agents, run, probe } = setup();
    current = agents;
    const s = track(agents.show('researcher', { x: 0, y: 0, z: 0 }));
    await Promise.resolve();
    expect(s.done).toBe(false); // nothing resolves without frames
    await run(60);
    expect(s.done).toBe(true);
    const p = probe('researcher');
    expect(p.visible).toBe(true);
    expect(p.scale.x).toBeCloseTo(1.15, 2);
    expect(agents.active()).toBe(true);
  });

  it('walk follows the points and ends above the last one', async () => {
    const { agents, run, probe } = setup();
    current = agents;
    agents.show('builder', { x: 0, y: 0, z: 0 });
    await run(30);
    const s = track(agents.walk('builder', [{ x: 0, y: 0, z: 0 }, { x: 4, y: 1, z: -2 }]));
    await run(10);
    expect(s.done).toBe(false);
    await run(200, () => s.done);
    expect(s.done).toBe(true);
    const pos = probe('builder').position;
    expect(pos.x).toBeCloseTo(4, 5);
    expect(pos.y).toBeCloseTo(1 + HOVER_LIFT, 5);
    expect(pos.z).toBeCloseTo(-2, 5);
  });

  it('a single-point walk teleports and resolves at once', async () => {
    const { agents, run, probe } = setup();
    current = agents;
    agents.show('customer', { x: 0, y: 0, z: 0 });
    await run(5);
    const s = track(agents.walk('customer', [{ x: 2, y: 0, z: 2 }]));
    await Promise.resolve();
    expect(s.done).toBe(true);
    expect(probe('customer').position.x).toBeCloseTo(2, 5);
  });

  it('hide shrinks out, resolves and leaves the probe invisible', async () => {
    const { agents, run, probe } = setup();
    current = agents;
    agents.show('skeptic', { x: 0, y: 0, z: 0 });
    await run(60);
    const s = track(agents.hide('skeptic'));
    await run(200, () => s.done);
    expect(s.done).toBe(true);
    expect(probe('skeptic').visible).toBe(false);
    expect(agents.active()).toBe(false);
  });

  it('hide right after show, before any frame, still resolves and the show promise settles too', async () => {
    const { agents, run } = setup();
    current = agents;
    const shown = track(agents.show('skeptic', { x: 0, y: 0, z: 0 }));
    const hidden = track(agents.hide('skeptic'));
    await Promise.resolve();
    expect(shown.done).toBe(true);
    expect(hidden.done).toBe(true);
    await run(5);
    expect(agents.active()).toBe(false);
  });

  it('setLabel writes the name tag into the layer; it shows only while the agent is visible', async () => {
    const { agents, layer, run } = setup();
    current = agents;
    expect(layer.children).toHaveLength(5);
    agents.setLabel('strategist', 'Strategist · eyeing Pickup lockers');
    expect(layer.textContent).toContain('Strategist · eyeing Pickup lockers');
    const tag = [...layer.children].find(el => el.textContent?.includes('Pickup lockers')) as HTMLElement;
    expect(tag.style.opacity).toBe('0');
    agents.show('strategist', { x: 0, y: 0, z: 0 });
    await run(20);
    expect(tag.style.opacity).toBe('1');
    expect(tag.style.transform).toMatch(/^translate\(/);
  });

  it('think shows the bubble; burst adds rings that expire', async () => {
    const { agents, run, probe, scene } = setup();
    current = agents;
    agents.show('researcher', { x: 0, y: 0, z: 0 });
    await run(20);
    agents.think('researcher', true);
    await run(1);
    const bubble = probe('researcher').getObjectByName('bubble')!;
    expect(bubble.visible).toBe(true);
    agents.think('researcher', false);
    await run(1);
    expect(bubble.visible).toBe(false);
    const before = scene.children.length;
    agents.burst('researcher');
    expect(scene.children.length).toBe(before + 2);
    await run(80);
    expect(scene.children.length).toBe(before);
  });

  it('wait and ride resolve from the frame loop and report progress', async () => {
    const { agents, run } = setup();
    current = agents;
    agents.show('builder', { x: 0, y: 0, z: 0 });
    const w = track(agents.wait(400));
    await run(10);
    expect(w.done).toBe(false);
    await run(40, () => w.done);
    expect(w.done).toBe(true);
    const seen: number[] = [];
    const r = track(agents.ride('builder', t => ({ x: t * 3, y: 0, z: 0 }), 1500, pr => seen.push(pr)));
    await run(200, () => r.done);
    expect(r.done).toBe(true);
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1])).toBe(true);
  });

  it('dispose resolves pending promises and empties the layer and the group', async () => {
    const { agents, layer, scene, run } = setup();
    agents.show('researcher', { x: 0, y: 0, z: 0 });
    await run(10);
    agents.burst('researcher');
    const pending = [
      track(agents.walk('researcher', [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }])),
      track(agents.show('builder', { x: 0, y: 0, z: 0 })),
      track(agents.wait(5000)),
    ];
    agents.dispose();
    await Promise.resolve();
    for (const s of pending) expect(s.done).toBe(true);
    expect(layer.children).toHaveLength(0);
    expect(agents.group.children).toHaveLength(0);
    expect(scene.children).toHaveLength(0);
  });
});
