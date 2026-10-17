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
    // Node detail card: square corners, 1 px ink border, the theme's hard shadow; a bottom sheet below 640 px.
    `#node-card{position:fixed;right:32px;top:84px;width:340px;max-height:calc(100% - 140px);overflow:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:16px 16px 18px;background:${t.panel};color:${t.ink};border:1px solid ${t.ink};border-radius:0;box-shadow:${t.shadow5};z-index:2}`,
    '#node-card[hidden]{display:none}',
    `#node-card .hd{display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${t.muted}}`,
    `#node-card .dot{width:10px;height:10px;flex:none;border-radius:50%;border:1px solid ${t.ink}}`,
    `#node-card .x{margin-left:auto;flex:none;width:26px;height:26px;padding:0;font:16px/1 ${mono};border:1px solid ${t.ink};border-radius:0;background:${t.bg};color:${t.ink};cursor:pointer}`,
    `#node-card .p{font-size:10px;letter-spacing:.06em;color:${t.muted}}`,
    `#node-card .nm{font:400 32px/1 ${serif};overflow-wrap:anywhere}`,
    `#node-card .no{font:17px/1.35 ${serif};color:${t.soft}}`,
    `#node-card .sec{display:flex;flex-direction:column;gap:6px;border-top:1px dashed ${t.rule};padding-top:10px}`,
    `#node-card .sh{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${t.muted}}`,
    `#node-card .un{font:16px/1.35 ${serif};white-space:pre-wrap;overflow-wrap:anywhere}`,
    '#node-card .ch{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}',
    `#node-card .ch button{max-width:100%;overflow-wrap:anywhere;text-align:left;font:10.5px ${mono};letter-spacing:.06em;text-transform:uppercase;padding:5px 8px;border:1px solid ${t.ink};border-radius:0;background:${t.bg};color:${t.ink};cursor:pointer}`,
    `#node-card .x:hover,#node-card .ch button:hover{background:${t.ink};color:${t.panel}}`,
    `#node-card .lk{display:block;padding:0;border:0;background:none;text-align:left;color:${t.ink};cursor:pointer;font:11px/1.4 ${mono};letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}`,
    `#node-card .lk:hover{color:${t.accent}}`,
    `#node-card .lk span{font:15px ${serif};letter-spacing:0;text-transform:none;color:${t.soft}}`,
    '@media (max-width:639px){#node-card{left:0;right:0;bottom:0;top:auto;width:auto;max-height:55%;border-width:1px 0 0}}',
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
  const palette = { bg: t.bg, panel: t.panel, ink: t.ink, muted: t.muted, accent: t.accent, hot: t.hot, line: t.line, ring: t.ring };
  return [
    '<!doctype html>',
    `<html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${esc(brain.title)}</title>`,
    '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">',
    `<style>${css(t)}</style></head><body>`,
    '<div id="c"></div><div id="l"></div>',
    `<header><small>Second brain № ${String(brain.number || 1).padStart(3, '0')}</small><h1>${esc(brain.title)}</h1><p>${esc(brain.summary)}</p></header>`,
    '<nav><button data-m="constellation">Constellation</button><button data-m="orbit">Orbit</button><button data-m="terrain">Terrain</button></nav>',
    '<aside id="node-card" aria-live="polite" hidden></aside>',
    '<div id="h">Drag to orbit · Scroll to zoom · Click a node</div>',
    `<${SCRIPT} id="brain" type="application/json">${inlineJson(data)}</${SCRIPT}>`,
    `<${SCRIPT}>${layoutJs.replace(/<\/script/gi, '<\\/script')}</${SCRIPT}>`,
    `<${SCRIPT} type="importmap">${inlineJson(importMap)}</${SCRIPT}>`,
    `<${SCRIPT} type="module">\nconst TH = ${inlineJson(palette)};${VIEWER_JS}</${SCRIPT}>`,
    '</body></html>',
  ].join('\n');
}
