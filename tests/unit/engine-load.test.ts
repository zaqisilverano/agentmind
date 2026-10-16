// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { AtlasScene } from '@/engine/AtlasScene';
import { createGround } from '@/engine/ground';
import { THEMES } from '@/engine/themes';
import { GROUND_Y } from '@/engine/layout';
import * as THREE from 'three';

describe('engine modules load', () => {
  it('exposes the AtlasScene API', () => {
    expect(typeof AtlasScene).toBe('function');
    for (const m of ['mount', 'dispose', 'setTheme', 'setMode', 'onFrame', 'setAutoRotate'] as const) {
      expect(AtlasScene.prototype[m]).toBeTypeOf('function');
    }
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
});
