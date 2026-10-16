import { THEMES } from '@/engine/themes';
import type { Brain, Mode, ThemeId } from '@/engine/types';
import { VIEWER_JS } from '@/lib/export/viewer3d';

/** The three.js build the export loads from the CDN. A unit test fails when it drifts from node_modules/three. */
export const THREE_VERSION = '0.186.1';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON for an inline <script>: `<` becomes < so a closing script tag in a name cannot end the block. */
const inlineJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
const SCRIPT = 'scr' + 'ipt';

function css(t: (typeof THEMES)[ThemeId]): string {
  const mono = "'JetBrains Mono',monospace", serif = "'Instrument Serif',serif";
  return [
    `html,body{margin:0;height:100%;overflow:hidden;background:${t.bg};color:${t.ink};font-family:${mono}}`,
    '#c{position:fixed;inset:0;cursor:grab}#c:active{cursor:grabbing}',
    '#l{position:fixed;inset:0;pointer-events:none;overflow:hidden}#l>div{position:absolute;left:0;top:0;white-space:nowrap;will-change:transform}',
    `.k{display:block;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:${t.muted}}`,
    `.n{display:block;font-family:${serif};font-size:20px;line-height:1}`,
    `.c{font-family:${serif};font-style:italic;font-size:19px;line-height:1;padding:3px 10px 4px;border-radius:999px;background:${t.accent};color:${t.onAccent};border:1px solid ${t.ink}}`,
    '.f{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}',
    'header{position:fixed;left:32px;top:28px;max-width:360px;pointer-events:none}',
    `header small{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${t.muted}}`,
    `header h1{font:400 40px/1 ${serif};margin:6px 0}`,
    `header p{font:italic 17px/1.3 ${serif};margin:0;color:${t.soft}}`,
    `nav{position:fixed;right:32px;top:28px;display:flex;border:1px solid ${t.ink};background:${t.panel}}`,
    `nav button{font:11px ${mono};letter-spacing:.12em;text-transform:uppercase;padding:9px 13px;border:0;border-right:1px solid ${t.ink};background:none;color:${t.ink};cursor:pointer}`,
    'nav button:last-child{border-right:0}',
    `nav button.on{background:${t.ink};color:${t.panel}}`,
    `#h{position:fixed;right:32px;bottom:24px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${t.muted};pointer-events:none}`,
  ].join('');
}

/**
 * Standalone 3D viewer page: the brain as embedded JSON, the layout code inlined from `layoutJs`
 * (public/export/layout.js, which defines `AtlasLayout`) and three.js from a CDN. Pure, no DOM or fetch.
 */
export function toHtml3d(brain: Brain, theme: ThemeId, mode: Mode, layoutJs: string): string {
  const t = THEMES[theme];
  const data = { title: brain.title, summary: brain.summary, nodes: brain.nodes, links: brain.links, theme, mode };
  const cdn = `https://unpkg.com/three@${THREE_VERSION}/`;
  const importMap = { imports: { three: `${cdn}build/three.module.js`, 'three/addons/': `${cdn}examples/jsm/` } };
  const palette = { bg: t.bg, panel: t.panel, ink: t.ink, accent: t.accent, line: t.line, ring: t.ring };
  return [
    '<!doctype html>',
    `<html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${esc(brain.title)}</title>`,
    '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">',
    `<style>${css(t)}</style></head><body>`,
    '<div id="c"></div><div id="l"></div>',
    `<header><small>Second brain № ${String(brain.number || 1).padStart(3, '0')}</small><h1>${esc(brain.title)}</h1><p>${esc(brain.summary)}</p></header>`,
    '<nav><button data-m="constellation">Constellation</button><button data-m="orbit">Orbit</button><button data-m="terrain">Terrain</button></nav>',
    '<div id="h">Drag to orbit · Scroll to zoom</div>',
    `<${SCRIPT} id="brain" type="application/json">${inlineJson(data)}</${SCRIPT}>`,
    `<${SCRIPT}>${layoutJs.replace(/<\/script/gi, '<\\/script')}</${SCRIPT}>`,
    `<${SCRIPT} type="importmap">${inlineJson(importMap)}</${SCRIPT}>`,
    `<${SCRIPT} type="module">\nconst TH = ${inlineJson(palette)};${VIEWER_JS}</${SCRIPT}>`,
    '</body></html>',
  ].join('\n');
}
