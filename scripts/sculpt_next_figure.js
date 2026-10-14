/* sculpt_next_figure.js: the hand brushes on things made of triangles (a figure, its clothes, a prop, a squeezed tube), driven by sculpt_next_surface.js. Same rules as the current engine
   (lib/bst_vr_sculpt.js), which they replace for brushes: the hand finds the skin AS IT IS POSED (a skinned copy of every point, r128 has no getVertexPosition), the stroke is worked out in the rest shape,
   and on a figure every stroke goes into a named SHAPE KEY (Mirror makes a left key and a right key), so the skeleton, the skin weights and the rest shape the bones were bound to never change.
   Paint writes vertex colours (the piece gets its own copy of its material first, so no other figure changes colour). Clothes get a fresh geometry object after each stroke so the wardrobe's
   cut saving (wardrobe_core.js _wardGeoSaveAll, which saves a piece whose geometry object changed) keeps the change. */
import { makeShapeKeys } from '/pe_lib/bst_shapekeys.js';
import { subdivideGeometry } from '/pe_lib/bst_cut.js';

export function makeFigureBrushes(THREE, core, env) {
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, K = makeShapeKeys(THREE), say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } };
  const GAIN = 0.2;   /* as the current engine: a hand dabs about ten times a second while it holds still, so each dab is a fifth of the desktop's one-click amount */
  const entries = new Map(), hs = new Map(); let built = 0, waiting = false;
  const skinned = m => !!(m.isSkinnedMesh && m.skeleton);
  const isFigurePiece = m => { const f = env.figure && env.figure(); return !!(f && f.getObjectById(m.id)); };

  /* ---------- the posed copy ---------- */
  function skinMatrix(mesh, i, out) {
    const g = mesh.geometry, ia = g.attributes.skinIndex.array, wa = g.attributes.skinWeight.array, bm = mesh.skeleton.boneMatrices, e = out.elements; for (let k = 0; k < 16; k++) e[k] = 0;
    const t = skinMatrix.t || (skinMatrix.t = new M4());
    for (let k = 0; k < 4; k++) { const w = wa[i * 4 + k]; if (!w) continue; t.fromArray(bm, ia[i * 4 + k] * 16); for (let q = 0; q < 16; q++) e[q] += t.elements[q] * w; }
    return out;
  }
  const tmpA = new M4(), tmpV = new V3();
  function posedOf(mesh, st, i, out) {   /* the shape as seen (rest + keys) through the bones, in the mesh's own space */
    const g = st.group[i], E = st.eff; out.set(E[g * 3], E[g * 3 + 1], E[g * 3 + 2]); if (!skinned(mesh)) return out;
    skinMatrix(mesh, i, tmpA); return out.applyMatrix4(mesh.bindMatrix).applyMatrix4(tmpA).applyMatrix4(mesh.bindMatrixInverse);
  }
  const OFS = 1 << 10, SP = 1 << 11, ck = (i, j, k) => ((i + OFS) * SP + (j + OFS)) * SP + (k + OFS);
  function buildGrid(en) {
    const P = en.posed, n = P.length / 3; let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { const v = P[i * 3 + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
    en.cell = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 40 || 1; en.origin = lo; en.grid = new Map(); en.hi = [Math.floor((hi[0] - lo[0]) / en.cell) + 1, Math.floor((hi[1] - lo[1]) / en.cell) + 1, Math.floor((hi[2] - lo[2]) / en.cell) + 1];
    for (let i = 0; i < n; i++) { const k = ck(Math.floor((P[i * 3] - lo[0]) / en.cell), Math.floor((P[i * 3 + 1] - lo[1]) / en.cell), Math.floor((P[i * 3 + 2] - lo[2]) / en.cell)); let a = en.grid.get(k); if (!a) { a = []; en.grid.set(k, a); } a.push(i); }
  }
  function densify(mesh) {   /* a cube or other coarse object gets points added (in the world's measure) the first time a brush reaches it; a figure's own pieces never */
    if (isFigurePiece(mesh) || skinned(mesh)) return; if (mesh.userData && mesh.userData._bstDense === mesh.geometry.id) return; mesh.userData = mesh.userData || {}; mesh.userData._bstDense = mesh.geometry.id;
    const sc = new V3(); mesh.matrixWorld.decompose(new V3(), new THREE.Quaternion(), sc); const r = subdivideGeometry(THREE, mesh.geometry, { scale: { x: Math.abs(sc.x), y: Math.abs(sc.y), z: Math.abs(sc.z) }, maxEdge: 0.04, maxPoints: 60000 }); if (!r) return;
    mesh.geometry = r.geometry; mesh.userData._bstDense = r.geometry.id; if (mesh.updateMorphTargets) mesh.updateMorphTargets();
    say((mesh.name ? '"' + mesh.name + '"' : 'This object') + ' had too few points to shape, so points were added (' + r.geometry.attributes.position.count.toLocaleString('en-US') + ' now).');
  }
  function entryOf(mesh) {
    let en = entries.get(mesh); if (en && en.geometry === mesh.geometry) return en;
    mesh.updateMatrixWorld(true); if (skinned(mesh)) mesh.skeleton.update(); else densify(mesh);
    const st = core.prepare(mesh.geometry, mesh.morphTargetInfluences || null), n = st.n; en = { mesh, geometry: mesh.geometry, st, posed: new Float32Array(n * 3) };
    for (let i = 0; i < n; i++) { posedOf(mesh, st, i, tmpV); en.posed[i * 3] = tmpV.x; en.posed[i * 3 + 1] = tmpV.y; en.posed[i * 3 + 2] = tmpV.z; }
    buildGrid(en); entries.set(mesh, en); return en;
  }
  const hasEntry = m => { const en = entries.get(m); return !!(en && en.geometry === m.geometry); };
  function refresh(en, idx) {
    const mesh = en.mesh; mesh.updateMatrixWorld(true); if (skinned(mesh)) mesh.skeleton.update();
    if (idx) for (const i of idx) { posedOf(mesh, en.st, i, tmpV); en.posed[i * 3] = tmpV.x; en.posed[i * 3 + 1] = tmpV.y; en.posed[i * 3 + 2] = tmpV.z; }
    else for (let i = 0; i < en.st.n; i++) { posedOf(mesh, en.st, i, tmpV); en.posed[i * 3] = tmpV.x; en.posed[i * 3 + 1] = tmpV.y; en.posed[i * 3 + 2] = tmpV.z; }
    buildGrid(en);
  }
  function nearest(en, p, reach) {   /* the closest point to p (mesh space, posed) within reach, or null; the search never leaves the mesh's own cells */
    let best = -1, bd = reach * reach; const r = Math.ceil(reach / en.cell), o = en.origin, cx = Math.floor((p.x - o[0]) / en.cell), cy = Math.floor((p.y - o[1]) / en.cell), cz = Math.floor((p.z - o[2]) / en.cell), P = en.posed, hi = en.hi;
    for (let i = Math.max(cx - r, 0); i <= Math.min(cx + r, hi[0]); i++) for (let j = Math.max(cy - r, 0); j <= Math.min(cy + r, hi[1]); j++) for (let k = Math.max(cz - r, 0); k <= Math.min(cz + r, hi[2]); k++) {
      const a = en.grid.get(ck(i, j, k)); if (!a) continue; for (const v of a) { const dx = P[v * 3] - p.x, dy = P[v * 3 + 1] - p.y, dz = P[v * 3 + 2] - p.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = v; } }
    }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  }
  /* only meshes near the hand, and at most about 30k points prepared per frame (the 2026-10-11 freeze in a big Build-mode room) */
  function pickable(tip, reach) {
    const out = [], box = new THREE.Box3();
    for (const m of env.targets()) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); m.updateMatrixWorld();
      box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); if (box.distanceToPoint(tip) > reach + (skinned(m) ? 0.6 : 0)) continue;
      if (!hasEntry(m)) { const n = m.geometry.attributes.position.count; if (n > 250000) continue; if (built > 0 && built + n > 30000) { waiting = true; continue; } built += n; }
      out.push(m);
    }
    return out;
  }
  const radiusOf = (mesh, size) => size / 100 / (mesh.matrixWorld.getMaxScaleOnAxis() || 1);
  function hitAt(tip, size) {   /* the nearest skin point under the brush, over every target */
    let hit = null; for (const m of pickable(tip, size / 100 * 1.2 + 0.05)) { const en = entryOf(m); m.updateMatrixWorld(); const local = m.worldToLocal(tip.clone()), reach = radiusOf(m, size) * 1.2 + 0.02, h = nearest(en, local, reach); if (h && (!hit || h.d < hit.d)) hit = { ...h, mesh: m, en, dWorld: h.d * (m.matrixWorld.getMaxScaleOnAxis() || 1) }; }
    return hit;
  }

  /* ---------- shells, keys, fresh geometry ---------- */
  function mirrorToShells(mesh) { if (!isFigurePiece(mesh) || !K.keysOf(mesh).length) return; try { window.BodyFX && BodyFX.syncMorph && BodyFX.syncMorph(mesh); } catch (e) { /* the glow is the Atelier's */ } }
  /* a worn piece of clothing is saved by the wardrobe only when its geometry object changes: give it a new one that shares every buffer (no copy, no re-upload) */
  function freshGeometry(mesh) {
    if (!(mesh.userData && mesh.userData.wardrobe)) return; const g0 = mesh.geometry, ng = new THREE.BufferGeometry(); ng.name = g0.name; ng.index = g0.index; Object.keys(g0.attributes).forEach(n => ng.setAttribute(n, g0.attributes[n]));
    ng.morphAttributes = g0.morphAttributes; ng.morphTargetsRelative = g0.morphTargetsRelative; ng.groups = g0.groups; ng.boundingBox = g0.boundingBox; ng.boundingSphere = g0.boundingSphere; ng.userData = g0.userData; mesh.geometry = ng;
    const en = entries.get(mesh); if (en) { en.geometry = ng; en.st.geometry = ng; }
  }
  const keyBase = () => (env.cfg.key || '').trim() || 'Shape 1';
  function partFor(s, name) {
    let p = s.parts.get(name);
    if (!p) {
      const mesh = s.mesh, k = K.ensureKey(mesh, name), en = s.en; if (en.geometry !== mesh.geometry) { en.geometry = mesh.geometry; en.st.geometry = mesh.geometry; }
      en.st.influences = mesh.morphTargetInfluences;
      if ((mesh.morphTargetInfluences[k] || 0) < 0.05) { mesh.morphTargetInfluences[k] = 1; core.computeEff(en.st); core.computeNormals(en.st); say('"' + name + '" was turned off; it is on again so you can see the stroke.'); }
      p = { name, k, T: mesh.geometry.morphAttributes.position[k].array, rec: new Map() }; s.parts.set(name, p);
    }
    return p;
  }
  function ensureColors(mesh) {   /* Paint: a colour per point (white = the texture as it was), on the piece's own copy of its material */
    const g = mesh.geometry; if (!g.attributes.color) { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    if (!mesh.userData._paintMat) { const mats = [].concat(mesh.material).map(m => { const c = m.clone(); c.vertexColors = true; c.needsUpdate = true; return c; }); mesh.material = Array.isArray(mesh.material) ? mats : mats[0]; mesh.userData._paintMat = true; }
    return g.attributes.color;
  }

  /* ---------- a stroke ---------- */
  function symFor(mesh, c, cfg) { return cfg.sym === 'radial' || cfg.sym === 'both' ? { radial: { count: cfg.count, ...K.limbAxis(mesh, c) } } : null; }
  function opts(s, cfg, extra) { return { mode: s.mode, radius: radiusOf(s.mesh, cfg.size), strength: cfg.strength / 100 * GAIN * (s.mode === 'smear' || s.mode === 'smooth' ? 2.5 : 1), sign: cfg.op === 'subtract' ? -1 : 1, falloff: cfg.falloff, down: new V3(0, -1, 0).transformDirection(new M4().copy(s.mesh.matrixWorld).invert()), dot: cfg.dot, ...extra }; }
  function begin(hand, hit, cfg) {
    const mesh = hit.mesh, en = hit.en; if (env.strokeStart) env.strokeStart();
    const mode = cfg.op === 'paint' ? 'paint' : cfg.mode === 'clay' ? 'clay' : cfg.mode;
    const s = { hand: hand.id, mesh, en, mode, parts: new Map(), lastC: null, hold: 0, prevTip: hand.tip.clone(), recC: mode === 'paint' ? new Map() : null };
    if (mode === 'paint') s.colorAttr = ensureColors(mesh);
    if (mode === 'grab' || mode === 'smear') {   /* a move of the hand is turned back into rest space through the skin at the pinched point */
      const L = new M4(); if (skinned(mesh)) { const A = skinMatrix(mesh, hit.i, new M4()); L.copy(mesh.bindMatrixInverse).multiply(A).multiply(mesh.bindMatrix); } L.setPosition(0, 0, 0); s.inv = new M4().copy(L).invert(); s.prev = mesh.worldToLocal(hand.tip.clone());
    }
    if (mode === 'grab') {
      const st = en.st, g = st.group[hit.i], c = new V3(st.eff[g * 3], st.eff[g * 3 + 1], st.eff[g * 3 + 2]), base = keyBase(), r = radiusOf(mesh, cfg.size), list = [];
      if (cfg.sym === 'mirror' || cfg.sym === 'both') { const side = K.sideOf(mesh, c), other = side === 'left' ? 'right' : 'left'; list.push({ c, name: base + ' (' + side + ')', sign: 1 }, { c: new V3(-c.x, c.y, c.z), name: base + ' (' + other + ')', sign: -1 }); }
      else list.push({ c, name: base, sign: 1 });
      s.grabs = list.map(x => ({ g: core.grabBegin(st, x.c, r, null, cfg.falloff), name: x.name, sign: x.sign }));
    }
    hs.set(hand.id, s); return s;
  }
  const mergeRec = (a, b) => { b.forEach((v, k) => { if (!a.has(k)) a.set(k, v); }); return a; };
  function step(s, hand, hit, dt, cfg) {
    const mesh = s.mesh, en = s.en, st = en.st;
    if (s.mode === 'grab') {
      const cur = mesh.worldToLocal(hand.tip.clone()), d = cur.clone().sub(s.prev); s.prev = cur; const dr = d.applyMatrix4(s.inv);
      s.grabs.forEach(x => { const p = partFor(s, x.name); core.grabMove(st, x.g, new V3(dr.x * x.sign, dr.y, dr.z), { target: p.T, tw: mesh.morphTargetInfluences[p.k] || 1 }); p.rec = mergeRec(p.rec, x.g.rec); mesh.geometry.morphAttributes.position[p.k].needsUpdate = true; });
      mirrorToShells(mesh); return true;
    }
    let delta = null; if (s.mode === 'smear') { const cur = mesh.worldToLocal(hand.tip.clone()); delta = cur.clone().sub(s.prev).applyMatrix4(s.inv); s.prev = cur; if (delta.lengthSq() < 1e-12) return; }
    if (!hit || hit.mesh !== mesh) return;
    const g = st.group[hit.i], c = new V3(st.eff[g * 3], st.eff[g * 3 + 1], st.eff[g * 3 + 2]), n = new V3(st.nrm[g * 3], st.nrm[g * 3 + 1], st.nrm[g * 3 + 2]), r = radiusOf(mesh, cfg.size);
    s.hold += dt; const dist = s.lastC ? s.lastC.distanceTo(c) : 1e9, spacing = s.mode === 'dots' ? r * 1.6 : r * 0.3;
    if (!(dist > spacing || (s.mode !== 'dots' && s.hold > 0.1) || s.mode === 'smear')) return;
    const dir = s.lastC && dist > 1e-6 ? c.clone().sub(s.lastC).normalize() : null; s.hold = 0; s.lastC = c.clone();
    const base = keyBase(), o = opts(s, cfg, { delta, dir, color: cfg.paintRGB });
    const one = (cc, nn, name, sign) => {
      if (s.mode === 'paint') { core.stroke(st, cc, nn, { ...o, sym: symFor(mesh, cc, cfg), target: null }, null, s.recC); return; }
      const p = partFor(s, name), oo = { ...o, target: p.T, tw: mesh.morphTargetInfluences[p.k] || 1, sym: symFor(mesh, cc, cfg) }; if (sign < 0 && oo.delta) oo.delta = new V3(-oo.delta.x, oo.delta.y, oo.delta.z); if (sign < 0 && oo.dir) oo.dir = new V3(-oo.dir.x, oo.dir.y, oo.dir.z);
      core.stroke(st, cc, nn, oo, p.rec); mesh.geometry.morphAttributes.position[p.k].needsUpdate = true;
    };
    if (cfg.sym === 'mirror' || cfg.sym === 'both') { const side = K.sideOf(mesh, c), other = side === 'left' ? 'right' : 'left'; one(c, n, base + ' (' + side + ')', 1); one(new V3(-c.x, c.y, c.z), new V3(-n.x, n.y, n.z), base + ' (' + other + ')', -1); }
    else one(c, n, base, 1);
    mirrorToShells(mesh); return true;   /* a dab happened (the engine ticks the controller) */
  }
  function end(s) {
    hs.delete(s.hand); const mesh = s.mesh, en = s.en, st = en.st;
    if (s.mode === 'paint') {
      if (!s.recC.size) return false; let rec = s.recC; const ca = s.colorAttr, flip = () => { rec = core.swap(st, rec, null, ca); freshGeometry(mesh); };
      freshGeometry(mesh); env.pushUndo({ label: 'paint', undo: flip, redo: flip }); env.dirty(mesh); say('Painted ' + s.recC.size.toLocaleString('en-US') + ' points.'); return true;
    }
    const parts = [...s.parts.values()]; parts.forEach(p => { if (s.grabs) s.grabs.forEach(x => { if (x.name === p.name) p.rec = mergeRec(p.rec, x.g.rec); }); });
    const live = parts.filter(p => p.rec.size); if (!live.length) return false;
    core.finish(st, { target: {} }); const changed = new Set(); live.forEach(p => p.rec.forEach((_, m) => changed.add(m)));
    const recs = live.map(p => ({ p, m: p.rec })), flip = () => { recs.forEach(r => { r.m = core.swap(st, r.m, r.p.T); mesh.geometry.morphAttributes.position[r.p.k].needsUpdate = true; }); refresh(en, [...changed]); freshGeometry(mesh); mirrorToShells(mesh); env.afterEdit && env.afterEdit(mesh); };
    refresh(en, [...changed]); freshGeometry(mesh);
    env.pushUndo({ label: s.mode, undo: flip, redo: flip, keys: live.map(p => p.name) }); env.dirty(mesh); env.afterEdit && env.afterEdit(mesh);
    const nm = ({ deflate: 'Indent', dots: 'Dots', pinch: 'Pinch' })[s.mode] || s.mode[0].toUpperCase() + s.mode.slice(1);
    say(`${nm}: ${changed.size.toLocaleString('en-US')} points in ${live.map(p => '"' + p.name + '"').join(' and ')}.`); return true;
  }
  function endAll() { [...hs.values()].forEach(end); }

  /* ---------- keys (the menu's Keys page) ---------- */
  function newKey() { const m = env.targets()[0]; env.cfg.key = m ? K.nextKeyName(m) : 'Shape 1'; say('Next stroke starts a new shape key: ' + env.cfg.key + '.'); return env.cfg.key; }
  function keys() { const out = []; env.targets().forEach(m => K.keysOf(m).forEach(n => out.push({ mesh: m, name: n, value: m.morphTargetInfluences[m.morphTargetDictionary[n]] || 0 }))); return out; }
  function setKey(name, v) { env.targets().forEach(m => { const k = m.morphTargetDictionary && m.morphTargetDictionary[name]; if (k !== undefined) { m.morphTargetInfluences[k] = v; mirrorToShells(m); const en = entries.get(m); if (en) { en.st.influences = m.morphTargetInfluences; core.computeEff(en.st); core.computeNormals(en.st); core.rebuildGrid(en.st); refresh(en); } } }); }
  function frameStart() { built = 0; waiting = false; }
  return { entryOf, hasEntry, nearest, pickable, hitAt, begin, step, end, endAll, strokes: hs, keys, setKey, newKey, frameStart, clear: () => entries.clear(), skinned, isFigurePiece, mirrorToShells, radiusOf, K, get waiting() { return waiting; } };
}
