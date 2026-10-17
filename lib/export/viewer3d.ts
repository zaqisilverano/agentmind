/**
 * Browser script for the standalone 3D HTML export: a port of the prototype's VIEWER (line 173), restyled to
 * read its data from the embedded JSON and its layout from `window.AtlasLayout`. Runs as an ES module after
 * `const TH = <theme palette>;` is prepended. Must not contain a backtick, `${` or a closing script tag.
 * Clicking a node selects it (reticle, hot label, dimmed unrelated labels) and fills the #node-card panel; all node
 * text goes in through textContent.
 */
export const VIEWER_JS = `
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const D = JSON.parse(document.getElementById('brain').textContent), AL = window.AtlasLayout;
const el = document.getElementById('c'), lab = document.getElementById('l');
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); el.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(TH.bg, 24, 52);
const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200); cam.position.set(15, 9, 18);
const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 0.35; ctl.minDistance = 5; ctl.maxDistance = 48;
const ink = new THREE.Color(TH.ink), LM = o => new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: o });
let mode = D.mode;
const ground = new THREE.Group(), rg = new THREE.Group(); scene.add(ground); ground.add(rg);
const ringM = LM(TH.ring), ridgeM = LM(0), orbM = LM(0);
const mk = (pts, m) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
for (let q = 2; q <= 14; q += 2) { const p = []; for (let a = 0; a <= 128; a++) p.push(new THREE.Vector3(Math.cos(a / 64 * Math.PI) * q, 0, Math.sin(a / 64 * Math.PI) * q)); ground.add(mk(p, ringM)); }
const byId = {}, objs = [], geo = new THREE.SphereGeometry(1, 28, 18);
const core = D.nodes.find(n => n.depth === 0);
D.nodes.forEach((n, i) => {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: n.depth === 0 ? TH.ink : n.depth === 1 ? n.color : TH.panel })); m.userData.id = n.id;
  const ol = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: n.depth === 0 ? TH.panel : n.depth === 1 ? TH.ink : n.color, side: THREE.BackSide }));
  ol.scale.setScalar(n.depth === 0 ? 1.08 : n.depth === 1 ? 1.16 : 1.42); m.add(ol); scene.add(m);
  if (n.depth === 0) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: TH.accent })); ring.rotation.x = Math.PI / 2.4; m.add(ring); core.ring = ring; }
  const L = document.createElement('div');
  L.className = n.depth === 0 ? 'c' : n.depth === 1 ? 'b' : 'f';
  if (n.depth === 1) { const k = document.createElement('span'); k.className = 'k'; k.textContent = n.kind; const b = document.createElement('span'); b.className = 'n'; b.textContent = n.name; L.append(k, b); } else L.textContent = n.name;
  lab.appendChild(L);
  const o = { node: n, mesh: m, label: L, pos: new THREE.Vector3(), target: new THREE.Vector3(), s: 0, base: n.depth === 0 ? 0.85 : n.depth === 1 ? 0.42 : Math.max(0.1, 0.17 - (n.depth - 2) * 0.03), born: n.depth * 260 + i * 25 };
  byId[n.id] = o; objs.push(o);
});
const b1 = objs.filter(o => o.node.depth === 1).sort((a, b) => a.node.position - b.node.position), orbs = new THREE.Group(); scene.add(orbs);
b1.forEach((o, i) => { const { R, tilt } = AL.orbitParams(o.node.id, i), p = []; for (let a = 0; a <= 128; a++) { const t = a / 64 * Math.PI; p.push(new THREE.Vector3(Math.cos(t) * R, Math.sin(t) * R * tilt, Math.sin(t) * R)); } orbs.add(mk(p, orbM)); });
const peaks = AL.buildPeaks(D.nodes);
for (let q = 0; q < 46; q++) { const z = -13.6 + q / 45 * 27.2, h = Math.sqrt(Math.max(0, 196 - z * z)), p = []; for (let c = 0; c < 110; c++) { const x = -h + c / 109 * h * 2; p.push(new THREE.Vector3(x, AL.heightAt(peaks, x, z), z)); } rg.add(mk(p, ridgeM)); }
const seg = op => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(objs.length * 18 + 6), 3)); const l = new THREE.LineSegments(g, LM(op)); l.frustumCulled = false; scene.add(l); return l; };
const links = seg(TH.line), drops = seg(0.2);
// Selection: an accent reticle that faces the camera and pulses (the app's overlays.ts), the related set for label dimming.
const reticle = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.6, 64), new THREE.MeshBasicMaterial({ color: TH.accent, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
reticle.visible = false; scene.add(reticle);
const kids = {}; D.nodes.slice().sort((a, b) => a.position - b.position).forEach(n => { if (n.parent) (kids[n.parent] = kids[n.parent] || []).push(n); });
let sel = null, related = null;
function relatedOf(id) {
  const s = new Set(), st = [id];
  for (let o = byId[id]; o; o = byId[o.node.parent]) s.add(o.node.id);
  while (st.length) { const c = st.pop(); s.add(c); (kids[c] || []).forEach(k => st.push(k.id)); }
  return s;
}
let gy = AL.GROUND_Y[mode], K = mode === 'terrain' ? 1 : 0, ov = mode === 'orbit' ? 1 : 0, last = 0;
const t0 = performance.now(), v = new THREE.Vector3();
function size() { r.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); } addEventListener('resize', size); size();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(60, now - (last || now)); last = now; const k = 1 - Math.exp(-dt / 260), age = now - t0;
  gy += (AL.GROUND_Y[mode] - gy) * k; K += ((mode === 'terrain' ? 1 : 0) - K) * k; ov += ((mode === 'orbit' ? 1 : 0) - ov) * k;
  ground.position.y = gy; ringM.opacity = TH.ring * (1 - K * 0.6); ridgeM.opacity = 0.45 * K; rg.scale.y = Math.max(0.001, K); orbM.opacity = 0.22 * ov;
  const T = AL.computeTargets(D.nodes, mode, now);
  for (const o of objs) { const t = T[o.node.id]; if (t) o.target.set(t.x, t.y, t.z); }
  const LP = links.geometry.attributes.position, DP = drops.geometry.attributes.position; let li = 0, di = 0;
  for (const o of objs) {
    if (age < o.born) { o.mesh.visible = false; continue; }
    o.mesh.visible = true; o.pos.lerp(o.target, k); o.s += (1 - o.s) * Math.min(1, k * 1.4); o.mesh.position.copy(o.pos); o.mesh.scale.setScalar(o.base * o.s);
    const p = byId[o.node.parent]; if (p) { LP.setXYZ(li++, p.pos.x, p.pos.y, p.pos.z); LP.setXYZ(li++, o.pos.x, o.pos.y, o.pos.z); }
    if (o.node.depth <= 1) { const g = gy + (K > 0.5 ? AL.heightAt(peaks, o.pos.x, o.pos.z) * K : 0), x = o.pos.x, z = o.pos.z; DP.setXYZ(di++, x, o.pos.y, z); DP.setXYZ(di++, x, g, z); DP.setXYZ(di++, x - 0.22, g, z); DP.setXYZ(di++, x + 0.22, g, z); DP.setXYZ(di++, x, g, z - 0.22); DP.setXYZ(di++, x, g, z + 0.22); }
  }
  LP.needsUpdate = true; DP.needsUpdate = true; links.geometry.setDrawRange(0, li); drops.geometry.setDrawRange(0, di);
  if (core.ring) core.ring.rotation.z += dt * 0.0004;
  ctl.target.lerp((sel || byId[core.id]).pos, k * 0.6); ctl.update();
  reticle.material.opacity += ((sel ? 1 : 0) - reticle.material.opacity) * k; reticle.visible = reticle.material.opacity > 0.01;
  if (sel) { reticle.position.copy(sel.pos); reticle.scale.setScalar(sel.base * 1.4 * (1 + Math.sin(now * 0.004) * 0.05)); reticle.lookAt(cam.position); }
  r.render(scene, cam);
  const boxes = [], W = innerWidth, H = innerHeight;
  for (const o of objs.slice().sort((a, b) => a === sel ? -1 : b === sel ? 1 : a.node.depth - b.node.depth)) {
    if (age < o.born) { o.label.style.opacity = 0; continue; }
    v.copy(o.pos).project(cam); if (v.z > 1) { o.label.style.opacity = 0; continue; }
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, d = o.pos.distanceTo(cam.position), px = o.base * o.s * 28 / Math.max(1, d) * 18 + 8;
    const bw = o.lw || (o.lw = o.label.offsetWidth || 80), bh = o.lh || (o.lh = o.label.offsetHeight || 16), bx = x + px, by = y - bh / 2;
    let op = o.node.depth >= 2 ? Math.max(0.35, Math.min(1, 1.6 - d / 30)) : 1;
    if (related && !related.has(o.node.id)) op *= 0.22;
    o.label.style.color = o === sel && o.node.depth > 0 ? TH.hot : '';
    if (boxes.some(b => bx < b[2] && bx + bw > b[0] && by < b[3] && by + bh > b[1])) op = o.node.depth >= 2 ? 0 : op * 0.15; else boxes.push([bx - 4, by - 2, bx + bw + 4, by + bh + 2]);
    o.label.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)'; o.label.style.opacity = (op * Math.min(1, o.s * 1.5)).toFixed(2);
  }
}
requestAnimationFrame(tick);
const btns = document.querySelectorAll('nav button'), sync = () => btns.forEach(b => b.classList.toggle('on', b.dataset.m === mode));
btns.forEach(b => { b.onclick = () => { mode = b.dataset.m; sync(); }; }); sync();

// Detail card: kind and level, path, name, AI note, MY NOTES, child chips, cross-links. Text only via textContent.
const card = document.getElementById('node-card');
const E = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, fn) => { const b = E('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
function select(id) {
  sel = (id && byId[id]) || null; related = sel ? relatedOf(sel.node.id) : null; ctl.autoRotate = !sel;
  if (!sel) { card.hidden = true; card.replaceChildren(); return; }
  const n = sel.node, path = [];
  for (let p = byId[n.parent]; p; p = byId[p.node.parent]) path.unshift(p.node.name);
  const hd = E('div', 'hd'), dot = E('span', 'dot'); dot.style.background = n.color || TH.accent;
  const x = btn('x', '×', () => select(null)); x.setAttribute('aria-label', 'Close');
  hd.append(dot, E('span', '', (n.depth === 0 ? 'Core idea' : n.kind) + ' · LEVEL ' + n.depth), x);
  card.replaceChildren(hd, E('div', 'p', path.join(' / ') || 'Origin'), E('div', 'nm', n.name), E('div', 'no', n.note || '—'));
  if (n.userNote && n.userNote.trim()) { const s = E('div', 'sec'); s.append(E('div', 'sh', 'MY NOTES'), E('div', 'un', n.userNote)); card.append(s); }
  const ch = kids[n.id] || [];
  if (ch.length) { const w = E('div', 'ch'); ch.forEach(c => w.append(btn('', c.name, () => select(c.id)))); card.append(w); }
  const xl = (D.links || []).map(l => ({ o: byId[l.a === n.id ? l.b : l.b === n.id ? l.a : ''], why: l.why })).filter(q => q.o);
  if (xl.length) {
    const s = E('div', 'sec'); s.append(E('div', 'sh', 'LINKS'));
    xl.forEach(q => { const b = btn('lk', '→ ' + q.o.node.name, () => select(q.o.node.id)); if (q.why) b.append(E('span', '', ' — ' + q.why)); s.append(b); });
    card.append(s);
  }
  card.setAttribute('aria-label', n.name); card.hidden = false; card.scrollTop = 0;
}
// Picking: raycast the fill spheres on a primary-button pointerup that moved less than 5 px since pointerdown (the app's
// CLICK_SLOP; a drag orbits instead). A cancelled pointer (e.g. a touch taken over by the browser) never selects.
const cv = r.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) {
  const b = cv.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1);
  ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(objs.filter(o => o.mesh.visible).map(o => o.mesh), false)[0];
  return h ? h.object.userData.id : null;
}
let down = null;
cv.addEventListener('pointerdown', e => { down = e.button === 0 && e.isPrimary ? [e.clientX, e.clientY] : null; cv.style.cursor = ''; });
cv.addEventListener('pointerup', e => { if (down && e.button === 0 && e.isPrimary && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) select(pick(e)); down = null; });
cv.addEventListener('pointercancel', () => { down = null; });
cv.addEventListener('pointermove', e => { if (!e.buttons && e.pointerType !== 'touch') cv.style.cursor = pick(e) ? 'pointer' : ''; });
addEventListener('keydown', e => { if (e.key === 'Escape' && sel) select(null); });
`;
