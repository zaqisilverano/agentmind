import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { toHtml3d, THREE_VERSION } from '@/lib/export/html3d';
import { VIEWER_JS } from '@/lib/export/viewer3d';
import { THEMES } from '@/engine/themes';
import { bundleLayout } from '@/scripts/layoutBundle';
import { fixtureBrain } from '../fixtures/brain';

const STUB = 'var AtlasLayout=(function(){function computeTargets(){return {}}return {computeTargets:computeTargets}})();';
const brain = { ...fixtureBrain(), summary: 'Evil </script><script>alert(1)</script> summary & <b>bold</b>' };
const html = toHtml3d(brain, 'observatory', 'orbit', STUB);
const jsonOf = (h: string) => /<script id="brain" type="application\/json">([\s\S]*?)<\/script>/.exec(h)![1];
const threeVersion = JSON.parse(readFileSync('node_modules/three/package.json', 'utf8')).version as string;

describe('toHtml3d', () => {
  it('is a standalone page titled with the brain title', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain(`<title>${brain.title}</title>`);
  });
  it('embeds the brain as JSON with node ids, theme and mode', () => {
    const raw = jsonOf(html);
    expect(raw).toContain('"id":"n0"');
    const data = JSON.parse(raw);
    expect(data).toMatchObject({ title: brain.title, summary: brain.summary, theme: 'observatory', mode: 'orbit' });
    expect(data.nodes).toHaveLength(brain.nodes.length);
    expect(data.links).toHaveLength(brain.links.length);
  });
  it('escapes < so a closing script tag in the data cannot break out', () => {
    expect(jsonOf(html)).not.toContain('<');
    expect(jsonOf(html)).toContain('\\u003c/script>');
    expect(html.match(/<\/script>/g)!.length).toBe(html.match(/<script/g)!.length);
  });
  it('escapes the summary in the visible header', () => {
    expect(html).toContain('Evil &lt;/script&gt;');
    expect(html).not.toContain('<b>bold</b>');
  });
  it('inlines the layout code', () => {
    expect(html).toContain(STUB);
    expect(html).toContain('computeTargets');
  });
  it('pins THREE_VERSION to the installed three, so the CDN build matches the app', () => {
    expect(THREE_VERSION).toBe(threeVersion);
  });
  it('loads three from unpkg at that version through an import map', () => {
    const map = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)![1]);
    expect(map.imports).toEqual({
      three: `https://unpkg.com/three@${threeVersion}/build/three.module.js`,
      'three/addons/': `https://unpkg.com/three@${threeVersion}/examples/jsm/`,
    });
    expect(html).toContain('three/addons/controls/OrbitControls.js');
  });
  it('carries the current theme colours, the fonts and the View switch', () => {
    expect(html).toContain(THEMES.observatory.bg);
    expect(html).toContain(THEMES.observatory.ink);
    expect(html).not.toContain(THEMES.atlas.bg);
    expect(html).toContain('fonts.googleapis.com/css2?family=Instrument+Serif');
    expect(html).toContain('JetBrains+Mono');
    for (const m of ['constellation', 'orbit', 'terrain']) expect(html).toContain(`data-m="${m}"`);
    expect(html).toContain('Drag to orbit');
  });
  it('has the node detail card container and the click hint', () => {
    expect(html).toContain('<aside id="node-card"');
    expect(html).toContain("'MY NOTES'");
    expect(html).toContain('#node-card{');
    expect(html).toContain(THEMES.observatory.shadow5);
    expect(html).toContain('Drag to orbit · Scroll to zoom · Click a node');
  });
  it('the viewer script renders the card with MY NOTES and LINKS headings, text only through textContent', () => {
    expect(VIEWER_JS).toContain("'MY NOTES'");
    expect(VIEWER_JS).toContain("'LINKS'");
    expect(VIEWER_JS).toContain("getElementById('node-card')");
    expect(VIEWER_JS).not.toContain('innerHTML');
    expect(VIEWER_JS).not.toMatch(/[`]|\$\{|<\/script/i);
  });
  it('keeps a userNote with markup and a closing script tag escaped in the JSON', () => {
    const b = fixtureBrain();
    const userNote = 'Line one <b>x</b>\nline two </script><script>alert(2)</script>';
    b.nodes = b.nodes.map(n => (n.id === 'n0' ? { ...n, userNote } : n));
    const h = toHtml3d(b, 'atlas', 'constellation', STUB);
    const raw = jsonOf(h);
    expect(raw).not.toContain('<');
    expect(raw).toContain('\\u003cb>x\\u003c/b>');
    expect(raw).toContain('\\u003c/script>');
    expect(JSON.parse(raw).nodes.find((n: { id: string }) => n.id === 'n0').userNote).toBe(userNote);
    expect(h.match(/<\/script>/g)!.length).toBe(h.match(/<script/g)!.length);
    expect(h).not.toContain('<b>x</b>');
  });
  it('a layoutJs that contains a closing script tag cannot break out either', () => {
    const h = toHtml3d(brain, 'atlas', 'terrain', 'var x="</script><i>";');
    expect(h.match(/<\/script>/g)!.length).toBe(h.match(/<script/g)!.length);
  });
});

describe('public/export/layout.js', () => {
  it('matches a fresh bundle of engine/layout.ts (run npm run build:export-layout after editing the layout)', async () => {
    expect(readFileSync('public/export/layout.js', 'utf8')).toBe(await bundleLayout());
  });
  it('exposes the layout API on AtlasLayout', async () => {
    const api = new Function(`${await bundleLayout()}; return AtlasLayout;`)();
    expect(Object.keys(api).sort()).toEqual(['GROUND_Y', 'buildPeaks', 'computeTargets', 'hash', 'heightAt', 'orbitParams']);
    expect(api.computeTargets(brain.nodes, 'orbit', 0).n0).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('the viewer module script parses as an ES module (a syntax error would only show in the browser)', async () => {
    const { transform } = await import('esbuild');
    const viewer = /<script type="module">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(viewer).toContain('import * as THREE');
    await expect(transform(viewer, { loader: 'js', format: 'esm' })).resolves.toBeDefined();
    await expect(transform(`${viewer}\nconst broken = ;`, { loader: 'js', format: 'esm' })).rejects.toThrow();
  });
});
