/* sculpt_next_palette.js: the PALETTE, Substance 3D Modeler's big panel on your support hand, drawn in the Atelier's colours (Ruth 2026-10-14: "the menu looks exactly like the normal atelier menu", "the icons are way too small to read").
   It floats above your support controller and turns with it. Point at it with your tool hand and pull the trigger:
     top:     the tool in your hand (big icon and name), Undo, Redo, and your colour (tap it for the colour wheel)
     sliders: Size and Strength, drag along them
     chips:   Edge (soft, even, sharp, flat), Symmetry (off, mirror, 360, both), Mode (add, take away, paint, keep shared), the gradient (tap to change)
     left:    the pages (Clay, Shapes, Draw, Colour, Layers, Together, Expressions); the tool stick's left / right turns them too
     grid:    that page's tools as big tiles with words, the same tools as the Atelier wrist menu, nothing removed
   The panel is 30 cm wide (the Atelier wrist menu is 12): icons are 7 times the area, words are 7 mm tall.
   Hold the support hand's lower button for the Palette; a quick tap pins it open (sculpt_next_controls.js). "Palette: Atelier menu" on the Together page brings back the wrist menu instead.
   makePalette(THREE, env): env = { cfg, set, menu, icons, brush (mode -> [word, icon]), undo(), redo(), openWheel(), gradientStops() -> [[t, '#rrggbb(aa)']], gradients, say(t) }
     .show(grip, side)  .hide()  .isOpen  .page  .step(n)  .hover(ray) -> over?  .press(ray, down) -> took it?  .frame()  .hits (for tests)  .tapAt(x, y) */
const W = 1280, H = 1100, PW = 0.30, PH = PW * H / W;
const INK = '#f3eee2', AMBER = '#e0975a', AMBER2 = '#e8a866', GOLD = '#ffd35a', PLUM0 = 'rgba(22,17,30,0.95)', PLUM1 = '#2a2036', PLUM2 = '#3a2d4d', PLUM3 = '#4a3866', DIM = 'rgba(243,238,226,0.62)';
const TAB = { 10: ['Clay', 'clayIc'], 11: ['Shapes', 'shapesIc'], 14: ['Draw', 'rodIc'], 15: ['Colour', 'wheelIc'], 12: ['Layers', 'layersIc'], 16: ['Together', 'togetherIc'], 13: ['Expressions', 'motionIc'] };
const NAV = new Set(['Shapes ▸', 'Draw ▸', 'Colour ▸', 'Layers ▸', 'Together ▸', 'Expressions ▸']);
const IN_HEADER = /^(Size |Strength |Symmetry:|Edge:|Mode:|Undo stroke|Redo stroke)/;
const FONT = (w, px) => `${w} ${px}px system-ui, "Segoe UI", Roboto, sans-serif`;
const SIZE_MIN = 0.3, SIZE_MAX = 30, STR_MIN = 5, STR_MAX = 100;

export function makePalette(THREE, env) {
  const cfg = env.cfg, say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } };
  const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null; if (cv) { cv.width = W; cv.height = H; }
  const ctx = cv ? cv.getContext('2d') : null, tex = cv ? new THREE.CanvasTexture(cv) : null;
  if (tex) { if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; }
  const group = new THREE.Group(); group.name = 'sculptPalette'; group.visible = false;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  panel.renderOrder = 1004; group.add(panel);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false })); dot.renderOrder = 1005; dot.visible = false; group.add(dot);
  const rc = new THREE.Raycaster(), imgs = {}, S = { open: false, page: 10, offset: 0, hits: [], hot: null, drag: null, dirty: true, sig: '', grip: null, side: -1, last: 0 };
  const order = () => (env.menu && env.menu.order) || [10, 11, 14, 15, 12, 16, 13];
  /* icons: the same drawings as the wrist menu, drawn big */
  function icon(key) {
    if (!key || !env.icons || !env.icons[key] || typeof Image === 'undefined') return null; if (imgs[key]) return imgs[key].ok ? imgs[key].img : null;
    const img = new Image(), rec = imgs[key] = { img, ok: false }; img.onload = () => { rec.ok = true; S.dirty = true; S.sig = ''; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="160" height="160" style="fill:none;stroke:' + INK + ';stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round">' + env.icons[key] + '</svg>');
    return null;
  }
  const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  const text = (t, x, y, px, col, w, align) => { ctx.font = FONT(w || 600, px); ctx.fillStyle = col || INK; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); };
  function wrap(t, maxW, px) {   /* up to two lines, shrinking the words before cutting them */
    let size = px; for (; size >= 20; size -= 2) { ctx.font = FONT(700, size); const words = String(t).split(' '), lines = ['']; words.forEach(wd => { const tryL = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + wd : wd; if (ctx.measureText(tryL).width <= maxW || !lines[lines.length - 1]) lines[lines.length - 1] = tryL; else lines.push(wd); }); if (lines.length <= 2 && lines.every(l => ctx.measureText(l).width <= maxW)) return { lines, size }; }
    return { lines: [String(t).slice(0, 18)], size: 20 };
  }
  const hit = (x, y, w, h, o) => { S.hits.push(Object.assign({ x, y, w, h }, o)); };
  const isHot = (x, y) => S.hot && S.hot.x === x && S.hot.y === y;
  function button(x, y, w, h, label, ic, act, on, opt) {
    opt = opt || {}; const hot = isHot(x, y);
    rr(x, y, w, h, 22); ctx.fillStyle = on ? AMBER : hot ? PLUM3 : PLUM2; ctx.fill(); ctx.lineWidth = hot ? 5 : 2; ctx.strokeStyle = hot ? '#ffffff' : on ? '#ffd9a8' : 'rgba(243,238,226,0.16)'; ctx.stroke();
    const im = icon(ic), isz = opt.icon || Math.min(h - 56, 84);
    if (opt.row) { if (im) ctx.drawImage(im, x + 14, y + (h - isz) / 2, isz, isz); text(label, x + isz + 28, y + h / 2, opt.px || 34, on ? '#20140a' : INK, 700); }
    else { if (im) ctx.drawImage(im, x + (w - isz) / 2, y + 10, isz, isz); const L = wrap(label, w - 18, opt.px || 30); L.lines.forEach((l, i) => text(l, x + w / 2, y + isz + 14 + L.size * 0.55 + i * L.size * 1.05, L.size, on ? '#20140a' : INK, 700, 'center')); }
    hit(x, y, w, h, { act, label });
  }
  function chips(x, y, w, h, title, list, cur, pick) {
    text(title, x, y + h / 2, 30, DIM, 700); const x0 = x + 128, cw = (w - 128 - 8 * (list.length - 1)) / list.length;
    list.forEach(([v, word], i) => { const cx = x0 + i * (cw + 8), on = v === cur, hot = isHot(cx, y); rr(cx, y, cw, h, h / 2); ctx.fillStyle = on ? AMBER : hot ? PLUM3 : PLUM1; ctx.fill(); ctx.lineWidth = hot ? 4 : 2; ctx.strokeStyle = hot ? '#fff' : on ? '#ffd9a8' : 'rgba(243,238,226,0.18)'; ctx.stroke(); const L = wrap(word, cw - 12, 28); text(L.lines[0], cx + cw / 2, y + h / 2 + 1, L.size, on ? '#20140a' : INK, 700, 'center'); hit(cx, y, cw, h, { act: () => pick(v), label: title + ' ' + word }); });
  }
  function slider(x, y, w, h, title, t, word, setT) {
    text(title, x, y + h / 2, 34, INK, 700); text(word, x + 168, y + h / 2, 32, GOLD, 700);
    const tx = x + 300, tw = w - 300 - 34, cy = y + h / 2; rr(tx, cy - 12, tw, 24, 12); ctx.fillStyle = PLUM1; ctx.fill(); rr(tx, cy - 12, Math.max(24, tw * t), 24, 12); ctx.fillStyle = AMBER2; ctx.fill();
    const kx = tx + tw * t, hot = S.drag && S.drag.title === title || isHot(x, y); ctx.beginPath(); ctx.arc(kx, cy, hot ? 34 : 30, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = AMBER; ctx.stroke();
    hit(x, y, w, h, { title, drag: px => setT(Math.max(0, Math.min(1, (px - tx) / tw))), label: title });
  }
  /* the menu rows of a page, minus what the top of the Palette already shows */
  function tiles(pg) {
    let rows = []; try { rows = env.menu(pg, ui) || []; } catch (e) { rows = []; }
    return rows.filter(r => r && !NAV.has(r.label) && !(r.ic === 'nxBack' && pg !== 17) && !IN_HEADER.test(r.label));
  }
  const ui = { draw: () => { S.dirty = true; S.sig = ''; }, page: n => { if (n === 0) { hide(); say('Palette away. The wrist menu has the Atelier\'s brushes.'); return; } S.page = n; S.offset = 0; S.dirty = true; S.sig = ''; }, say };
  function tool() { const b = env.brush && env.brush(cfg.mode); return b || [cfg.mode, 'sculptNextIc']; }
  function draw() {
    if (!ctx) return; S.hits = []; ctx.clearRect(0, 0, W, H); rr(4, 4, W - 8, H - 8, 54); ctx.fillStyle = PLUM0; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(224,151,90,0.6)'; ctx.stroke();
    /* the tool in your hand */
    const [tw, tic] = tool(), im = icon(tic); rr(22, 18, 760, 116, 30); ctx.fillStyle = PLUM1; ctx.fill(); if (im) ctx.drawImage(im, 34, 24, 104, 104);
    text(tw, 156, 58, 56, INK, 800); text((cfg.op === 'subtract' ? 'taking away' : cfg.op === 'paint' ? 'painting' : cfg.op === 'intersect' ? 'keeping what is shared' : 'adding') + ' · ' + (Math.round(cfg.size * 10) / 10) + ' cm · ' + cfg.strength + '%', 158, 106, 30, DIM, 600);
    button(800, 18, 140, 116, 'Undo', 'nxUndo', () => { if (!env.undo()) say('Nothing to undo.'); });
    button(952, 18, 140, 116, 'Redo', 'nxRedo', () => { if (!env.redo()) say('Nothing to redo.'); });
    { const x = 1104, y = 18, w = 154, h = 116, hot = isHot(x, y); rr(x, y, w, h, 22); ctx.fillStyle = hot ? PLUM3 : PLUM2; ctx.fill(); ctx.lineWidth = hot ? 5 : 2; ctx.strokeStyle = hot ? '#fff' : 'rgba(243,238,226,0.16)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + w / 2, y + 46, 32, 0, Math.PI * 2); ctx.fillStyle = cfg.rgb || '#e8c9a0'; ctx.globalAlpha = cfg.alpha == null ? 1 : Math.max(0.25, cfg.alpha); ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); text('Colour', x + w / 2, y + 96, 28, INK, 700, 'center');
      hit(x, y, w, h, { act: () => { hide(); env.openWheel && env.openWheel(); }, label: 'Colour' }); }
    /* sliders */
    const sT = Math.log(Math.max(SIZE_MIN, cfg.size) / SIZE_MIN) / Math.log(SIZE_MAX / SIZE_MIN);
    slider(22, 150, 1236, 72, 'Size', sT, (Math.round(cfg.size * 10) / 10) + ' cm', t => env.set.size(Math.round(SIZE_MIN * Math.pow(SIZE_MAX / SIZE_MIN, t) * 10) / 10));
    slider(22, 230, 1236, 72, 'Strength', (cfg.strength - STR_MIN) / (STR_MAX - STR_MIN), cfg.strength + '%', t => env.set.strength(Math.round(STR_MIN + t * (STR_MAX - STR_MIN))));
    /* chips */
    chips(22, 318, 606, 66, 'Edge', [['smooth', 'soft'], ['linear', 'even'], ['sharp', 'sharp'], ['flat', 'flat']], cfg.falloff, v => env.set.falloff(v));
    chips(650, 318, 608, 66, 'Mirror', [['off', 'off'], ['mirror', 'mirror'], ['radial', '360'], ['both', 'both']], cfg.sym, v => env.set.sym(v));
    chips(22, 396, 606, 66, 'Mode', [['add', 'add'], ['subtract', 'take'], ['paint', 'paint'], ['intersect', 'keep']], cfg.op, v => env.set.op(v));
    { const x = 650, y = 396, w = 608, h = 66, hot = isHot(x, y); text('Gradient', x, y + h / 2, 30, DIM, 700); const gx = x + 140, gw = w - 140; rr(gx, y, gw, h, h / 2);
      const stops = (env.gradientStops && env.gradientStops()) || [[0, cfg.rgb || '#e8c9a0'], [1, cfg.rgb || '#e8c9a0']], g = ctx.createLinearGradient(gx, 0, gx + gw, 0); stops.forEach(([t, c]) => { try { g.addColorStop(Math.max(0, Math.min(1, t)), c); } catch (e) { /* a colour the canvas cannot read */ } }); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = hot ? 5 : 3; ctx.strokeStyle = hot ? '#fff' : 'rgba(243,238,226,0.4)'; ctx.stroke();
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; text(cfg.gradient, gx + gw / 2, y + h / 2 + 1, 30, '#ffffff', 800, 'center'); ctx.restore();
      hit(x, y, w, h, { act: () => { const L = (env.gradients || []).filter(n => n !== 'custom' || cfg.gradCustom); if (L.length) env.set.gradient(L[(L.indexOf(cfg.gradient) + 1) % L.length]); }, label: 'Gradient' }); }
    /* pages */
    const tabs = order(); tabs.forEach((pg, i) => { const [word, ic] = TAB[pg] || [env.menu.title(pg) || '?', 'sculptNextIc'], y = 484 + i * 86; button(16, y, 214, 78, word, ic, () => ui.page(pg), S.page === pg || (pg === 12 && S.page === 17), { row: true, icon: 54, px: word.length > 8 ? 26 : 31 }); });
    /* the page's tools */
    const list = tiles(S.page), cols = 4, rows = 4, gx = 244, gy = 484, gw = W - gx - 18, gh = H - gy - 18, cw = (gw - (cols - 1) * 12) / cols, ch = (gh - (rows - 1) * 12) / rows, room = cols * rows;
    let show = list; if (list.length > room) { const per = room - 1; if (S.offset >= list.length) S.offset = 0; show = list.slice(S.offset, S.offset + per); show.push({ label: 'More (' + (Math.floor(S.offset / per) + 1) + '/' + Math.ceil(list.length / per) + ')', ic: 'nxRedo', act: () => { S.offset += per; if (S.offset >= list.length) S.offset = 0; S.dirty = true; S.sig = ''; } }); }
    show.forEach((r, i) => { const x = gx + (i % cols) * (cw + 12), y = gy + Math.floor(i / cols) * (ch + 12); let on = false; try { on = !!(r.on && r.on()); } catch (e) { /* row's */ } button(x, y, cw, ch, r.label, r.ic, r.act, on, { icon: 66, px: 29 }); });
    if (!show.length) text('Nothing on this page yet', gx + gw / 2, gy + 80, 34, DIM, 600, 'center');
    tex.needsUpdate = true; S.dirty = false;
  }
  /* a cheap fingerprint of what the panel shows, so it is redrawn only when something changed (never every frame) */
  function sig() { let t = ''; try { t = tiles(S.page).map(r => r.label + (r.on && r.on() ? '*' : '')).join('|'); } catch (e) { /* row's */ } return [S.page, S.offset, cfg.mode, cfg.op, cfg.size, cfg.strength, cfg.falloff, cfg.sym, cfg.rgb, cfg.alpha, cfg.gradient, S.hot ? S.hot.x + ',' + S.hot.y : '', S.drag ? 1 : 0, t].join('~'); }
  function frame() {
    if (!S.open) return; const parent = group.parent; if (parent) { parent.updateWorldMatrix(true, false); const s = new THREE.Vector3().setFromMatrixScale(parent.matrixWorld).x || 1; group.scale.setScalar(1 / s); }   /* the same 30 cm however the world is scaled */
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now(); if (!S.dirty && now - S.last < 120) return; S.last = now; const g = sig(); if (g !== S.sig || S.dirty) { S.sig = g; draw(); }
  }
  /* pointing: a ray from the tool hand ({ o, d } in the world, or the controller itself) -> the pixel it touches */
  function rayOf(r) { if (!r) return null; if (r.isObject3D) { r.updateWorldMatrix(true, false); const o = new THREE.Vector3().setFromMatrixPosition(r.matrixWorld), q = new THREE.Quaternion(); r.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3()); return { o, d: new THREE.Vector3(0, 0, -1).applyQuaternion(q) }; } return r; }
  function pix(r) {
    if (!S.open || !group.visible) return null; r = rayOf(r); if (!r) return null; group.updateWorldMatrix(true, true); rc.set(r.o, r.d.clone().normalize()); rc.far = 1.5; const h = rc.intersectObject(panel, false)[0]; if (!h || !h.uv) return null;
    dot.position.copy(panel.worldToLocal(h.point.clone())); dot.position.z = 0.001; return { x: h.uv.x * W, y: (1 - h.uv.y) * H };
  }
  const at = (x, y) => S.hits.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  function hover(r) {
    const p = pix(r); dot.visible = !!p; if (!p) { if (S.hot) { S.hot = null; S.dirty = true; } return false; }
    if (S.drag) { S.drag.drag(p.x); S.dirty = true; return true; }
    const b = at(p.x, p.y), was = S.hot; S.hot = b ? { x: b.x, y: b.y } : null; if ((was && was.x) !== (S.hot && S.hot.x) || (was && was.y) !== (S.hot && S.hot.y)) S.dirty = true; return true;
  }
  function tapAt(x, y, down) {
    if (down === false) { const d = S.drag; S.drag = null; if (d) { S.dirty = true; say(d.title + ': ' + (d.title === 'Size' ? (Math.round(cfg.size * 10) / 10) + ' cm' : cfg.strength + '%') + '.'); } return !!d; }
    const b = at(x, y); if (!b) return true;   /* on the panel but between buttons: still the Palette's, so no clay is touched */
    if (b.drag) { S.drag = b; b.drag(x); S.dirty = true; return true; }
    try { b.act && b.act(ui); } catch (e) { say('Error: ' + (e && e.message || e)); } S.dirty = true; S.sig = ''; if (S.open) draw(); return true;
  }
  function press(r, down) { if (!S.open) { S.drag = null; return false; } if (down === false) return tapAt(0, 0, false); const p = pix(r); if (!p) return false; return tapAt(p.x, p.y, true); }
  /* where it sits: above the support controller, leaning toward the middle and tilted to face you */
  function show(grip, side) {
    if (!grip) return false; S.side = side || -1; if (S.grip !== grip) { if (group.parent) group.parent.remove(group); grip.add(group); S.grip = grip; }
    group.position.set(-S.side * 0.095, 0.215, -0.02); group.rotation.set(-0.42, -S.side * 0.18, 0); group.visible = true; S.open = true; S.dirty = true; S.sig = ''; frame(); draw(); return true;
  }
  function hide() { S.open = false; S.drag = null; S.hot = null; group.visible = false; dot.visible = false; }
  function step(n) { const L = order(), i = Math.max(0, L.indexOf(S.page === 17 ? 12 : S.page)); ui.page(L[(i + n + L.length) % L.length]); say((TAB[S.page] || [''])[0] + '.'); }
  return { show, hide, step, hover, press, tapAt, frame, draw, group, panel, canvas: cv, get isOpen() { return S.open; }, get page() { return S.page; }, set page(v) { ui.page(v); }, get hits() { return S.hits; }, get dragging() { return !!S.drag; }, size: [PW, PH], px: [W, H] };
}
