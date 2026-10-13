/* bst_sculpt_ui.js: the Sculpt tab and the brush on the desktop page (Ruth, 2026-10-10: balloon sections with mirror and 360, or without; melt a leg into a stump; bags under the eyes).
   The brush maths is bst_sculpt_core.js (pure, three as a parameter). This file is the page side: the panel, the cursor ring, picking the point on a posed or unposed figure,
   one undo step per stroke, and shape keys (a stroke can go into a named morph target instead of the base shape, so a sculpted behaviour is a slider that exports in the .glb).
   The point under the cursor is found on the figure as it is posed, then moved back into the mesh's own rest space through the hit triangle's barycentric weights, so a posed figure sculpts true. */
import * as THREE from 'three';
import { makeSculpt } from '/pe_lib/bst_sculpt_core.js';
import { makeShapeKeys } from '/pe_lib/bst_shapekeys.js';

export function initSculpt({ ws, scene, camera, cv, controls, say, hasKeysChanged }) {
  const S = makeSculpt(THREE), $ = id => document.getElementById(id), V3 = THREE.Vector3;
  const cfg = { on: false, mode: 'inflate', size: 6, strength: 40, sym: 'off', count: 6, into: 'key', key: 'Shape 1' };
  const states = new WeakMap(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const ringGeo = (() => { const p = []; for (let i = 0; i <= 48; i++) p.push(new V3(Math.cos(i / 48 * Math.PI * 2), Math.sin(i / 48 * Math.PI * 2), 0)); return new THREE.BufferGeometry().setFromPoints(p); })();
  const mkRing = c => { const r = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.9 })); r.renderOrder = 12; r.visible = false; r.frustumCulled = false; scene.add(r); return r; };
  const ring = mkRing(0xffd9a8), ghosts = Array.from({ length: 24 }, () => mkRing(0xe8a866));
  const hideRings = () => { ring.visible = false; ghosts.forEach(g => { g.visible = false; }); };

  const targets = () => { const sel = ws.selObjs().filter(o => o.root.visible), list = sel.length ? sel : ws.objects.filter(o => o.root.visible), m = []; list.forEach(o => o.root.traverse(x => { if (x.isMesh && x.geometry && x.geometry.attributes.position && x.visible) m.push(x); })); return m; };
  const ownerOf = mesh => ws.objects.find(o => { let n = mesh; while (n) { if (n === o.root) return true; n = n.parent; } return false; });
  const stateOf = mesh => { let s = states.get(mesh); if (!s || s.geometry !== mesh.geometry) { s = S.prepare(mesh.geometry); states.set(mesh, s); } return s; };

  /* the point under the pointer: world hit, then the same spot in the mesh's own rest space */
  function pick(e) {
    const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(targets(), false).filter(h => h.face); if (!hits.length) return null;
    const h = hits[0], mesh = h.object, g = mesh.geometry, pos = g.attributes.position, f = h.face, tmp = [new V3(), new V3(), new V3()];
    const local = mesh.worldToLocal(h.point.clone());
    [f.a, f.b, f.c].forEach((i, k) => { if (mesh.isSkinnedMesh && mesh.getVertexPosition) mesh.getVertexPosition(i, tmp[k]); else tmp[k].fromBufferAttribute(pos, i); });
    const bc = new V3(); THREE.Triangle.getBarycoord(local, tmp[0], tmp[1], tmp[2], bc);
    const rest = [f.a, f.b, f.c].map(i => new V3().fromBufferAttribute(pos, i));
    const c = rest[0].clone().multiplyScalar(bc.x).addScaledVector(rest[1], bc.y).addScaledVector(rest[2], bc.z);
    const n = new V3().crossVectors(rest[1].clone().sub(rest[0]), rest[2].clone().sub(rest[0])).normalize();
    return { mesh, c, n, world: h.point.clone(), wn: h.face.normal.clone().transformDirection(mesh.matrixWorld).normalize() };
  }
  const scaleOf = mesh => { mesh.updateMatrixWorld(true); return mesh.matrixWorld.getMaxScaleOnAxis() || 1; };
  function symOpts(mesh, c) {
    if (cfg.sym === 'mirror') return { mirror: true };
    if (cfg.sym === 'radial') { const ax = mesh && c ? limbAxis(mesh, c) : { axisVec: new V3(0, 1, 0), origin: new V3() }; return { radial: { count: cfg.count, axisVec: ax.axisVec, origin: ax.origin } }; }
    return null;
  }

  /* shape keys */
  const { keysOf, ensureKey, nextKeyName, limbAxis, sideOf } = makeShapeKeys(THREE);

  /* the stroke */
  let stroke = null, lastPt = null, rafNormals = 0;
  const opts = (mesh, T, sym) => ({ mode: cfg.mode, radius: cfg.size / 100 / scaleOf(mesh), strength: cfg.strength / 100, sym: sym === undefined ? null : sym, target: T || null, down: new V3(0, -1, 0).transformDirection(new THREE.Matrix4().copy(mesh.matrixWorld).invert()) });
  function begin(e) {
    if (!cfg.on || e.button !== 0 || e.altKey) return;
    const h = pick(e); if (!h) return;
    e.stopImmediatePropagation(); e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const mesh = h.mesh, st = stateOf(mesh);
    if (cfg.into === 'key' && !cfg.key.trim()) { cfg.key = nextKeyName(mesh); $('skKey').value = cfg.key; }
    stroke = { mesh, st, keyed: cfg.into === 'key', parts: new Map(), o: ownerOf(mesh) }; lastPt = null; dab(h);
  }
  /* a part of a stroke = one target (the base shape, or one shape key) and what it first held, so the whole stroke is one undo step */
  function partFor(s, name) {
    let p = s.parts.get(name);
    if (!p) { if (s.keyed) { const k = ensureKey(s.mesh, name); p = { name, k, T: s.mesh.geometry.morphAttributes.position[k].array, rec: new Map() }; } else p = { name: '', k: -1, T: null, rec: new Map() }; s.parts.set(name, p); }
    return p;
  }
  function dab(h) {
    const s = stroke, o0 = opts(s.mesh, null, null);
    if (lastPt && lastPt.distanceTo(h.c) < o0.radius * 0.3) return; lastPt = h.c.clone();
    const base = (cfg.key.trim() || 'Shape 1');
    const one = (c, n, name) => { const p = partFor(s, name); const o = opts(s.mesh, p.T, cfg.sym === 'radial' ? symOpts(s.mesh, c) : null); S.stroke(s.st, c, n, o, p.rec); if (p.T) s.mesh.geometry.morphAttributes.position[p.k].needsUpdate = true; else s.mesh.geometry.attributes.position.needsUpdate = true; };
    if (s.keyed && cfg.sym === 'mirror') {   /* a left and a right key, made together, so each side is its own slider */
      const side = sideOf(s.mesh, h.c), other = side === 'left' ? 'right' : 'left';
      one(h.c, h.n, base + ' (' + side + ')'); one(new V3(-h.c.x, h.c.y, h.c.z), new V3(-h.n.x, h.n.y, h.n.z), base + ' (' + other + ')');
    } else if (!s.keyed && cfg.sym === 'mirror') { const p = partFor(s, ''); S.stroke(s.st, h.c, h.n, opts(s.mesh, null, { mirror: true }), p.rec); s.mesh.geometry.attributes.position.needsUpdate = true; }
    else one(h.c, h.n, s.keyed ? base : '');
    if (!rafNormals) rafNormals = requestAnimationFrame(() => { rafNormals = 0; if (stroke && !stroke.keyed) stroke.mesh.geometry.computeVertexNormals(); });
  }
  function move(e) {
    const h = pick(e);
    if (h && cfg.on && !stroke) cursor(h); else if (!h && !stroke) hideRings();
    if (!stroke) return;
    if (h && h.mesh === stroke.mesh) { cursor(h); dab(h); }
  }
  function end(e) {
    if (!stroke) return; const s = stroke; stroke = null;
    try { cv.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
    S.finish(s.st, { target: s.keyed ? {} : null });
    const parts = [...s.parts.values()].filter(p => p.rec.size); if (!parts.length) return;
    const mesh = s.mesh, total = parts.reduce((a, p) => a + p.rec.size, 0);
    const flip = () => { parts.forEach(p => { p.rec = S.swap(s.st, p.rec, p.T); if (p.T) mesh.geometry.morphAttributes.position[p.k].needsUpdate = true; }); if (!s.keyed) mesh.geometry.computeVertexNormals(); S.rebuildGrid(s.st); };
    if (s.o) s.o.dirty = true;
    ws.record('sculpt ' + cfg.mode, flip, flip);
    say(`${cfg.mode[0].toUpperCase() + cfg.mode.slice(1)}: ${total.toLocaleString('en-US')} points moved${s.keyed ? ' in the shape key' + (parts.length > 1 ? 's ' : ' ') + parts.map(p => '"' + p.name + '"').join(' and ') : ''}. Undo takes the whole stroke back.`);
    draw();
  }
  function cursor(h) {
    const R = cfg.size / 100, o = new THREE.Object3D();
    const place = (r, w, n) => { r.position.copy(w); r.scale.setScalar(R); r.quaternion.setFromUnitVectors(new V3(0, 0, 1), n); r.visible = true; };
    place(ring, h.world, h.wn); ghosts.forEach(g => { g.visible = false; });
    if (cfg.sym !== 'off') {
      const list = S.dabs(h.c, h.n, symOpts(h.mesh, h.c)).slice(1); const m = h.mesh.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m);
      list.slice(0, ghosts.length).forEach((d, i) => place(ghosts[i], d.c.clone().applyMatrix4(m), d.n.clone().applyMatrix3(nm).normalize()));
    }
  }

  /* the panel */
  function draw() {
    const seg = (id, val) => document.querySelectorAll('#' + id + ' button').forEach(b => { const on = b.dataset.v === String(val); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    seg('skBrush', cfg.mode); seg('skSym', cfg.sym); seg('skInto', cfg.into);
    $('skOn').textContent = cfg.on ? 'Stop sculpting' : 'Start sculpting'; $('skOn').classList.toggle('on', cfg.on); $('skOn').setAttribute('aria-pressed', String(cfg.on));
    $('tSculpt').classList.toggle('on', cfg.on); $('tSculpt').setAttribute('aria-pressed', String(cfg.on));
    $('skSizeV').textContent = cfg.size + ' cm'; $('skStrV').textContent = cfg.strength + '%'; $('skCount').disabled = cfg.sym !== 'radial'; $('skKey').disabled = cfg.into !== 'key'; $('skNew').disabled = cfg.into !== 'key';
    const ms = targets().filter(m => (m.geometry.morphAttributes.position || []).length), box = $('skKeys');
    box.innerHTML = ms.length ? ms.map((m, mi) => keysOf(m).map(n => `<div class="orow"><span class="nm" title="${n}">${n}</span><input type="range" min="0" max="1" step="0.01" value="${m.morphTargetInfluences[m.morphTargetDictionary[n]] || 0}" data-m="${mi}" data-k="${n}" aria-label="${n}"></div>`).join('')).join('') : '<div class="msg">No shape keys yet. Choose "A shape key" and sculpt: the first stroke makes it.</div>';
    box.querySelectorAll('input').forEach(inp => inp.oninput = () => { const m = ms[+inp.dataset.m]; m.morphTargetInfluences[m.morphTargetDictionary[inp.dataset.k]] = +inp.value; });
  }
  function setOn(on) { cfg.on = !!on; ws.setSculpt(cfg.on); cv.style.cursor = cfg.on ? 'crosshair' : ''; if (!cfg.on) hideRings(); draw(); if (cfg.on) say('Drag on the figure to sculpt. Alt-drag or right-drag turns the view.'); }
  function wire() {
    $('skOn').onclick = () => setOn(!cfg.on); $('tSculpt').onclick = () => { setOn(!cfg.on); if (cfg.on) $('tabSculpt').click(); };
    $('skBrush').onclick = e => { const b = e.target.closest('button'); if (b) { cfg.mode = b.dataset.v; draw(); } };
    $('skSym').onclick = e => { const b = e.target.closest('button'); if (b) { cfg.sym = b.dataset.v; draw(); } };
    $('skInto').onclick = e => { const b = e.target.closest('button'); if (b) { cfg.into = b.dataset.v; draw(); } };
    $('skSize').oninput = e => { cfg.size = +e.target.value; draw(); }; $('skStr').oninput = e => { cfg.strength = +e.target.value; draw(); };
    $('skCount').oninput = e => { cfg.count = Math.max(2, Math.min(24, Math.round(+e.target.value) || 6)); };
    $('skKey').oninput = e => { cfg.key = e.target.value.slice(0, 40); };
    $('skNew').onclick = () => { const m = targets()[0]; cfg.key = m ? nextKeyName(m) : 'Shape 1'; $('skKey').value = cfg.key; cfg.into = 'key'; draw(); say('Next stroke starts a new shape key: ' + cfg.key + '.'); };
    cv.addEventListener('pointerdown', begin, true); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { if (!stroke) hideRings(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && cfg.on && !document.getElementById('atDlgBack')) { setOn(false); } });
  }
  wire(); draw();
  return { cfg, setOn, draw, S, ensureKey, stateOf, pick, limbAxis, sideOf, nextKeyName };
}
