/* sculpt_next_wheel.js: the COLOUR WHEEL (Ruth 2026-10-14: "it shouldn't be boxes of colors it should be a color wheel, with the ability to build gradients from it, and transparencies").
   It floats beside your hand, facing you, and you work it with the same pinch as everything else:
     the WHEEL      pinch and slide: round it is the hue, from the middle out is how strong the colour is
     LIGHT bar      (right of the wheel) pinch and slide up and down: dark to light
     CLEAR bar      (left of the wheel) pinch and slide: see-through at the bottom, solid at the top
     the BALL       (under the wheel) shows the colour you have, as it will look
     GRADIENT strip (along the bottom) your gradient, with a small marker for each colour in it:
                    + adds the colour you have (the strip becomes your own gradient), tap a marker to pick it (the wheel then changes THAT colour), slide a marker to move it along, - takes the picked one out
     the RING       (top right) closes the wheel
   Everything it changes is a setting (cfg.rgb, cfg.alpha, cfg.gradient, cfg.gradCustom), so brushes, rods, balls, the Gradient tool and a collaborator's headset all see the same colour.
   Drawn with vertex colours only (no canvas, no text), so it is the same on three r128 and r186. A pinch that starts away from the wheel sculpts as usual. */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function hsv2rgb(h, s, v) { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6]; }
export function rgb2hsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d + 6) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; } return [h, mx ? d / mx : 0, mx]; }
const toHex = (rgb, a) => '#' + rgb.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('') + (a != null && a < 0.999 ? Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0') : '');
export function parseStops(str) {   /* "#rrggbb[aa][@t],..." -> [{ rgb: [0..1], a, t }] with every t filled in (even spacing for those without one) */
  const out = String(str || '').split(',').map(s => s.trim()).filter(Boolean).map(s => { const [h, t] = s.split('@'); if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null; const rgb = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255), a = h.length === 9 ? parseInt(h.slice(7, 9), 16) / 255 : 1; return { rgb, a, t: t == null || t === '' ? null : clamp(+t, 0, 1) }; }).filter(Boolean);
  out.forEach((s, i) => { if (s.t == null) s.t = out.length === 1 ? 0 : i / (out.length - 1); }); return out.sort((a, b) => a.t - b.t);
}
export const stopsString = list => list.map(s => toHex(s.rgb, s.a) + '@' + (Math.round(s.t * 1000) / 1000)).join(',');

export function makeWheel(THREE, env) {
  const V3 = THREE.Vector3, cfg = env.cfg, R = 0.075, root = new THREE.Group(); root.name = 'vrColourWheel'; root.userData.noMerge = true; root.visible = false;
  const W = { open: false, grab: null, sel: -1, hsv: [0, 0, 1] };
  const mk = (geo, mat, name, x, y) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x || 0, y || 0, 0); m.renderOrder = 60; root.add(m); return m; };
  const vcMat = (transparent) => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: !!transparent, depthTest: true });
  /* the wheel: rings x segments, hue round it, strength outwards, shown at the current lightness */
  const rings = 10, segs = 72, disc = new THREE.BufferGeometry(), dp = [], dc = [], di = [];
  for (let r = 0; r <= rings; r++) for (let s = 0; s <= segs; s++) { const a = s / segs * Math.PI * 2, rr = r / rings * R; dp.push(Math.cos(a) * rr, Math.sin(a) * rr, 0); dc.push(1, 1, 1); }
  for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) { const a = r * (segs + 1) + s, b = a + 1, c = a + segs + 1, d = c + 1; di.push(a, c, b, b, c, d); }
  disc.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); disc.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3)); disc.setIndex(di);
  const wheel = mk(disc, vcMat(), 'vrWheelDisc');
  const bar = (name, x) => { const g = new THREE.PlaneGeometry(0.016, R * 2, 1, 16); g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 4).fill(1), 4)); return mk(g, vcMat(true), name, x, 0); };
  const light = bar('vrWheelLight', R + 0.025), clear = bar('vrWheelClear', -R - 0.025);
  const checker = mk(new THREE.PlaneGeometry(0.016, R * 2), new THREE.MeshBasicMaterial({ color: 0x8a8494, side: THREE.DoubleSide }), 'vrWheelChecker', -R - 0.025, 0); checker.position.z = -0.002;
  const strip = (() => { const g = new THREE.PlaneGeometry(R * 2.4, 0.02, 48, 1); g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 4).fill(1), 4)); return mk(g, vcMat(true), 'vrWheelStrip', 0, -R - 0.05); })();
  const stripBack = mk(new THREE.PlaneGeometry(R * 2.4, 0.02), new THREE.MeshBasicMaterial({ color: 0x8a8494, side: THREE.DoubleSide }), 'vrWheelStripBack', 0, -R - 0.05); stripBack.position.z = -0.002;
  const ball = mk(new THREE.SphereGeometry(0.014, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, transparent: true }), 'vrWheelBall', 0, -R - 0.022);
  const knob = (name, col) => { const k = mk(new THREE.RingGeometry(0.004, 0.0062, 20), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, depthTest: false }), name); k.renderOrder = 62; return k; };
  const pick = knob('vrWheelPick', 0x111111), lightK = knob('vrWheelLightKnob', 0x111111), clearK = knob('vrWheelClearKnob', 0x111111);
  const pad = (name, x, y, shape) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, 0); const base = new THREE.Mesh(new THREE.CircleGeometry(0.011, 24), new THREE.MeshBasicMaterial({ color: 0x2a2433, side: THREE.DoubleSide })); base.renderOrder = 60; g.add(base); shape.forEach(([w, h, rz]) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xf1ebe0, side: THREE.DoubleSide })); b.rotation.z = rz || 0; b.position.z = 0.001; b.renderOrder = 61; g.add(b); }); root.add(g); return g; };
  const plus = pad('vrWheelAdd', R * 1.2 + 0.03, -R - 0.05, [[0.012, 0.003], [0.003, 0.012]]), minus = pad('vrWheelRemove', -R * 1.2 - 0.03, -R - 0.05, [[0.012, 0.003]]);
  const done = pad('vrWheelDone', R + 0.03, R + 0.02, [[0.012, 0.003, Math.PI / 4], [0.012, 0.003, -Math.PI / 4]]);
  let markers = [];
  const setCol = (attr, i, rgb, a) => { attr.setXYZ(i, rgb[0], rgb[1], rgb[2]); if (attr.itemSize === 4) attr.setW(i, a == null ? 1 : a); };
  /* the colour you have, and its stops, as the settings say */
  const current = () => { const h = String(cfg.rgb || ''); if (/^#[0-9a-f]{6}$/i.test(h)) return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); const p = env.palette()[cfg.tint % env.palette().length]; return p.map(v => v / 255); };
  const stops = () => (cfg.gradient === 'custom' ? parseStops(cfg.gradCustom) : env.gradientStops().map(([t, h]) => ({ t, rgb: [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255), a: h.length === 9 ? parseInt(h.slice(7, 9), 16) / 255 : 1 })));
  function setColour(rgb, a) {
    cfg.rgb = toHex(rgb); cfg.alpha = Math.round(clamp(a, 0, 1) * 100) / 100;
    if (cfg.gradient === 'custom' && W.sel >= 0) { const L = parseStops(cfg.gradCustom); if (L[W.sel]) { L[W.sel].rgb = rgb.slice(); L[W.sel].a = cfg.alpha; cfg.gradCustom = stopsString(L); } }
    if (env.onChange) env.onChange();
  }
  function redraw() {
    const [h, s, v] = W.hsv, C = disc.attributes.color;
    for (let r = 0; r <= rings; r++) for (let q = 0; q <= segs; q++) { const c = hsv2rgb(q / segs, r / rings, v); C.setXYZ(r * (segs + 1) + q, c[0], c[1], c[2]); } C.needsUpdate = true;
    const full = hsv2rgb(h, s, 1), LP = light.geometry.attributes.position, LC = light.geometry.attributes.color; for (let i = 0; i < LP.count; i++) { const u = (LP.getY(i) / (R * 2)) + 0.5; setCol(LC, i, full.map(x => x * u), 1); } LC.needsUpdate = true;
    const rgb = hsv2rgb(h, s, v), CP = clear.geometry.attributes.position, CC = clear.geometry.attributes.color; for (let i = 0; i < CP.count; i++) { const u = (CP.getY(i) / (R * 2)) + 0.5; setCol(CC, i, rgb, u); } CC.needsUpdate = true;
    const a = cfg.alpha == null ? 1 : cfg.alpha; ball.material.color.setRGB(rgb[0], rgb[1], rgb[2]); ball.material.opacity = Math.max(0.08, a);
    pick.position.set(Math.cos(h * Math.PI * 2) * s * R, Math.sin(h * Math.PI * 2) * s * R, 0.002); lightK.position.set(R + 0.025, (v - 0.5) * R * 2, 0.002); clearK.position.set(-R - 0.025, (a - 0.5) * R * 2, 0.002);
    const L = stops(), SP = strip.geometry.attributes.position, SC = strip.geometry.attributes.color, half = R * 1.2;
    for (let i = 0; i < SP.count; i++) { const t = (SP.getX(i) + half) / (half * 2); let k = 0; while (k < L.length - 2 && L[k + 1].t < t) k++; const A = L[k], B = L[Math.min(L.length - 1, k + 1)], u = B === A ? 0 : clamp((t - A.t) / ((B.t - A.t) || 1), 0, 1); setCol(SC, i, A.rgb.map((x, j) => x + (B.rgb[j] - x) * u), A.a + (B.a - A.a) * u); } SC.needsUpdate = true;
    markers.forEach(m => { root.remove(m); m.geometry.dispose(); }); markers = L.map((st, i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(i === W.sel ? 0.0065 : 0.0045, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(st.rgb[0], st.rgb[1], st.rgb[2]), side: THREE.DoubleSide, depthTest: false })); m.name = 'vrWheelStop'; m.renderOrder = 63; m.position.set(-half + st.t * half * 2, -R - 0.036, 0.003); root.add(m); return m; });
  }
  function open(at, face) {
    const c = current(); W.hsv = rgb2hsv(c[0], c[1], c[2]); if (W.hsv[2] < 0.05) W.hsv[2] = 0.05; W.sel = -1;
    root.position.copy(at); if (face) root.lookAt(face); root.updateMatrixWorld(true); if (!root.parent) env.addHelper(root); root.visible = true; W.open = true; redraw();
  }
  function close() { W.open = false; root.visible = false; W.grab = null; if (root.parent) env.removeHelper(root); }
  /* this frame's hands: pinches that start on the wheel work it (and are taken out of sculpting); the rest go on */
  function frame(hands) {
    if (!W.open) return hands; root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), half = R * 1.2, out = [];
    for (const h of hands) {
      const p = h.tip.clone().applyMatrix4(inv), near = Math.abs(p.z) < 0.04;
      if (h.pinch && !W.grab && near) {
        const d = Math.hypot(p.x, p.y), onStrip = Math.abs(p.y - (-R - 0.04)) < 0.02 && Math.abs(p.x) < half + 0.004;
        if (Math.hypot(p.x - done.position.x, p.y - done.position.y) < 0.014) { close(); env.say && env.say('Colour wheel closed.'); out.push(Object.assign({}, h, { pinch: false, onWheel: true })); continue; }
        if (Math.hypot(p.x - plus.position.x, p.y - plus.position.y) < 0.014) { const L = cfg.gradient === 'custom' ? parseStops(cfg.gradCustom) : []; const rgb = hsv2rgb(...W.hsv); L.forEach((s, i) => { s.t = L.length ? i / L.length : 0; }); L.push({ rgb, a: cfg.alpha == null ? 1 : cfg.alpha, t: 1 }); if (L.length === 1) L.push({ rgb: rgb.slice(), a: L[0].a, t: 1 }), L[0].t = 0; cfg.gradient = 'custom'; cfg.gradCustom = stopsString(L.slice(-8)); W.sel = parseStops(cfg.gradCustom).length - 1; W.grab = { kind: 'pad', id: h.id }; env.onChange && env.onChange(); env.say && env.say('Added to your gradient (' + parseStops(cfg.gradCustom).length + ' colours).'); redraw(); }
        else if (Math.hypot(p.x - minus.position.x, p.y - minus.position.y) < 0.014) { const L = parseStops(cfg.gradCustom); if (cfg.gradient === 'custom' && W.sel >= 0 && L.length > 2) { L.splice(W.sel, 1); cfg.gradCustom = stopsString(L); W.sel = -1; env.onChange && env.onChange(); env.say && env.say('Colour taken out of your gradient.'); } else env.say && env.say(cfg.gradient === 'custom' ? 'Tap a marker on the strip first (a gradient keeps at least two colours).' : 'Make your own gradient first: pick a colour and tap +.'); W.grab = { kind: 'pad', id: h.id }; redraw(); }
        else if (d <= R * 1.05) W.grab = { kind: 'wheel', id: h.id };
        else if (Math.abs(p.x - (R + 0.025)) < 0.014 && Math.abs(p.y) <= R + 0.006) W.grab = { kind: 'light', id: h.id };
        else if (Math.abs(p.x - (-R - 0.025)) < 0.014 && Math.abs(p.y) <= R + 0.006) W.grab = { kind: 'clear', id: h.id };
        else if (onStrip) { const L = stops(); let best = -1, bd = 0.012; L.forEach((s, i) => { const dx = Math.abs(-half + s.t * half * 2 - p.x); if (dx < bd) { bd = dx; best = i; } }); if (best >= 0 && cfg.gradient === 'custom') { W.sel = best; W.grab = { kind: 'stop', id: h.id, moved: false, x0: p.x }; const s = L[best]; W.hsv = rgb2hsv(...s.rgb); cfg.alpha = s.a; redraw(); } else if (best >= 0) { env.say && env.say('This is a ready-made gradient: tap + to start your own from the wheel.'); W.grab = { kind: 'pad', id: h.id }; } }
      }
      const g = W.grab && W.grab.id === h.id ? W.grab : null;
      if (g && !h.pinch) { W.grab = null; if (g.kind !== 'pad') { const rgb = hsv2rgb(...W.hsv); if (g.kind !== 'stop' || g.moved) setColour(rgb, cfg.alpha == null ? 1 : cfg.alpha); } out.push(Object.assign({}, h, { pinch: false, onWheel: true })); continue; }
      if (g) {
        if (g.kind === 'wheel') { const a = Math.atan2(p.y, p.x); W.hsv[0] = (a / (Math.PI * 2) + 1) % 1; W.hsv[1] = clamp(Math.hypot(p.x, p.y) / R, 0, 1); }
        else if (g.kind === 'light') W.hsv[2] = clamp(p.y / (R * 2) + 0.5, 0.02, 1);
        else if (g.kind === 'clear') cfg.alpha = Math.round(clamp(p.y / (R * 2) + 0.5, 0, 1) * 100) / 100;
        else if (g.kind === 'stop') { if (Math.abs(p.x - g.x0) > 0.004) g.moved = true; if (g.moved) { const L = parseStops(cfg.gradCustom), s = L[W.sel]; if (s) { s.t = clamp((p.x + half) / (half * 2), 0, 1); const keep = s; L.sort((a, b) => a.t - b.t); W.sel = L.indexOf(keep); cfg.gradCustom = stopsString(L); } } }
        if (g.kind !== 'pad' && g.kind !== 'stop') setColour(hsv2rgb(...W.hsv), cfg.alpha == null ? 1 : cfg.alpha);
        redraw(); out.push(Object.assign({}, h, { pinch: false, onWheel: true })); continue;
      }
      out.push(h);
    }
    return out;
  }
  return { open, close, frame, get isOpen() { return W.open; }, root, redraw, W };
}
