
class Component extends DCLogic {
  THEMES = {
    atlas: { name: 'A · Atlas', bg: '#EEEAE0', panel: '#F6F3EC', ink: '#1B1A17', muted: '#5E594F', soft: '#3A3730', faint: '#8A8478', accent: '#E0482B', hot: '#C23A1F', rule: 'rgba(27,26,23,0.4)', rule2: 'rgba(27,26,23,0.14)', shadow5: '5px 5px 0 #1B1A17', shadow3: '3px 3px 0 #1B1A17', line: 0.6, ring: 0.16 },
    observatory: { name: 'B · Observatory', bg: '#0C0E14', panel: '#141822', ink: '#ECE7DA', muted: '#9A968C', soft: '#C9C4B7', faint: '#6C6A64', accent: '#F2A33A', hot: '#F2A33A', rule: 'rgba(236,231,218,0.28)', rule2: 'rgba(236,231,218,0.1)', shadow5: '0 0 0 1px rgba(242,163,58,0.25), 0 20px 60px rgba(0,0,0,0.6)', shadow3: '0 10px 30px rgba(0,0,0,0.5)', line: 0.38, ring: 0.1 },
    blueprint: { name: 'C · Blueprint', bg: '#1F3F8F', panel: '#22479E', ink: '#F2F5FB', muted: '#B7C4E6', soft: '#DCE3F4', faint: '#8FA3D6', accent: '#FFD23F', hot: '#FFD23F', rule: 'rgba(242,245,251,0.5)', rule2: 'rgba(242,245,251,0.18)', shadow5: '5px 5px 0 rgba(10,24,64,0.55)', shadow3: '3px 3px 0 rgba(10,24,64,0.55)', line: 0.7, ring: 0.22 }
  };
  th() { return this.THEMES[this.state && this.state.direction] || this.THEMES.atlas; }
  get INK() { return this.th().ink; }
  get PAPER() { return this.th().panel; }
  get BG() { return this.th().bg; }
  KINDS = { 'Problem': '#E0482B', 'People': '#2F5BD8', 'Mechanism': '#3E8E5A', 'Value': '#D49A1E', 'Risk': '#9B3FB5', 'Next step': '#1A8C8C' };
  AGENTS = [
    { id: 'researcher', name: 'Researcher', color: '#1E7BFF', shape: 'hexagon', icon: 'M9.00 1.20 L2.94 4.70 L2.94 11.70 L9.00 15.20 L15.06 11.70 L15.06 4.70 Z', eyes: 'M4.50 8.2 a2.1 2.1 0 1 0 4.2 0 a2.1 2.1 0 1 0 -4.2 0 Z M9.30 8.2 a2.1 2.1 0 1 0 4.2 0 a2.1 2.1 0 1 0 -4.2 0 Z', eyeFill: '#FFFFFF', pupils: 'M5.50 8.2 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0 Z M10.30 8.2 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0 Z', kinds: ['Problem', 'People'], brief: 'You dig into real pains and specific user segments. Be concrete: who, where, how often.' },
    { id: 'builder', name: 'Builder', color: '#00C46A', shape: 'squircle', icon: 'M5.2 2 H12.8 Q16 2 16 5.2 V10.8 Q16 14 12.8 14 H5.2 Q2 14 2 10.8 V5.2 Q2 2 5.2 2 Z', eyes: 'M5.9 6.4 H12.1 A1.6 1.6 0 0 1 12.1 9.6 H5.9 A1.6 1.6 0 0 1 5.9 6.4 Z', eyeFill: '#FFFFFF', pupils: 'M5.70 8 a0.9 0.9 0 1 0 1.8 0 a0.9 0.9 0 1 0 -1.8 0 Z M10.50 8 a0.9 0.9 0 1 0 1.8 0 a0.9 0.9 0 1 0 -1.8 0 Z', kinds: ['Mechanism'], brief: 'You design how it actually works: features, operations, systems, costs.' },
    { id: 'customer', name: 'Customer', color: '#FF6A00', shape: 'flower', icon: 'M5.70 4.70 a3.3 3.3 0 1 0 6.6 0 a3.3 3.3 0 1 0 -6.6 0 Z M2.18 7.26 a3.3 3.3 0 1 0 6.6 0 a3.3 3.3 0 1 0 -6.6 0 Z M3.53 11.39 a3.3 3.3 0 1 0 6.6 0 a3.3 3.3 0 1 0 -6.6 0 Z M7.87 11.39 a3.3 3.3 0 1 0 6.6 0 a3.3 3.3 0 1 0 -6.6 0 Z M9.22 7.26 a3.3 3.3 0 1 0 6.6 0 a3.3 3.3 0 1 0 -6.6 0 Z M5.00 8.40 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z', eyes: 'M5.8 9 a1.5 1.5 0 0 1 3 0 h-1 a0.5 0.5 0 0 0 -1 0 Z M9.2 9 a1.5 1.5 0 0 1 3 0 h-1 a0.5 0.5 0 0 0 -1 0 Z', eyeFill: '#1B1A17', pupils: '', kinds: ['Value'], brief: 'You speak as the end user. What would make you care, pay, and come back?' },
    { id: 'skeptic', name: 'Skeptic', color: '#141414', shape: 'ghost', icon: 'M3 15 V7.6 A6 6 0 0 1 15 7.6 V15 L13 13.3 L11 15 L9 13.3 L7 15 L5 13.3 Z', eyes: 'M5.3 7.8 h3.4 a1.7 1.7 0 0 1 -3.4 0 Z M9.3 7.8 h3.4 a1.7 1.7 0 0 1 -3.4 0 Z M9.6 5.6 L12.8 4.6 L13 5.4 L9.8 6.4 Z', eyeFill: '#FFFFFF', pupils: 'M6.30 8.6 a0.7 0.7 0 1 0 1.4 0 a0.7 0.7 0 1 0 -1.4 0 Z M10.30 8.6 a0.7 0.7 0 1 0 1.4 0 a0.7 0.7 0 1 0 -1.4 0 Z', kinds: ['Risk'], critic: true, brief: 'You attack weak assumptions. Name specific failure modes and cheap ways to test them.' },
    { id: 'strategist', name: 'Strategist', color: '#8B5CF6', shape: 'star', icon: 'M9.00 0.80 L6.71 5.44 L1.58 6.19 L5.29 9.81 L4.42 14.91 L9.00 12.50 L13.58 14.91 L12.71 9.81 L16.42 6.19 L11.29 5.44 Z', eyes: 'M5.80 8.6 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0 Z M8.80 8.6 a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0 Z', eyeFill: '#FFFFFF', pupils: 'M6.65 8.6 a0.85 0.85 0 1 0 1.7 0 a0.85 0.85 0 1 0 -1.7 0 Z M9.65 8.6 a0.85 0.85 0 1 0 1.7 0 a0.85 0.85 0 1 0 -1.7 0 Z', kinds: ['Next step'], brief: 'You turn ideas into concrete, ordered next moves with clear success signals.' }
  ];
  SEED = this.fromBranches({
    title: 'Tool Library',
    summary: 'A neighborhood library where people borrow drills, ladders and sewing machines instead of books.',
    branches: [
      { name: 'Idle ownership', kind: 'Problem', note: 'Most household tools are used for only a few hours in their lifetime.', children: [{ name: 'Garage clutter' }, { name: 'Cost of one-off jobs' }, { name: 'Duplicate purchases' }] },
      { name: 'Renters & first homes', kind: 'People', note: 'People with small spaces and occasional repair needs.', children: [{ name: 'Apartment renters' }, { name: 'DIY beginners' }, { name: 'Makers on a budget' }] },
      { name: 'Membership lending', kind: 'Mechanism', note: 'Annual membership, an online catalog and one-week loans.', children: [{ name: 'Barcode checkout' }, { name: 'Deposit system' }, { name: 'Pickup lockers' }] },
      { name: 'Skills, not just stuff', kind: 'Value', note: 'Workshops turn borrowing into learning.', children: [{ name: 'Repair cafés' }, { name: 'Weekend classes' }] },
      { name: 'Damage & loss', kind: 'Risk', note: 'Tools come back broken, or not at all.', children: [{ name: 'Insurance pool' }, { name: 'Condition checks' }, { name: 'Late fees' }] },
      { name: 'Pilot shelf', kind: 'Next step', note: 'Start with 50 tools in one community center.', children: [{ name: 'Donation drive' }, { name: 'Partner library' }, { name: 'Sign-up page' }] }
    ]
  }, 1);
  state = { direction: this.props.direction || 'atlas', idea: '', loading: false, status: '', mode: this.props.defaultMode || 'constellation', selected: null, data: this.SEED, history: [], running: false, round: 0, total: 10, phase: null, agentTarget: {}, showPath: true };
  mountRef = React.createRef();
  labelsRef = React.createRef();
  inputRef = React.createRef();
  agentLabelsRef = React.createRef();

  fromBranches(o, plate) {
    const kinds = Object.keys(this.KINDS);
    const nodes = [{ id: 'n0', name: o.title || 'Untitled', note: o.summary || '', kind: 'Core', parent: null, depth: 0, color: this.INK }];
    (o.branches || []).slice(0, 7).forEach((b, i) => {
      const kind = this.KINDS[b.kind] ? b.kind : kinds[i % kinds.length];
      const id = 'b' + i;
      nodes.push({ id, name: b.name, note: b.note || '', kind, parent: 'n0', depth: 1, color: this.KINDS[kind] });
      (b.children || []).slice(0, 5).forEach((c, j) => nodes.push({ id: id + 'c' + j, name: c.name || c, note: c.note || '', kind, parent: id, depth: 2, color: this.KINDS[kind] }));
    });
    return { title: o.title, summary: o.summary, nodes, links: [], log: [], round: 0, plate: plate || 1, created: Date.now() };
  }

  localParse(text) {
    const stop = new Set('that this with from into have will your their about which where when what there they them would could should make like want just more than also some been very app idea for and the are can our out use who how'.split(' '));
    const words = [...new Set((text.toLowerCase().match(/[a-zà-ÿ]{4,}/g) || []).filter(w => !stop.has(w)))];
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const kw = i => words.length ? cap(words[i % words.length]) : '';
    const title = words.slice(0, 3).map(cap).join(' ') || 'Untitled Idea';
    const t = (k, name, note, kids) => ({ name, kind: k, note, children: kids.filter(Boolean).map(n => ({ name: n })) });
    return {
      title, summary: text.trim(),
      branches: [
        t('Problem', 'What hurts today', 'The friction this idea removes.', [kw(0) && kw(0) + ' friction', 'Status quo cost', 'Who complains']),
        t('People', 'Who it serves', 'The first group that would care.', ['Early adopters', kw(1) && kw(1) + ' users', 'Skeptics']),
        t('Mechanism', 'How it works', 'The core loop behind ' + title + '.', [kw(2) && kw(2) + ' engine', 'Input', 'Output']),
        t('Value', 'Why it matters', 'What gets better if it works.', ['Time saved', 'Money saved', kw(3)]),
        t('Risk', 'What could break', 'Assumptions that need testing.', ['Adoption', 'Cost to run', 'Copycats']),
        t('Next step', 'First move', 'The smallest test worth running.', ['Sketch it', 'Talk to 5 people', 'Prototype'])
      ]
    };
  }

  parseJSON(txt) { const a = txt.indexOf('{'), b = txt.lastIndexOf('}'); return JSON.parse(txt.slice(a, b + 1)); }

  async submit() {
    const idea = this.state.idea.trim();
    if (!idea || this.state.loading) return;
    if (this.state.selected) { this.setState({ idea: '' }); return this.expand(idea); }
    this.setState({ loading: true, status: 'Surveying the idea…', selected: null, running: false, agentTarget: {}, phase: null });
    let o;
    try {
      if (!window.claude || !window.claude.complete) throw new Error('no claude');
      const txt = await window.claude.complete({
        max_tokens: 2000,
        system: 'You are a cartographer of ideas. You break an idea into a clear map. Reply with JSON only.',
        messages: [{ role: 'user', content: 'Map this idea: "' + idea + '"\nReturn JSON: {"title": "2-4 word name", "summary": "one plain sentence", "branches": [{"name": "2-4 words", "kind": "Problem|People|Mechanism|Value|Risk|Next step", "note": "one sentence", "children": [{"name": "1-4 words", "note": "one sentence"}]}]}. Give 5-6 branches, use each kind at most once, 2-4 children each.' }]
      });
      o = this.parseJSON(txt);
      if (!o.branches || !o.branches.length) throw new Error('empty');
    } catch (e) { o = this.localParse(idea); }
    const plate = Math.max(1, ...this.state.history.map(h => h.plate || 1)) + 1;
    const data = this.fromBranches(o, plate);
    this.setData(data, true);
    this.setState({ loading: false, status: '', idea: '' });
  }

  async expand(question) {
    const d = this.state.data, sel = d.nodes.find(n => n.id === this.state.selected);
    if (!sel || this.state.loading) return;
    this.setState({ loading: true, status: (question ? 'Asking: ' + question : 'Charting ' + sel.name) + '…' });
    const path = this.pathOf(sel).map(n => n.name).join(' > ');
    let kids;
    try {
      if (!window.claude || !window.claude.complete) throw new Error('no claude');
      const txt = await window.claude.complete({
        max_tokens: 800,
        system: 'You expand one node of an idea map. Reply with JSON only.',
        messages: [{ role: 'user', content: 'Idea: ' + d.title + ' — ' + d.summary + '\nNode: ' + path + (sel.note ? ' (' + sel.note + ')' : '') + '\nExisting children: ' + d.nodes.filter(n => n.parent === sel.id).map(n => n.name).join(', ') + (question ? '\nThe user asks: "' + question + '". Answer by growing this node.' : '') + '\nReturn {"children":[{"name":"1-4 words","note":"one sentence"}]} with 3-4 new, specific sub-ideas.' }]
      });
      kids = this.parseJSON(txt).children;
      if (!kids || !kids.length) throw new Error('empty');
    } catch (e) { kids = [{ name: 'Smallest version' }, { name: 'Who pays' }, { name: 'What breaks' }, { name: 'Proof it works' }]; }
    const stamp = Date.now().toString(36);
    const add = kids.slice(0, 5).map((c, k) => ({ id: sel.id + 'x' + stamp + k, name: c.name, note: c.note || '', kind: sel.depth === 0 ? Object.keys(this.KINDS)[k % 6] : sel.kind, parent: sel.id, depth: sel.depth + 1, color: sel.depth === 0 ? Object.values(this.KINDS)[k % 6] : sel.color }));
    this.setData({ ...d, nodes: d.nodes.concat(add) }, false);
    this.setState({ loading: false, status: '' });
  }

  setData(data, fresh) {
    const hist = [data].concat(this.state.history.filter(h => h.created !== data.created && h.plate !== data.plate)).slice(0, 10);
    try { localStorage.setItem('idea-atlas-history', JSON.stringify(hist)); } catch (e) {}
    this.setState({ data, history: hist }, () => this.buildGraph(fresh));
  }

  deleteSel() {
    const d = this.state.data, id = this.state.selected;
    if (!id || id === 'n0') return;
    if (this.state.confirmDel !== id) { this.setState({ confirmDel: id }); return; }
    const gone = new Set([id]); let grew = true;
    while (grew) { grew = false; d.nodes.forEach(n => { if (!gone.has(n.id) && gone.has(n.parent)) { gone.add(n.id); grew = true; } }); }
    const parent = d.nodes.find(n => n.id === id).parent;
    this.setState({ selected: parent === 'n0' ? null : parent, confirmDel: null });
    this.setData({ ...d, nodes: d.nodes.filter(n => !gone.has(n.id)), links: (d.links || []).filter(l => !gone.has(l.a) && !gone.has(l.b)) }, false);
  }
  slug() { return (this.state.data.title || 'idea').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'idea'; }
  download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  toTree() {
    const d = this.state.data;
    const build = n => ({ name: n.name, kind: n.kind, note: n.note || '', myNote: n.userNote || '', children: d.nodes.filter(c => c.parent === n.id).map(build) });
    const root = d.nodes.find(n => n.depth === 0);
    const nm = id => (d.nodes.find(n => n.id === id) || {}).name;
    return { title: d.title, summary: d.summary, plate: d.plate, branches: build(root).children, links: (d.links || []).map(l => ({ from: nm(l.a), to: nm(l.b), why: l.why, by: l.by })), synthesis: d.synth ? { verdict: d.synth.verdict, brief: d.synth.brief, path: d.synth.path.map(nm).filter(Boolean) } : null };
  }
  downloadJson() { this.download(this.slug() + '.json', JSON.stringify(this.toTree(), null, 2), 'application/json'); }
  downloadMd() {
    const t = this.toTree(), out = ['# ' + t.title, '', t.summary || '', ''];
    const walk = (n, lvl) => {
      if (lvl === 0) { out.push('## ' + n.name + ' (' + n.kind + ')'); if (n.note) out.push('', n.note); out.push(''); }
      else out.push('  '.repeat(lvl - 1) + '- **' + n.name + '**' + (n.note ? ' — ' + n.note : ''));
      if (n.myNote) out.push((lvl === 0 ? '' : '  '.repeat(lvl)) + '> My note: ' + n.myNote.split(String.fromCharCode(10)).join(' '), '');
      n.children.forEach(c => walk(c, lvl + 1));
      if (lvl === 0) out.push('');
    };
    t.branches.forEach(b => walk(b, 0));
    if (t.synthesis) out.push('## Key takeaway', '', '**' + t.synthesis.verdict + '**', '', t.synthesis.brief, '', 'Strongest path: ' + t.synthesis.path.join(' → '), '');
    if (t.links.length) { out.push('## Cross-links', ''); t.links.forEach(l => out.push('- ' + l.from + ' ↔ ' + l.to + (l.why ? ' — ' + l.why : ''))); out.push(''); }
    this.download(this.slug() + '.md', out.join('\n').replace(/\n{3,}/g, '\n\n'), 'text/markdown');
  }
  downloadHtml() {
    const d = this.state.data, t = this.th(), e = s => this.esc(s || ''), S = 'scr' + 'ipt';
    const json = JSON.stringify({ nodes: d.nodes }).replace(/</g, '\\u003c');
    const methods = [this.layout, this.heightAt, this.hash].map(fn => fn.toString().replace(/^function\s+/, '')).join(',\n');
    const css = "html,body{margin:0;height:100%;overflow:hidden;background:" + t.bg + ";color:" + t.ink + ";font-family:'JetBrains Mono',monospace}#c{position:fixed;inset:0;cursor:grab}#l{position:fixed;inset:0;pointer-events:none;overflow:hidden}#l>div{position:absolute;left:0;top:0;white-space:nowrap;will-change:transform}.k{display:block;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:" + t.muted + "}.b{display:block;font-family:'Instrument Serif',serif;font-size:20px;line-height:1}.c{font-family:'Instrument Serif',serif;font-style:italic;font-size:28px}.f{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}header{position:fixed;left:32px;top:28px;max-width:360px;pointer-events:none}header small{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:" + t.muted + "}header h1{font:400 40px/1 'Instrument Serif',serif;margin:6px 0}header p{font:italic 17px/1.3 'Instrument Serif',serif;margin:0;color:" + t.soft + "}nav{position:fixed;right:32px;top:28px;display:flex;border:1px solid " + t.ink + ";background:" + t.panel + "}nav button{font:11px 'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;padding:9px 13px;border:0;border-right:1px solid " + t.ink + ";background:none;color:" + t.ink + ";cursor:pointer}nav button:last-child{border-right:0}nav button.on{background:" + t.ink + ";color:" + t.panel + "}";
    const html = '<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + e(d.title) + ' — Second Brain</title>'
      + '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>' + css + '</style></head><body>'
      + '<div id="c"></div><div id="l"></div><header><small>Second brain № ' + String(d.plate || 1).padStart(3, '0') + '</small><h1>' + e(d.title) + '</h1><p>' + e(d.summary) + '</p></header>'
      + '<nav><button data-m="constellation">Constellation</button><button data-m="orbit">Orbit</button><button data-m="terrain">Terrain</button></nav>'
      + '<' + S + ' type="module">\nimport * as THREE from "https://esm.sh/three@0.160.0";\nimport { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";\n'
      + 'const D = ' + json + ', TH = ' + JSON.stringify(t) + ';\nconst A = { T: THREE, state: { mode: ' + JSON.stringify(this.state.mode) + ' },\n' + methods + ' };\n'
      + this.VIEWER + '</' + S + '></body></html>';
    this.download(this.slug() + '-3d.html', html, 'text/html');
  }
  VIEWER = "\nconst el = document.getElementById('c'), lab = document.getElementById('l');\nconst r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 2)); el.appendChild(r.domElement);\nconst scene = new THREE.Scene(); scene.fog = new THREE.Fog(TH.bg, 24, 52);\nconst cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200); cam.position.set(15, 9, 18);\nconst ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 0.35; ctl.minDistance = 5; ctl.maxDistance = 48;\nconst ink = new THREE.Color(TH.ink), LM = o => new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: o });\nconst ground = new THREE.Group(), rg = new THREE.Group(); scene.add(ground); ground.add(rg); const ringM = LM(TH.ring), ridgeM = LM(0), orbM = LM(0);\nfor (let q = 2; q <= 14; q += 2) { const p = []; for (let a = 0; a <= 128; a++) p.push(new THREE.Vector3(Math.cos(a / 64 * Math.PI) * q, 0, Math.sin(a / 64 * Math.PI) * q)); ground.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), ringM)); }\nconst kids = {}, byId = {}, objs = []; D.nodes.forEach(n => { (kids[n.parent] = kids[n.parent] || []).push(n.id); });\nconst geo = new THREE.SphereGeometry(1, 28, 18);\nD.nodes.forEach((n, i) => {\n  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: n.depth === 0 ? TH.ink : n.depth === 1 ? n.color : TH.panel }));\n  const ol = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: n.depth === 0 ? TH.panel : n.depth === 1 ? TH.ink : n.color, side: THREE.BackSide }));\n  ol.scale.setScalar(n.depth === 0 ? 1.08 : n.depth === 1 ? 1.16 : 1.42); m.add(ol); scene.add(m);\n  if (n.depth === 0) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: TH.accent })); ring.rotation.x = Math.PI / 2.4; m.add(ring); A.ring = ring; }\n  const L = document.createElement('div');\n  L.className = n.depth === 0 ? 'c' : n.depth === 1 ? '' : 'f';\n  if (n.depth === 1) { const k = document.createElement('span'); k.className = 'k'; k.textContent = n.kind; const b = document.createElement('span'); b.className = 'b'; b.textContent = n.name; L.append(k, b); } else L.textContent = n.name;\n  lab.appendChild(L);\n  const o = { node: n, mesh: m, label: L, pos: new THREE.Vector3(), target: new THREE.Vector3(), s: 0, base: n.depth === 0 ? 0.85 : n.depth === 1 ? 0.42 : Math.max(0.1, 0.17 - (n.depth - 2) * 0.03), born: n.depth * 260 + i * 25 };\n  byId[n.id] = o; objs.push(o);\n});\nconst b1 = objs.filter(o => o.node.depth === 1), N = b1.length; const orbs = new THREE.Group(); scene.add(orbs);\nb1.forEach((o, i) => { o.R = 3.6 + i * 1.35; o.tilt = (A.hash(o.node.id + 't') - 0.5) * 0.5; const p = []; for (let a = 0; a <= 128; a++) { const t = a / 64 * Math.PI; p.push(new THREE.Vector3(Math.cos(t) * o.R, Math.sin(t) * o.R * o.tilt, Math.sin(t) * o.R)); } orbs.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), orbM)); });\nA.peaks = [{ x: 0, z: 0, a: 1.7 }].concat(b1.map((o, i) => { const a = i / N * Math.PI * 2 + 0.3, R = i % 2 ? 7.4 : 5.2; return { x: Math.cos(a) * R, z: Math.sin(a) * R, a: 1.5 + (kids[o.node.id] || []).length * 0.55 }; }));\nObject.assign(A, { objs, b1, byId, kids });\nfor (let q = 0; q < 46; q++) { const z = -13.6 + q / 45 * 27.2, h = Math.sqrt(Math.max(0, 196 - z * z)), p = []; for (let c = 0; c < 110; c++) { const x = -h + c / 109 * h * 2; p.push(new THREE.Vector3(x, A.heightAt(x, z), z)); } rg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), ridgeM)); }\nconst seg = op => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(objs.length * 18 + 6), 3)); const l = new THREE.LineSegments(g, LM(op)); l.frustumCulled = false; scene.add(l); return l; };\nconst links = seg(TH.line), drops = seg(0.2);\nlet gy = -5.8, K = 0, ov = 0, last = 0; const t0 = performance.now(), v = new THREE.Vector3();\nfunction size() { r.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); } addEventListener('resize', size); size();\nfunction tick(now) {\n  requestAnimationFrame(tick);\n  const dt = Math.min(60, now - (last || now)); last = now; const k = 1 - Math.exp(-dt / 260), md = A.state.mode, age = now - t0;\n  gy += ((md === 'terrain' ? 0 : md === 'orbit' ? -3.2 : -5.8) - gy) * k; K += ((md === 'terrain' ? 1 : 0) - K) * k; ov += ((md === 'orbit' ? 1 : 0) - ov) * k;\n  ground.position.y = gy; ringM.opacity = TH.ring * (1 - K * 0.6); ridgeM.opacity = 0.45 * K; rg.scale.y = Math.max(0.001, K); orbM.opacity = 0.22 * ov;\n  A.layout(now);\n  const LP = links.geometry.attributes.position, DP = drops.geometry.attributes.position; let li = 0, di = 0;\n  for (const o of objs) {\n    if (age < o.born) { o.mesh.visible = false; continue; }\n    o.mesh.visible = true; o.pos.lerp(o.target, k); o.s += (1 - o.s) * Math.min(1, k * 1.4); o.mesh.position.copy(o.pos); o.mesh.scale.setScalar(o.base * o.s);\n    const p = byId[o.node.parent]; if (p) { LP.setXYZ(li++, p.pos.x, p.pos.y, p.pos.z); LP.setXYZ(li++, o.pos.x, o.pos.y, o.pos.z); }\n    if (o.node.depth <= 1) { const g = gy + (K > 0.5 ? A.heightAt(o.pos.x, o.pos.z) * K : 0), x = o.pos.x, z = o.pos.z; DP.setXYZ(di++, x, o.pos.y, z); DP.setXYZ(di++, x, g, z); DP.setXYZ(di++, x - 0.22, g, z); DP.setXYZ(di++, x + 0.22, g, z); DP.setXYZ(di++, x, g, z - 0.22); DP.setXYZ(di++, x, g, z + 0.22); }\n  }\n  LP.needsUpdate = true; DP.needsUpdate = true; links.geometry.setDrawRange(0, li); drops.geometry.setDrawRange(0, di);\n  if (A.ring) A.ring.rotation.z += dt * 0.0004;\n  ctl.target.lerp(objs[0].pos, k * 0.6); ctl.update(); r.render(scene, cam);\n  const boxes = [], W = innerWidth, H = innerHeight;\n  for (const o of objs.slice().sort((a, b) => a.node.depth - b.node.depth)) {\n    if (age < o.born) { o.label.style.opacity = 0; continue; }\n    v.copy(o.pos).project(cam); if (v.z > 1) { o.label.style.opacity = 0; continue; }\n    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, d = o.pos.distanceTo(cam.position), px = o.base * o.s * 28 / Math.max(1, d) * 18 + 8;\n    const bw = o.lw || (o.lw = o.label.offsetWidth || 80), bh = o.lh || (o.lh = o.label.offsetHeight || 16), bx = x + px, by = y - bh / 2;\n    let op = o.node.depth >= 2 ? Math.max(0.35, Math.min(1, 1.6 - d / 30)) : 1;\n    if (boxes.some(b => bx < b[2] && bx + bw > b[0] && by < b[3] && by + bh > b[1])) op = o.node.depth >= 2 ? 0 : op * 0.15; else boxes.push([bx - 4, by - 2, bx + bw + 4, by + bh + 2]);\n    o.label.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)'; o.label.style.opacity = (op * Math.min(1, o.s * 1.5)).toFixed(2);\n  }\n}\nrequestAnimationFrame(tick);\nconst btns = document.querySelectorAll('nav button'), sync = () => btns.forEach(b => b.classList.toggle('on', b.dataset.m === A.state.mode));\nbtns.forEach(b => { b.onclick = () => { A.state.mode = b.dataset.m; sync(); }; }); sync();\n";
  sleep(ms) { return new Promise(r => setTimeout(r, ms * (this.props.agentSpeed === 'fast' ? 0.35 : 1))); }
  mapText(d) { return d.nodes.map(n => n.id + ' | ' + n.name + ' | ' + n.kind + ' | parent ' + (n.parent || '-')).join('\n'); }
  pickTarget(ag) {
    const nodes = this.state.data.nodes, hits = this.hits;
    const kids = id => nodes.filter(n => n.parent === id).length;
    const ok = n => n.depth >= 1 && n.depth <= 3;
    let pool = nodes.filter(n => ok(n) && ag.kinds.includes(n.kind));
    if (ag.critic && Math.random() < 0.5) pool = nodes.filter(n => ok(n) && n.kind !== 'Risk');
    if (!pool.length) pool = nodes.filter(ok);
    if (!pool.length) return nodes[0];
    return pool.map(n => ({ n, s: n.depth * 1.2 + kids(n.id) * 1.6 + (hits[n.id] || 0) * 2.5 + Math.random() * 1.5 })).sort((a, b) => a.s - b.s)[0].n;
  }
  makeKids(sel, kids, critic, by) {
    const stamp = Date.now().toString(36), ks = Object.keys(this.KINDS);
    return kids.filter(c => c && c.name).slice(0, 4).map((c, k) => {
      const kind = critic ? 'Risk' : sel.depth === 0 ? ks[k % 6] : sel.kind;
      return { id: sel.id + 'x' + stamp + k, name: c.name, note: c.note || '', kind, parent: sel.id, depth: sel.depth + 1, color: this.KINDS[kind] || this.INK, by };
    });
  }
  fallbackRound(ag, target, d) {
    const F = { researcher: [['Who feels it most', 'The group with the sharpest version of this pain.'], ['Evidence to gather', 'What would prove this is real.']], builder: [['Core workflow', 'The steps a user goes through.'], ['Running cost', 'What it costs per user to operate.']], customer: [['Why I would pay', 'The moment it becomes worth money.'], ['Why I would return', 'The habit it builds.']], skeptic: [['Weak assumption', 'The belief this rests on.'], ['Cheap test', 'How to check it this week.']], strategist: [['This week', 'The first concrete move.'], ['Success signal', 'How we know it worked.']] };
    const others = d.nodes.filter(n => n.depth >= 1 && n.id !== target.id && n.parent !== target.id);
    const b = others[Math.floor(Math.random() * others.length)];
    return { thought: 'I expanded ' + target.name + '.', children: F[ag.id].map(([name, note]) => ({ name, note })), links: b && Math.random() < 0.5 ? [{ a: target.id, b: b.id, why: 'Possible connection' }] : [] };
  }
  sp() { return this.props.agentSpeed === 'fast' ? 0.4 : 1; }
  probeOf(id) { return (this.probes || []).find(p => p.a.id === id); }
  walk(p, ids) {
    return new Promise(res => {
      if (!p || !this.byId) return res();
      ids = ids.filter(id => this.byId[id]);
      if (ids.length < 2) { if (ids.length) p.at = ids[0]; return res(); }
      p.route = ids; p.rt = 0; p.done = res;
    });
  }
  arcTo(p, key, b) {
    return new Promise(res => { if (!p) return res(); this.revealing[key] = 0; p.arc = { key, b, start: performance.now(), dur: 1500 * this.sp() }; p.done = res; });
  }
  burst(p) {
    if (!p || !this.T || !p.mesh.visible) return;
    const T = this.T, now = performance.now();
    [0, 170].forEach(delay => { const m = new T.Mesh(this.burstGeo, new T.MeshBasicMaterial({ color: p.a.color, transparent: true, side: T.DoubleSide })); m.position.copy(p.mesh.position); m.visible = false; this.scene.add(m); this.bursts.push({ m, born: now + delay }); });
    p.jump = now;
  }
  async agentRound() {
    if (this.busy) return false;
    this.busy = true; this.hits = this.hits || {}; this.revealing = this.revealing || {};
    const runId = this.state.data.created, alive = () => this.state.data.created === runId && !this.dead;
    const ag = this.AGENTS[(this.state.data.round || 0) % this.AGENTS.length], p = this.probeOf(ag.id);
    try {
      const target = this.pickTarget(ag);
      this.hits[target.id] = (this.hits[target.id] || 0) + 1;
      if (p && this.byId && this.byId.n0) { p.route = null; p.arc = null; p.at = 'n0'; p.mesh.position.copy(this.byId.n0.pos); p.show = true; p.mode = 'travel'; p.tname = target.name; }
      this.setState({ phase: 'plan', agentTarget: { [ag.id]: target.id }, status: ag.name + ' is heading to “' + target.name + '”' });
      await this.sleep(450);
      await this.walk(p, this.pathOf(target).map(n => n.id));
      if (!alive()) return false;
      if (p) { p.mode = 'think'; p.thinking = true; }
      this.setState({ phase: 'diverge', status: ag.name + ' is thinking about “' + target.name + '”' });
      const minThink = this.sleep(1800);
      const d0 = this.state.data;
      let out;
      try {
        if (!window.claude || !window.claude.complete) throw 0;
        const txt = await window.claude.complete({
          max_tokens: 900,
          system: 'You are the ' + ag.name + ' agent on a brainstorming team. ' + ag.brief + ' Reply with JSON only.',
          messages: [{ role: 'user', content: 'Idea: ' + d0.title + ' — ' + d0.summary + '\nMap (id | name | kind | parent):\n' + this.mapText(d0) + '\nExisting cross-links: ' + ((d0.links || []).map(l => l.a + '~' + l.b).join(', ') || 'none') + '\n\nYour target node: ' + target.id + ' (' + target.name + ')' + (target.note ? ' — ' + target.note : '') + '\nReturn {"thought":"one sentence, first person, what you noticed","children":[{"name":"1-4 words","note":"one sentence"}],"links":[{"a":"node id","b":"node id","why":"under 10 words"}]}. Give 2-3 new children for the target that are not already on the map' + (ag.critic ? ', framed as critiques or risks of the target' : '') + '. Give 0-1 links from the target to a node in a different branch, only when the connection is real.' }]
        });
        out = this.parseJSON(txt);
        if (!out.children || !out.children.length) throw 0;
      } catch (e) { out = this.fallbackRound(ag, target, d0); }
      await minThink;
      if (!alive()) return false;
      const d1 = this.state.data;
      if (!d1.nodes.some(n => n.id === target.id)) return true;
      if (p) { p.thinking = false; p.mode = 'spawn'; }
      const add = this.makeKids(target, out.children, ag.critic, ag.id);
      const r = (d1.round || 0) + 1;
      const entry = { agent: ag.id, text: out.thought || ('I expanded ' + target.name + '.'), node: target.id, tag: 'R' + r + ' · +' + add.length };
      this.spawnFrom = p && p.mesh.visible ? p.mesh.position.clone() : null;
      this.burst(p);
      this.setData({ ...d1, nodes: d1.nodes.concat(add), round: r, log: [entry].concat(d1.log || []).slice(0, 80) }, false);
      this.setState({ status: ag.name + ' sprouted ' + add.length + ' ideas on “' + target.name + '”' });
      await this.sleep(1400);
      this.spawnFrom = null;
      if (!alive()) return false;
      const d2 = this.state.data, ids = new Set(d2.nodes.map(n => n.id)), have = new Set((d2.links || []).map(l => [l.a, l.b].sort().join('~')));
      const branchOf = id => { let n = d2.nodes.find(x => x.id === id); while (n && n.depth > 1) n = d2.nodes.find(x => x.id === n.parent); return n && n.id; };
      const fresh = (out.links || []).filter(l => l && ids.has(l.a) && ids.has(l.b) && l.a !== l.b && branchOf(l.a) !== branchOf(l.b) && !have.has([l.a, l.b].sort().join('~'))).slice(0, 2).map(l => ({ a: l.a, b: l.b, why: l.why || '', by: ag.id }));
      this.setState({ phase: 'connect', status: fresh.length ? ag.name + ' spotted a connection…' : ag.name + ' found no new links' });
      for (const l of fresh) {
        if (!alive()) return false;
        const d3 = this.state.data, nm = id => (d3.nodes.find(n => n.id === id) || {}).name;
        if (!nm(l.a) || !nm(l.b)) continue;
        if (p && p.at === l.b) { const t = l.a; l.a = l.b; l.b = t; }
        if (p && p.at !== l.a) { p.mode = 'travel'; p.tname = nm(l.a); await this.walk(p, [p.at, l.a]); }
        const key = l.a + '~' + l.b;
        this.revealing[key] = 0;
        this.setData({ ...d3, links: (d3.links || []).concat([l]), log: [{ agent: ag.id, text: nm(l.a) + ' ↔ ' + nm(l.b) + (l.why ? ': ' + l.why : ''), node: l.a, tag: 'R' + r + ' · link' }].concat(d3.log || []).slice(0, 80) }, false);
        await this.sleep(80);
        if (p) { p.mode = 'link'; p.tname = nm(l.b); }
        await this.arcTo(p, key, l.b);
        delete this.revealing[key];
        this.burst(p);
        await this.sleep(600);
      }
      await this.sleep(fresh.length ? 200 : 700);
      if (p && alive()) {
        p.mode = 'return';
        const cur = this.state.data.nodes.find(n => n.id === p.at);
        if (cur) await this.walk(p, this.pathOf(cur).map(n => n.id).reverse());
      }
      return true;
    } finally {
      if (p) { p.show = false; p.thinking = false; p.route = null; p.arc = null; const d = p.done; p.done = null; if (d) d(); }
      this.busy = false; this.spawnFrom = null;
      if (!this.dead) this.setState({ agentTarget: {} });
    }
  }
  async run() {
    if (this.state.running) { this.setState({ running: false, status: 'Pausing after this round…' }); return; }
    if (this.state.loading || this.busy) return;
    const runId = this.state.data.created;
    this.setState({ running: true, round: 0, selected: null });
    while (this.state.running && this.state.round < this.state.total && this.state.data.created === runId && !this.dead) {
      const ok = await this.agentRound();
      if (!ok) break;
      this.setState(s => ({ round: s.round + 1 }));
    }
    if (this.dead) return;
    const finished = this.state.round >= this.state.total && this.state.data.created === runId;
    this.setState({ running: false, phase: null, status: '' });
    if (finished) await this.synthesize();
  }
  async step() {
    if (this.state.running || this.state.loading || this.busy) return;
    await this.agentRound();
    if (!this.dead) this.setState({ phase: null, status: '' });
  }
  async synthesize() {
    if (this.busy || this.state.loading) return;
    this.busy = true;
    const p = this.probeOf('strategist');
    try {
      const d = this.state.data, runId = d.created;
      if (p && this.byId && this.byId.n0) { p.route = null; p.arc = null; p.at = 'n0'; p.mesh.position.copy(this.byId.n0.pos); p.show = true; p.thinking = true; p.mode = 'think'; p.tname = d.title; }
      this.setState({ phase: 'synthesize', status: 'Strategist is writing the key takeaway…', agentTarget: { strategist: 'n0' } });
      let o = {};
      try {
        if (!window.claude || !window.claude.complete) throw 0;
        const txt = await window.claude.complete({
          max_tokens: 900,
          system: 'You are the Strategist agent. You converge a brainstorm into one clear direction. Reply with JSON only.',
          messages: [{ role: 'user', content: 'Idea: ' + d.title + ' — ' + d.summary + '\nMap (id | name | kind | parent):\n' + this.mapText(d) + '\nCross-links:\n' + ((d.links || []).map(l => l.a + ' ~ ' + l.b + ': ' + l.why).join('\n') || 'none') + '\n\nPick the single strongest node to pursue (prefer a deep, well-supported leaf). Return {"leaf":"node id","verdict":"one sentence direction","brief":"three sentences: why this path, the biggest risk, the first move"}.' }]
        });
        o = this.parseJSON(txt);
      } catch (e) { await this.sleep(1200); }
      if (this.state.data.created !== runId || this.dead) return;
      let d1 = this.state.data;
      let leaf = d1.nodes.find(n => n.id === o.leaf);
      if (!leaf) {
        const linked = new Set((d1.links || []).flatMap(l => [l.a, l.b]));
        const sc = n => n.depth + (linked.has(n.id) ? 1.5 : 0) + (n.kind === 'Next step' ? 0.5 : 0);
        leaf = d1.nodes.slice().sort((a, b) => sc(b) - sc(a))[0];
      }
      const chain = this.pathOf(leaf);
      if (p) { p.thinking = false; p.mode = 'travel'; p.tname = leaf.name; this.setState({ status: 'Strategist is walking the strongest path…' }); await this.walk(p, chain.map(n => n.id)); this.burst(p); }
      if (this.state.data.created !== runId || this.dead) return;
      const synth = { path: chain.map(n => n.id), verdict: o.verdict || ('Pursue ' + leaf.name + '.'), brief: o.brief || ('The map is deepest along ' + chain.map(n => n.name).join(' → ') + '. Test this path before the others.') };
      const entry = { agent: 'strategist', text: synth.verdict, node: leaf.id, tag: 'Takeaway' };
      this.setData({ ...d1, synth, log: [entry].concat(d1.log || []).slice(0, 80) }, false);
      this.setState({ showPath: true, synthClosed: false });
      await this.sleep(1000);
      if (p) { p.mode = 'return'; await this.walk(p, chain.map(n => n.id).reverse()); }
    } finally {
      if (p) { p.show = false; p.thinking = false; p.route = null; const dn = p.done; p.done = null; if (dn) dn(); }
      this.busy = false;
      if (!this.dead) this.setState({ phase: null, status: '', agentTarget: {} });
    }
  }
  styleProbe(p) {
    const t = this.th();
    p.label.style.cssText = 'position:absolute;left:0;top:0;white-space:nowrap;will-change:transform;display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-family:JetBrains Mono,monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;opacity:0;border:1px solid ' + t.ink + ';background:' + t.panel + ';color:' + t.ink;
    p.lastText = null;
  }
  pathOf(n) { const d = this.state.data, out = []; let c = n; while (c) { out.unshift(c); c = d.nodes.find(x => x.id === c.parent); } return out; }
  select(id) {
    if (this.state.noteDirty) this.saveMyNote();
    const n = this.state.data.nodes.find(x => x.id === id);
    this.setState({ selected: id, confirmDel: null, editing: false, myNote: n ? (n.userNote || '') : '', noteDirty: false });
  }
  patchNode(id, patch) {
    const d = this.state.data;
    this.setData({ ...d, title: id === 'n0' && patch.name ? patch.name : d.title, summary: id === 'n0' && patch.note !== undefined ? patch.note : d.summary, nodes: d.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }, false);
  }
  saveMyNote() {
    const id = this.state.selected;
    if (id && this.state.data.nodes.some(n => n.id === id)) this.patchNode(id, { userNote: this.state.myNote || '' });
    this.setState({ noteDirty: false });
  }
  setMode(m) { this.setState({ mode: m }); }
  hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

  componentDidMount() {
    try {
      const h = JSON.parse(localStorage.getItem('idea-atlas-history') || '[]');
      if (h.length) this.setState({ history: h, data: h[0] }); else this.setState({ history: [this.SEED] });
    } catch (e) {}
    this.onDocKey = e => { if (e.key === 'Escape' && this.state.focus) this.setState({ focus: false }); };
    document.addEventListener('keydown', this.onDocKey);
    this.initThree();
  }

  setDirection(dir) { this.setState({ direction: dir }, () => this.applyTheme()); }
  componentDidUpdate(pp) { if (pp.direction !== this.props.direction && this.props.direction) this.setDirection(this.props.direction); }
  applyTheme() {
    if (!this.T) return;
    const t = this.th(), c = new this.T.Color(t.ink);
    this.scene.fog.color.set(t.bg);
    [this.ringMat, this.spokeMat, this.ridgeMat, this.orbitMat, this.links.material, this.drops.material].forEach(m => m.color.copy(c));
    this.links.material.opacity = t.line;
    this.reticle.material.color.set(t.accent);
    this.xMat.color.set(t.accent); this.pathSeg.material.color.set(t.accent); this.beams.material.color.copy(c);
    this.beads.forEach(b => b.material.color.set(t.accent));
    this.probes.forEach(p => this.styleProbe(p)); this.inkFlat.color.copy(c);
    this.buildGraph(false);
  }
  componentWillUnmount() {
    this.dead = true;
    if (this.onDocKey) document.removeEventListener('keydown', this.onDocKey);
    cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    if (this.renderer) { this.renderer.dispose(); this.renderer.domElement.remove(); }
  }

  async initThree() {
    const THREE = await import('https://esm.sh/three@0.160.0');
    const { OrbitControls } = await import('https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js');
    if (this.dead) return;
    this.T = THREE;
    const el = this.mountRef.current;
    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(this.BG, 24, 52);
    const camera = this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(15, 9, 18);
    const controls = this.controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.minDistance = 5; controls.maxDistance = 48;
    controls.autoRotateSpeed = 0.35;
    const ink = new THREE.Color(this.INK);

    this.groundY = -5.5; this.K = 0; this.orbitVis = 0;
    this.ground = new THREE.Group(); scene.add(this.ground);
    const ringMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.16 });
    for (let r = 2; r <= 14; r += 2) {
      const pts = []; for (let a = 0; a <= 128; a++) pts.push(new THREE.Vector3(Math.cos(a / 128 * Math.PI * 2) * r, 0, Math.sin(a / 128 * Math.PI * 2) * r));
      this.ground.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    }
    const spokeMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.07 });
    const sp = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; sp.push(Math.cos(a) * 2, 0, Math.sin(a) * 2, Math.cos(a) * 14, 0, Math.sin(a) * 14); }
    const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.ground.add(new THREE.LineSegments(spG, spokeMat));
    this.ringMat = ringMat; this.spokeMat = spokeMat;

    this.ridges = []; this.ridgeMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0 });
    const ROWS = 46, COLS = 110;
    for (let r = 0; r < ROWS; r++) {
      const z = -13.6 + r / (ROWS - 1) * 27.2;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COLS * 3), 3));
      const line = new THREE.Line(g, this.ridgeMat); line.userData = { z, half: Math.sqrt(Math.max(0, 14 * 14 - z * z)) };
      this.ground.add(line); this.ridges.push(line);
    }
    this.COLS = COLS;

    this.MAX = 3000;
    const mkSeg = (op) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAX * 6), 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: op })); l.frustumCulled = false; scene.add(l); return l; };
    this.links = mkSeg(this.th().line); this.drops = mkSeg(0.2);

    this.orbitRings = new THREE.Group(); scene.add(this.orbitRings);
    this.orbitMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0 });
    this.nodeGroup = new THREE.Group(); scene.add(this.nodeGroup);
    this.sphere = new THREE.SphereGeometry(1, 28, 18);
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.6, 64), new THREE.MeshBasicMaterial({ color: this.th().accent, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
    scene.add(this.reticle);

    this.xMat = new THREE.LineDashedMaterial({ color: this.th().accent, dashSize: 0.28, gapSize: 0.18, transparent: true, opacity: 0.9 });
    this.xGroup = new THREE.Group(); scene.add(this.xGroup); this.xlinks = [];
    this.pathSeg = mkSeg(1); this.pathSeg.material.color.set(this.th().accent);
    this.beams = mkSeg(0.5);
    const beadGeo = new THREE.SphereGeometry(1, 10, 8);
    this.beads = []; for (let i = 0; i < 40; i++) { const b = new THREE.Mesh(beadGeo, new THREE.MeshBasicMaterial({ color: this.th().accent })); b.visible = false; scene.add(b); this.beads.push(b); }
    const rr = (x, y, w, h, r) => { const s = new THREE.Shape(); s.moveTo(x - w / 2 + r, y - h / 2); s.lineTo(x + w / 2 - r, y - h / 2); s.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r); s.lineTo(x + w / 2, y + h / 2 - r); s.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2); s.lineTo(x - w / 2 + r, y + h / 2); s.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r); s.lineTo(x - w / 2, y - h / 2 + r); s.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2); return s; };
    const circ = (x, y, r) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); return s; };
    const rpoly = (pts, rad) => { const s = new THREE.Shape(), n = pts.length; for (let i = 0; i < n; i++) { const pv = pts[(i + n - 1) % n], q = pts[i], nx = pts[(i + 1) % n], d1 = Math.hypot(pv[0] - q[0], pv[1] - q[1]), d2 = Math.hypot(nx[0] - q[0], nx[1] - q[1]), r1 = Math.min(rad, d1 / 2) / d1, r2 = Math.min(rad, d2 / 2) / d2; const a = [q[0] + (pv[0] - q[0]) * r1, q[1] + (pv[1] - q[1]) * r1], b = [q[0] + (nx[0] - q[0]) * r2, q[1] + (nx[1] - q[1]) * r2]; if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]); s.quadraticCurveTo(q[0], q[1], b[0], b[1]); } s.closePath(); return s; };
    const SHAPES = {
      hexagon: () => [rpoly([...Array(6)].map((_, k) => { const a = Math.PI / 2 + k * Math.PI / 3; return [Math.cos(a) * 0.4, Math.sin(a) * 0.4]; }), 0.1)],
      squircle: () => [rr(0, 0, 0.66, 0.6, 0.2)],
      flower: () => [...Array(5)].map((_, k) => { const a = Math.PI / 2 + k * Math.PI * 2 / 5; return circ(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.17); }).concat([circ(0, 0, 0.21)]),
      ghost: () => { const s = new THREE.Shape(); s.moveTo(-0.3, -0.32); s.lineTo(-0.3, 0.04); s.absarc(0, 0.04, 0.3, Math.PI, 0, true); s.lineTo(0.3, -0.32); s.quadraticCurveTo(0.25, -0.2, 0.15, -0.3); s.quadraticCurveTo(0.075, -0.2, 0, -0.32); s.quadraticCurveTo(-0.075, -0.2, -0.15, -0.3); s.quadraticCurveTo(-0.25, -0.2, -0.3, -0.32); return [s]; },
      star: () => [rpoly([...Array(10)].map((_, k) => { const a = Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.22 : 0.44; return [Math.cos(a) * r, Math.sin(a) * r]; }), 0.06)]
    };
    const EYES = {
      hexagon: { w: 0.065, h: 0.15, gap: 0.13, y: 0.01, rot: 0 },
      squircle: { w: 0.08, h: 0.17, gap: 0.16, y: 0.02, rot: 0 },
      flower: { w: 0.06, h: 0.1, gap: 0.1, y: 0.01, rot: 0 },
      ghost: { w: 0.07, h: 0.15, gap: 0.14, y: 0.06, rot: 0 },
      star: { w: 0.05, h: 0.11, gap: 0.09, y: 0.0, rot: 0 }
    };
    this.inkFlat = new THREE.MeshBasicMaterial({ color: ink, side: THREE.DoubleSide });
    this.burstGeo = new THREE.RingGeometry(0.92, 1, 48); this.bursts = [];
    const bubOut = new THREE.ShapeGeometry(rr(0, 0, 0.5, 0.23, 0.115), 8), bubIn = new THREE.ShapeGeometry(rr(0, 0, 0.46, 0.19, 0.095), 8), dotGeo = new THREE.CircleGeometry(0.03, 12);
    const white = new THREE.MeshBasicMaterial({ color: '#FFFFFF', side: THREE.DoubleSide }), dark = new THREE.MeshBasicMaterial({ color: '#1B1A17', side: THREE.DoubleSide });
    const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
    const makeEyes = (shape, body) => {
      const eyes = [], pupils = [];
      const g = (x, y) => { const e = new THREE.Group(); e.position.set(x, y, 0.01); body.add(e); eyes.push(e); return e; };
      const pupil = (e, r, x, y) => { const pu = mk(new THREE.CircleGeometry(r, 16), dark, x, y, 0.005); pu.userData.bx = x; pu.userData.by = y; e.add(pu); pupils.push(pu); return pu; };
      if (shape === 'hexagon') {
        [-1, 1].forEach(s => { const e = g(s * 0.115, 0.03); e.add(mk(new THREE.CircleGeometry(0.095, 28), white, 0, 0, 0)); const pu = pupil(e, 0.05, 0, 0); pu.add(mk(new THREE.CircleGeometry(0.016, 10), white, 0.018, 0.018, 0.004)); });
      } else if (shape === 'squircle') {
        const e = g(0, 0.05); e.add(mk(new THREE.ShapeGeometry(rr(0, 0, 0.46, 0.15, 0.075), 8), white, 0, 0, 0));
        pupil(e, 0.042, -0.12, 0); pupil(e, 0.042, 0.12, 0);
      } else if (shape === 'flower') {
        [-1, 1].forEach(s => { const e = g(s * 0.085, 0.03); e.add(mk(new THREE.RingGeometry(0.034, 0.058, 20, 1, 0, Math.PI), dark, 0, 0, 0)); });
        body.add(mk(new THREE.RingGeometry(0.03, 0.048, 16, 1, Math.PI, Math.PI), dark, 0, -0.06, 0.01));
      } else if (shape === 'ghost') {
        [-1, 1].forEach(s => { const e = g(s * 0.1, 0.06); e.add(mk(new THREE.CircleGeometry(0.075, 24, Math.PI, Math.PI), white, 0, 0, 0)); pupil(e, 0.03, 0, -0.035); });
        const brow = mk(new THREE.ShapeGeometry(rr(0, 0, 0.13, 0.032, 0.016), 6), white, 0.11, 0.16, 0.01); brow.rotation.z = 0.35; body.add(brow);
      } else {
        [-1, 1].forEach(s => { const e = g(s * 0.075, 0.0); e.add(mk(new THREE.CircleGeometry(0.062, 20), white, 0, 0, 0)); pupil(e, 0.032, 0, 0); });
      }
      return { eyes, pupils };
    };
    this.probes = this.AGENTS.map((a, i) => {
      const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
      const mat = new THREE.MeshBasicMaterial({ color: a.color, side: THREE.DoubleSide });
      SHAPES[a.shape]().forEach(sh => body.add(new THREE.Mesh(new THREE.ShapeGeometry(sh, 24), mat)));
      const { eyes, pupils } = makeEyes(a.shape, body);
      const bubble = new THREE.Group(); bubble.position.set(0.26, 0.6, 0.02); bubble.visible = false; body.add(bubble);
      bubble.add(new THREE.Mesh(bubOut, this.inkFlat)); const bi = new THREE.Mesh(bubIn, white); bi.position.z = 0.005; bubble.add(bi);
      const dots = [-1, 0, 1].map(j => { const d = new THREE.Mesh(dotGeo, this.inkFlat); d.position.set(j * 0.11, 0, 0.01); bubble.add(d); return d; });
      g.visible = false; g.scale.setScalar(0.001); scene.add(g);
      const label = document.createElement('div'); this.agentLabelsRef.current.appendChild(label);
      const p = { a, mesh: g, body, eyes, pupils, bubble, dots, vis: 0, label }; this.styleProbe(p); return p;
    });
    this.raycaster = new THREE.Raycaster(); this.ptr = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.ptr, camera);
      const hit = this.raycaster.intersectObjects(this.objs.map(o => o.mesh), false)[0];
      return hit ? hit.object.userData.id : null;
    };
    renderer.domElement.addEventListener('pointerdown', e => { this.down = [e.clientX, e.clientY]; el.style.cursor = 'grabbing'; });
    renderer.domElement.addEventListener('pointerup', e => {
      el.style.cursor = 'grab';
      if (this.down && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 5) this.select(pick(e));
    });
    renderer.domElement.addEventListener('pointermove', e => { if (e.buttons) return; this.hovered = pick(e); el.style.cursor = this.hovered ? 'pointer' : 'grab'; });

    const size = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); this.W = w; this.H = h; };
    this.ro = new ResizeObserver(size); this.ro.observe(el); size();
    this.buildGraph(true);
    this.raf = requestAnimationFrame(this.tick);
  }

  buildGraph(fresh) {
    if (!this.T) return;
    const THREE = this.T, nodes = this.state.data.nodes;
    const old = {}; (this.objs || []).forEach(o => { old[o.node.id] = o; });
    this.nodeGroup.clear();
    while (this.orbitRings.children.length) { const c = this.orbitRings.children[0]; c.geometry.dispose(); this.orbitRings.remove(c); }
    const labels = this.labelsRef.current; labels.innerHTML = '';
    const now = performance.now();
    this.byId = {}; this.kids = {};
    nodes.forEach(n => { (this.kids[n.parent] = this.kids[n.parent] || []).push(n.id); });
    let newCount = 0;
    this.objs = nodes.map((n, i) => {
      const prev = !fresh && old[n.id];
      const fill = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: n.depth === 0 ? this.INK : n.depth === 1 ? n.color : this.PAPER }));
      const outline = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: n.depth === 0 ? this.PAPER : n.depth === 1 ? this.INK : n.color, side: THREE.BackSide }));
      outline.scale.setScalar(n.depth === 0 ? 1.08 : n.depth === 1 ? 1.16 : 1.42);
      fill.add(outline); fill.userData.id = n.id;
      if (n.depth === 0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: this.th().accent }));
        ring.rotation.x = Math.PI / 2.4; fill.add(ring); this.coreRing = ring;
      }
      this.nodeGroup.add(fill);
      const lab = document.createElement('div');
      const base = 'position:absolute;left:0;top:0;white-space:nowrap;will-change:transform;color:' + this.INK + ';';
      if (n.depth === 0) lab.style.cssText = base + "font-family:'Instrument Serif',serif;font-style:italic;font-size:19px;line-height:1;padding:3px 10px 4px;border-radius:999px;background:" + this.th().accent + ";border:1px solid " + this.INK + ";";
      else if (n.depth === 1) lab.innerHTML = '<div style="font-family:JetBrains Mono,monospace;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:' + this.th().muted + '">' + n.kind + '</div><div style="font-family:Instrument Serif,serif;font-size:20px;line-height:1">' + this.esc(n.name) + '</div>', lab.style.cssText = base;
      else lab.style.cssText = base + "font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;";
      if (n.depth !== 1) lab.textContent = n.name;
      labels.appendChild(lab);
      const parentObj = this.byId[n.parent];
      const start = prev ? prev.pos.clone() : (!fresh && this.spawnFrom) ? this.spawnFrom.clone() : parentObj ? parentObj.pos.clone() : new THREE.Vector3();
      const o = { node: n, mesh: fill, label: lab, pos: start, target: new THREE.Vector3(), s: prev ? prev.s : 0, base: n.depth === 0 ? 0.85 : n.depth === 1 ? 0.42 : Math.max(0.1, 0.17 - (n.depth - 2) * 0.03), born: prev ? 0 : fresh ? now + n.depth * 260 + i * 25 : now + (newCount++) * 160 };
      this.byId[n.id] = o;
      return o;
    });
    this.b1 = this.objs.filter(o => o.node.depth === 1);
    this.b1.forEach((o, i) => {
      const R = 3.6 + i * 1.35, tilt = (this.hash(o.node.id + 't') - 0.5) * 0.5, pts = [];
      for (let a = 0; a <= 128; a++) { const t = a / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * R, Math.sin(t) * R * tilt, Math.sin(t) * R)); }
      o.R = R; o.tilt = tilt;
      this.orbitRings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.orbitMat));
    });
    const n = this.b1.length;
    this.peaks = [{ x: 0, z: 0, a: 1.7 }].concat(this.b1.map((o, i) => { const a = i / n * Math.PI * 2 + 0.3, R = i % 2 ? 7.4 : 5.2; return { x: Math.cos(a) * R, z: Math.sin(a) * R, a: 1.5 + (this.kids[o.node.id] || []).length * 0.55 }; }));
    this.xlinks.forEach(x => { x.line.geometry.dispose(); this.xGroup.remove(x.line); });
    this.xlinks = (this.state.data.links || []).filter(l => this.byId[l.a] && this.byId[l.b]).map(l => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 3), 3));
      const line = new THREE.Line(g, this.xMat); line.frustumCulled = false; this.xGroup.add(line); return { l, line };
    });
  }

  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  heightAt(x, z) { let h = 0; for (const p of this.peaks) { const d2 = (x - p.x) ** 2 + (z - p.z) ** 2; h += p.a * Math.exp(-d2 / 4.2); } return h; }

  layout(t) {
    const THREE = this.T, mode = this.state.mode, n = this.b1.length;
    this.objs[0].target.set(0, mode === 'terrain' ? this.heightAt(0, 0) + 0.9 : 0, 0);
    this.b1.forEach((o, i) => {
      if (mode === 'constellation') {
        const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996 + 0.6;
        o.target.set(Math.cos(th) * r * 6.8, y * 4.4, Math.sin(th) * r * 6.8);
      } else if (mode === 'orbit') {
        const a = i * 2.39996 + t * 0.00011 * (8 / o.R);
        o.target.set(Math.cos(a) * o.R, Math.sin(a) * o.R * o.tilt, Math.sin(a) * o.R);
      } else {
        const p = this.peaks[i + 1]; o.target.set(p.x, this.heightAt(p.x, p.z) + 0.55, p.z);
      }
    });
    const u = new THREE.Vector3(), v = new THREE.Vector3(), out = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const o of this.objs) {
      if (o.node.depth < 2) continue;
      const p = this.byId[o.node.parent], gp = this.byId[p.node.parent];
      out.copy(p.target).sub(gp.target); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
      u.crossVectors(out, Math.abs(out.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize(); v.crossVectors(out, u).normalize();
      const sib = this.kids[p.node.id], k = sib.indexOf(o.node.id), m = sib.length;
      const ang = k / m * Math.PI * 2 + this.hash(p.node.id) * 6.28;
      const r = 2.2 * Math.pow(0.72, o.node.depth - 2);
      const dir = out.clone().multiplyScalar(0.9).addScaledVector(u, Math.cos(ang) * 0.9).addScaledVector(v, Math.sin(ang) * 0.9).normalize();
      o.target.copy(p.target).addScaledVector(dir, r);
      if (mode === 'terrain') o.target.y = Math.max(o.target.y * 0.25 + this.heightAt(o.target.x, o.target.z) * 0.75, this.heightAt(o.target.x, o.target.z) + 0.2);
    }
  }

  tick = (now) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(60, now - (this.last || now)); this.last = now;
    const k = 1 - Math.exp(-dt / 260);
    const mode = this.state.mode, sel = this.state.selected;
    this.controls.autoRotate = (this.props.autoRotate ?? true) && !sel;
    this.groundY += ((mode === 'terrain' ? 0 : mode === 'orbit' ? -3.2 : -5.8) - this.groundY) * k;
    this.K += ((mode === 'terrain' ? 1 : 0) - this.K) * k;
    this.orbitVis += ((mode === 'orbit' ? 1 : 0) - this.orbitVis) * k;
    this.ground.position.y = this.groundY;
    this.ringMat.opacity = this.th().ring * (1 - this.K * 0.6);
    this.ridgeMat.opacity = 0.45 * this.K;
    this.orbitMat.opacity = 0.22 * this.orbitVis;
    if (this.K > 0.003) {
      for (const line of this.ridges) {
        const a = line.geometry.attributes.position, { z, half } = line.userData;
        for (let c = 0; c < this.COLS; c++) { const x = -half + c / (this.COLS - 1) * half * 2; a.setXYZ(c, x, this.heightAt(x, z) * this.K, z); }
        a.needsUpdate = true;
      }
    }
    this.layout(now);
    const sub = new Set();
    if (sel && this.byId[sel]) { let c = this.byId[sel]; while (c) { sub.add(c.node.id); c = this.byId[c.node.parent]; } const walk = id => { sub.add(id); (this.kids[id] || []).forEach(walk); }; walk(sel); }
    const L = this.links.geometry.attributes.position, D = this.drops.geometry.attributes.position;
    let li = 0, di = 0; const showDrops = this.props.dropLines ?? true;
    for (const o of this.objs) {
      if (now < o.born) { o.mesh.visible = false; o.label.style.opacity = 0; continue; }
      o.mesh.visible = true;
      o.pos.lerp(o.target, k);
      o.s += (1 - o.s) * Math.min(1, k * 1.4);
      const hov = this.hovered === o.node.id || sel === o.node.id;
      o.mesh.position.copy(o.pos);
      o.mesh.scale.setScalar(o.base * o.s * (hov ? 1.3 : 1));
      const p = this.byId[o.node.parent];
      if (p && li < this.MAX) { L.setXYZ(li * 2, p.pos.x, p.pos.y, p.pos.z); L.setXYZ(li * 2 + 1, o.pos.x, o.pos.y, o.pos.z); li++; }
      if (showDrops && o.node.depth <= 1 && di < this.MAX - 3) {
        const gy = this.groundY + (this.K > 0.5 ? this.heightAt(o.pos.x, o.pos.z) * this.K : 0), x = o.pos.x, z = o.pos.z;
        D.setXYZ(di * 2, x, o.pos.y, z); D.setXYZ(di * 2 + 1, x, gy, z); di++;
        D.setXYZ(di * 2, x - 0.22, gy, z); D.setXYZ(di * 2 + 1, x + 0.22, gy, z); di++;
        D.setXYZ(di * 2, x, gy, z - 0.22); D.setXYZ(di * 2 + 1, x, gy, z + 0.22); di++;
      }
    }
    L.needsUpdate = true; this.links.geometry.setDrawRange(0, li * 2);
    D.needsUpdate = true; this.drops.geometry.setDrawRange(0, di * 2);
    const ctrl = new this.T.Vector3(), outv = new this.T.Vector3();
    for (const x of this.xlinks) {
      const a = this.byId[x.l.a], b = this.byId[x.l.b], vis = now >= a.born && now >= b.born;
      x.line.visible = vis; if (!vis) continue;
      const p0 = a.pos, p2 = b.pos, dist = p0.distanceTo(p2);
      ctrl.addVectors(p0, p2).multiplyScalar(0.5); outv.set(ctrl.x, 0, ctrl.z); if (outv.lengthSq() < 0.01) outv.set(1, 0, 0); outv.normalize();
      ctrl.addScaledVector(outv, dist * 0.22); ctrl.y += dist * 0.2;
      const XP = x.line.geometry.attributes.position;
      for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; XP.setXYZ(i, u * u * p0.x + 2 * u * t * ctrl.x + t * t * p2.x, u * u * p0.y + 2 * u * t * ctrl.y + t * t * p2.y, u * u * p0.z + 2 * u * t * ctrl.z + t * t * p2.z); }
      XP.needsUpdate = true; x.line.computeLineDistances();
      const rv = this.revealing && this.revealing[x.l.a + '~' + x.l.b];
      x.line.geometry.setDrawRange(0, rv === undefined ? 25 : Math.max(2, Math.ceil(rv * 25)));
    }
    const synth = this.state.data.synth, path = this.state.showPath && synth ? synth.path.filter(id => this.byId[id] && now >= this.byId[id].born) : [];
    const pathSet = new Set(path), PS = this.pathSeg.geometry.attributes.position; let pi = 0, bi = 0;
    for (let i = 1; i < path.length; i++) {
      const a = this.byId[path[i - 1]].pos, b = this.byId[path[i]].pos;
      PS.setXYZ(pi++, a.x, a.y, a.z); PS.setXYZ(pi++, b.x, b.y, b.z);
      for (let j = 0; j < 5 && bi < this.beads.length; j++) { const bd = this.beads[bi++]; bd.visible = true; bd.position.lerpVectors(a, b, (now * 0.0005 + j / 5) % 1); bd.scale.setScalar(0.075); }
    }
    for (; bi < this.beads.length; bi++) this.beads[bi].visible = false;
    PS.needsUpdate = true; this.pathSeg.geometry.setDrawRange(0, pi);
    const want = new this.T.Vector3(), sp = this.sp();
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i], age = (now - b.born) / 800;
      if (age < 0) { b.m.visible = false; continue; }
      if (age >= 1) { this.scene.remove(b.m); b.m.material.dispose(); this.bursts.splice(i, 1); continue; }
      b.m.visible = true; b.m.quaternion.copy(this.camera.quaternion); b.m.scale.setScalar(0.2 + age * 1.5); b.m.material.opacity = (1 - age) * 0.9;
    }
    this.probes.forEach((p, i) => {
      p.vis += ((p.show ? 1 : 0) - p.vis) * Math.min(1, k * (p.show ? 1.8 : 2.6));
      p.mesh.visible = p.vis > 0.01;
      if (!p.mesh.visible) { p.working = false; return; }
      if (p.route) {
        p.rt += dt / (600 * sp);
        const r = p.route, seg = Math.floor(p.rt);
        if (seg >= r.length - 1 || !r.every(id => this.byId[id])) { p.at = r[r.length - 1]; p.route = null; const d = p.done; p.done = null; if (d) d(); }
        else { const a = this.byId[r[seg]].pos, b = this.byId[r[seg + 1]].pos, fr = p.rt - seg, e = fr * fr * (3 - 2 * fr); p.mesh.position.lerpVectors(a, b, e); p.mesh.position.y += 0.8 + Math.sin(fr * Math.PI) * 0.8; }
      } else if (p.arc) {
        const pr = Math.min(1, (now - p.arc.start) / p.arc.dur), x = this.xlinks.find(x => x.l.a + '~' + x.l.b === p.arc.key);
        this.revealing[p.arc.key] = pr;
        if (x) { const XP = x.line.geometry.attributes.position, idx = pr * 24, i0 = Math.min(24, Math.floor(idx)), i1 = Math.min(24, i0 + 1), fr = idx - i0; p.mesh.position.set(XP.getX(i0) + (XP.getX(i1) - XP.getX(i0)) * fr, XP.getY(i0) + (XP.getY(i1) - XP.getY(i0)) * fr + 0.6, XP.getZ(i0) + (XP.getZ(i1) - XP.getZ(i0)) * fr); }
        if (pr >= 1) { p.at = p.arc.b; p.arc = null; const d = p.done; p.done = null; if (d) d(); }
      } else {
        const at = p.at && this.byId[p.at];
        if (at) { const rad = p.thinking ? 0.55 : 0.25; want.set(at.pos.x + Math.cos(now * 0.0022 + i) * rad, at.pos.y + 0.85 + Math.sin(now * 0.004 + i) * 0.08, at.pos.z + Math.sin(now * 0.0022 + i) * rad); p.mesh.position.lerp(want, Math.min(1, k * 1.2)); }
      }
      p.mesh.quaternion.copy(this.camera.quaternion);
      const pop = p.vis * (1 + 0.25 * Math.sin(Math.min(1, p.vis) * Math.PI));
      p.mesh.scale.setScalar(pop * 1.15);
      const bob = Math.sin(now * (p.route ? 0.02 : 0.01) + i * 1.7);
      const ja = p.jump ? (now - p.jump) / 520 : 2, jump = ja < 1 ? Math.sin(ja * Math.PI) : 0;
      p.body.position.y = 0.04 * bob + jump * 0.35;
      p.body.scale.set(1 + 0.05 * bob - jump * 0.08, 1 - 0.06 * bob + jump * 0.14, 1);
      p.body.rotation.z = p.route ? Math.sin(now * 0.02 + i) * 0.18 : Math.sin(now * 0.006 + i) * 0.1;
      const blink = ((now + i * 1370) % 3600) < 130 ? 0.15 : 1;
      p.eyes.forEach(e => { e.scale.y = blink; });
      const lx = Math.sin(now * 0.0011 + i * 2) * 0.018, ly = Math.cos(now * 0.0009 + i) * 0.01;
      p.pupils.forEach(pu => { pu.position.x = pu.userData.bx + lx; pu.position.y = pu.userData.by + ly; });
      p.bubble.visible = !!p.thinking;
      if (p.thinking) p.dots.forEach((d, j) => { const s = Math.max(0, Math.sin(now * 0.008 - j * 0.9)); d.scale.setScalar(0.7 + s * 0.6); d.position.y = s * 0.03; });
      p.working = true;
      return;
    });
    this.beams.geometry.setDrawRange(0, 0);
    if (this.coreRing) this.coreRing.rotation.z += dt * 0.0004;
    const so = sel && this.byId[sel];
    this.reticle.material.opacity += ((so ? 1 : 0) - this.reticle.material.opacity) * k;
    if (so) { this.reticle.position.copy(so.pos); this.reticle.scale.setScalar(so.base * 1.4 * (1 + Math.sin(now * 0.004) * 0.05)); this.reticle.lookAt(this.camera.position); }
    const focus = so ? so.pos : this.objs[0].pos;
    this.controls.target.lerp(focus, k * 0.6);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const labelsMode = this.props.labels || 'all', v = new this.T.Vector3(), cam = this.camera.position;
    const order = this.objs.filter(o => now >= o.born).sort((a, b) => (a.node.id === sel ? -1 : b.node.id === sel ? 1 : a.node.depth - b.node.depth));
    const boxes = [];
    for (const o of order) {
      v.copy(o.pos).project(this.camera);
      const hidden = v.z > 1 || (labelsMode === 'branches' && o.node.depth >= 2 && !sub.has(o.node.id));
      if (hidden) { o.label.style.opacity = 0; continue; }
      const x = (v.x + 1) / 2 * this.W, y = (1 - v.y) / 2 * this.H;
      const px = o.base * o.s * 28 / Math.max(1, o.pos.distanceTo(cam)) * 18 + 8;
      o.label.style.transform = 'translate(' + (x + px).toFixed(1) + 'px,' + y.toFixed(1) + 'px) translateY(-50%)';
      let op = o.node.depth >= 2 ? Math.max(0.35, Math.min(1, 1.6 - o.pos.distanceTo(cam) / 30)) : 1;
      if (sel && !sub.has(o.node.id)) op *= 0.22;
      const bw = o.lw || (o.lw = o.label.offsetWidth || 80), bh = o.lh || (o.lh = o.label.offsetHeight || 16);
      const bx = x + px, by = y - bh / 2;
      if (boxes.some(b => bx < b[2] && bx + bw > b[0] && by < b[3] && by + bh > b[1])) op = o.node.depth >= 2 ? 0 : op * 0.15;
      else boxes.push([bx - 4, by - 2, bx + bw + 4, by + bh + 2]);
      o.label.style.opacity = (op * Math.min(1, o.s * 1.5)).toFixed(2);
      o.label.style.color = o.node.depth === 0 ? '#1B1A17' : (this.hovered === o.node.id || sel === o.node.id || pathSet.has(o.node.id)) ? this.th().hot : this.INK;
    }
    for (const p of this.probes) {
      v.copy(p.mesh.position).project(this.camera);
      if (v.z > 1 || !p.working) { p.label.style.opacity = 0; continue; }
      const verb = { travel: 'heading to ', think: 'thinking about ', spawn: 'sprouting ideas on ', link: 'linking to ', return: 'heading home' }[p.mode] || '';
      const text = p.a.name + ' · ' + verb + (p.mode === 'return' ? '' : (p.tname || ''));
      if (p.lastText !== text) { p.lastText = text; p.label.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + p.a.color + ';border:1px solid ' + this.INK + '"></span>' + this.esc(text); }
      p.label.style.opacity = 1;
      p.label.style.transform = 'translate(' + ((v.x + 1) / 2 * this.W + 12).toFixed(1) + 'px,' + ((1 - v.y) / 2 * this.H - 28).toFixed(1) + 'px)';
    }
  };

  renderVals() {
    const d = this.state.data, s = this.state, sel = d.nodes.find(n => n.id === s.selected);
    const MODES = [['constellation', 'Constellation'], ['orbit', 'Orbit'], ['terrain', 'Terrain']];
    const modes = MODES.map(([id, label]) => ({ label, check: s.mode === id ? '●' : '', bg: s.mode === id ? this.th().bg : 'transparent', fg: this.INK, onClick: () => this.setState({ mode: id, openMenu: null }) }));
    const om = s.openMenu, onBtn = k => ({ bg: om === k ? this.INK : this.PAPER, fg: om === k ? this.PAPER : this.INK, muted: om === k ? this.th().faint : this.th().muted });
    const vb = onBtn('view'), db = onBtn('design'), sb = onBtn('settings');
    const pad = n => String(n).padStart(3, '0');
    return {
      t: this.th(),
      directions: Object.keys(this.THEMES).map(id => ({ label: this.THEMES[id].name.replace(/^[A-C] · /, ''), swatch: this.THEMES[id].bg, check: s.direction === id ? '●' : '', bg: s.direction === id ? this.th().bg : 'transparent', fg: this.INK, onClick: () => { this.setDirection(id); this.setState({ openMenu: null }); } })),
      viewOpen: om === 'view', designOpen: om === 'design',
      viewLabel: (MODES.find(m => m[0] === s.mode) || MODES[0])[1], designLabel: this.th().name.replace(/^[A-C] · /, ''),
      viewCaret: om === 'view' ? '▴' : '▾', designCaret: om === 'design' ? '▴' : '▾',
      viewBg: vb.bg, viewFg: vb.fg, viewMuted: vb.muted, designBg: db.bg, designFg: db.fg, designMuted: db.muted,
      openView: () => this.setState({ openMenu: om === 'view' ? null : 'view' }),
      openDesign: () => this.setState({ openMenu: om === 'design' ? null : 'design' }),
      sideHidden: !!s.sideHidden, sideShown: !s.sideHidden, toggleSide: () => this.setState({ sideHidden: !s.sideHidden, menuOpen: false }),
      inputTag: sel ? 'Ask node' : 'New brain',
      placeholder: sel ? 'Ask a follow-up about “' + sel.name + '” to grow it…' : 'Type an idea — a startup, a story, a plan…',
      mountRef: this.mountRef, labelsRef: this.labelsRef,
      title: d.title, summary: d.summary, plateNo: pad(d.plate || 1),
      branches: d.nodes.filter(n => n.depth === 1).map(n => ({ name: n.name, kind: n.kind, color: n.color, onClick: () => this.select(n.id) })),
      menuOpen: !!s.menuOpen, menuCaret: s.menuOpen ? '▴' : '▾',
      toggleMenu: () => this.setState({ menuOpen: !s.menuOpen }),
      newBrain: () => { this.setState({ menuOpen: false, selected: null, idea: '' }); setTimeout(() => this.inputRef.current && this.inputRef.current.focus(), 0); },
      inputRef: this.inputRef,
      history: s.history.map(h => ({ no: pad(h.plate || 1), title: h.title, count: h.nodes.length + ' nodes', bg: h.created === d.created ? this.BG : 'transparent', onClick: () => this.setState({ data: h, selected: null, menuOpen: false, running: false, agentTarget: {}, phase: null }, () => this.buildGraph(true)) })),
      modes,
      hasSel: !!sel,
      selName: sel ? sel.name : '', selNote: sel ? (sel.note || '—') : '',
      selKind: sel ? (sel.depth === 0 ? 'Core idea' : sel.kind + ' · level ' + sel.depth + (sel.by ? ' · by ' + sel.by : '')) : '',
      selColor: sel ? sel.color : this.INK,
      selPath: sel ? this.pathOf(sel).slice(0, -1).map(n => n.name).join(' / ') || 'Origin' : '',
      selChildren: sel ? d.nodes.filter(n => n.parent === sel.id).map(n => ({ name: n.name, onClick: () => this.select(n.id) })) : [],
      hasSelChildren: !!sel && d.nodes.some(n => n.parent === sel.id),
      clearSel: () => this.select(null),
      expand: () => this.expand(),
      canDelete: !!sel && sel.depth > 0,
      deleteSel: () => this.deleteSel(),
      deleteLabel: sel && s.confirmDel === sel.id ? 'Confirm?' : 'Delete',
      downloadMd: () => this.downloadMd(),
      downloadJson: () => this.downloadJson(),
      downloadHtml: () => this.downloadHtml(),
      expandLabel: s.loading ? 'Charting…' : 'Expand this node →',
      idea: s.idea,
      status: (s.running ? 'Round ' + Math.min(s.round + 1, s.total) + '/' + s.total + ' · ' : '') + (s.status || (d.round ? d.round + ' rounds · ' + (d.links || []).length + ' links' : 'Agents standing by')),
      agentLabelsRef: this.agentLabelsRef,
      agentRows: this.AGENTS.map(a => { const tn = s.agentTarget && s.agentTarget[a.id] && d.nodes.find(n => n.id === s.agentTarget[a.id]); return { name: a.name, color: a.color, icon: a.icon, eyes: a.eyes, eyeFill: a.eyeFill, pupils: a.pupils, status: tn ? (s.phase || 'working') + ' · ' + tn.name : 'idle', statusColor: tn ? this.th().accent : this.th().muted, count: '+' + d.nodes.filter(n => n.by === a.id).length }; }),
      noSel: !sel,
      noLog: !(d.log || []).length,
      logCount: (d.log || []).length + ' entries',
      logOpen: !s.logClosed, logCaret: s.logClosed ? '▾' : '▴', toggleLog: () => this.setState({ logClosed: !s.logClosed }),
      logEntries: (d.log || []).slice(0, 50).map(e => { const a = this.AGENTS.find(x => x.id === e.agent) || {}; return { agent: a.name || e.agent, color: a.color || this.INK, icon: a.icon || 'M9 1.2 A6.9 6.9 0 1 1 8.99 1.2 Z', eyes: a.eyes || '', eyeFill: a.eyeFill || '#FFFFFF', pupils: a.pupils || '', text: e.text, tag: e.tag, onClick: () => this.select(d.nodes.some(n => n.id === e.node) ? e.node : null) }; }),
      phases: [['plan', 'Plan'], ['diverge', 'Diverge'], ['connect', 'Connect'], ['synthesize', 'Takeaway']].map(([id, label]) => ({ label, bg: s.phase === id ? this.th().accent : 'transparent', fg: s.phase === id ? '#1B1A17' : this.th().muted })),
      roundOpts: [5, 10, 20].map(n => ({ label: n + '', bg: s.total === n ? this.INK : this.PAPER, fg: s.total === n ? this.PAPER : this.INK, onClick: () => this.setState({ total: n }) })),
      run: () => this.run(), step: () => this.step(), synthNow: () => { if (!s.running) this.synthesize(); },
      runLabel: s.running ? '❚❚ Pause' : '▶ Run agents',
      hasSynth: !!d.synth,
      synthOpen: !s.synthClosed, synthCaret: s.synthClosed ? '▾' : '▴', toggleSynth: () => this.setState({ synthClosed: !s.synthClosed }),
      settingsOpen: om === 'settings', setCaret: om === 'settings' ? '▴' : '▾',
      setBg: sb.bg, setFg: sb.fg,
      toggleSettings: () => this.setState({ openMenu: om === 'settings' ? null : 'settings' }),
      focus: !!s.focus, notFocus: !s.focus,
      enterFocus: () => this.setState({ focus: true, openMenu: null, menuOpen: false }),
      exitFocus: () => this.setState({ focus: false }),
      synthVerdict: d.synth ? d.synth.verdict : '', synthBrief: d.synth ? d.synth.brief : '',
      synthPath: d.synth ? d.synth.path.map(id => (d.nodes.find(n => n.id === id) || {}).name).filter(Boolean).join(' → ') : '',
      pathLabel: s.showPath ? 'Hide path' : 'Show path', togglePath: () => this.setState({ showPath: !s.showPath }),
      selLinks: sel ? (d.links || []).filter(l => l.a === sel.id || l.b === sel.id).map(l => { const o = d.nodes.find(n => n.id === (l.a === sel.id ? l.b : l.a)); return o ? { name: o.name, why: l.why || '', onClick: () => this.select(o.id) } : null; }).filter(Boolean) : [],
      notEditing: !s.editing, editing: !!s.editing,
      editName: s.editName || '', editDesc: s.editDesc || '',
      onEditName: e => this.setState({ editName: e.target.value }),
      onEditDesc: e => this.setState({ editDesc: e.target.value }),
      startEdit: () => this.setState({ editing: true, editName: sel ? sel.name : '', editDesc: sel ? sel.note || '' : '' }),
      cancelEdit: () => this.setState({ editing: false }),
      saveEdit: () => { if (sel && (s.editName || '').trim()) { this.patchNode(sel.id, { name: s.editName.trim(), note: (s.editDesc || '').trim() }); } this.setState({ editing: false }); },
      myNote: s.myNote || '',
      onMyNote: e => this.setState({ myNote: e.target.value, noteDirty: true }),
      saveMyNote: () => { if (s.noteDirty) this.saveMyNote(); },
      noteSaved: s.noteDirty ? 'editing…' : (sel && sel.userNote ? 'saved' : ''),
      hasSelLinks: !!sel && (d.links || []).some(l => l.a === sel.id || l.b === sel.id),
      onIdea: e => this.setState({ idea: e.target.value }),
      onKey: e => { if (e.key === 'Enter') this.submit(); },
      submit: () => this.submit(),
      submitLabel: s.loading ? 'Mapping…' : sel ? 'Grow →' : 'Map it →'
    };
  }
}
