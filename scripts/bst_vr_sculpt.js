/* bst_vr_sculpt.js: sculpting with your hands in the headset (Ruth, 2026-10-10: "i sculpt with my hands"; "the whole point of this is the VR part").
   Pure engine, no page globals: createVrSculpt(THREE, S, host) takes three (r128 in the Atelier headset, r186 in BST), the sculpt core S = makeSculpt(THREE) from bst_sculpt_core.js, and a host
   object. The host (vr_core.js) calls frame(hands, dt) every XR frame and draws the cursor ball; this module never touches the scene.
     hands: [{ id, tip: Vector3 in world space (the index fingertip, or the controller tip), pinch: boolean (thumb and index together, or the trigger) }]
     host:  { say(text), setBench(on) (hide the room, the other figures and the props, show only the piece), figure() -> the Object3D to sculpt, exportGlb(root) -> Promise<ArrayBuffer> (optional),
              sources() -> [{name, source, restricted}] (optional, what the saved card inherits),
              strokeStart() (optional, called at the first dab of each pinch-hold, so the host can push its own undo step), dirty(mesh) (optional) }
   A hand sculpts where the fingertip is near the skin of the figure AS IT IS POSED: the engine keeps its own skinned copy of every vertex position (r128 has no getVertexPosition) and finds the
   nearest one, so a posed figure sculpts true. Pinch and hold: Inflate grows the skin, Deflate (indent) pushes it in, Melt sags it, Smooth evens it, Grab drags the soft region with your hand.
   Strokes go into named SHAPE KEYS (sliders from 0 to 1 that save in the .glb): Mirror makes a left key and a right key together, 360 repeats round the nearest bone. One pinch-hold = one undo step. */
import { makeShapeKeys } from '/pe_lib/bst_shapekeys.js';
import { tubeGeometry, strokeCopies } from '/pe_lib/bst_squeeze.js';
import { cutGeometry, carveGeometry, eraseGeometry, healGeometry, subdivideGeometry, stampGeometry, solidFromMesh, solidUnion } from '/pe_lib/bst_cut.js';
import { wrinkleGeometry } from '/pe_lib/bst_wrinkle.js?v=1';   /* the Wrinkle brush (Ruth 2026-10-11): splits the skin finely under a small ball and pushes a groove in */

export function createVrSculpt(THREE, S, host) {
  host = host || {};
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, K = makeShapeKeys(THREE), say = t => { try { host.say && host.say(t); } catch (e) { /* the host's voice is optional */ } };
  const GAIN = 0.2;   /* a hand dabs ten times a second while it holds still: at full strength the desktop's one-click amount would stack to a hard ridge in a second, so each dab is a fifth of it (about 1 cm a second of holding at 5 cm and 50%) */
  const cfg = { stampScale: 1, carveKeep: 'outside', cutGoes: 'front', cutBlade: 'saw', cutCap: true, profile: 'round', thick: 'steady', color: 0, mode: 'inflate', size: 5, strength: 50, sym: 'off', count: 6, key: 'Shape 1', into: 'key', on: false };
  const entries = new Map(), undoS = [], redoS = [], hs = new Map(), cursor = { hands: {} };
  const squeezed = [], sqS = new Map(), SQ_COLORS = [0xe8c9a0, 0xd9776a, 0x8fb8d9, 0xa7d49b, 0xf2d56b, 0xb79ad9, 0xf5f0e6, 0x5a5560]; let sqN = 0;
  let figure = null, meshes = [];

  /* ---------- a skinned copy of every vertex, kept current, with a grid for nearest-point queries ---------- */
  const cutHeld = new Set(), carveS = new Map(), sawS = new Map();
  let tick = 0;
  const skinned = m => !!(m.isSkinnedMesh && m.skeleton);
  function effRest(mesh, i, out) {   /* rest position plus the shape keys at their current strength */
    const g = mesh.geometry, P = g.attributes.position; out.fromBufferAttribute(P, i);
    const mp = g.morphAttributes && g.morphAttributes.position, inf = mesh.morphTargetInfluences;
    if (mp && inf) for (let k = 0; k < mp.length; k++) { const w = inf[k]; if (w) { const a = mp[k].array; out.x += a[i * 3] * w; out.y += a[i * 3 + 1] * w; out.z += a[i * 3 + 2] * w; } }
    return out;
  }
  function skinMatrix(mesh, i, out) {   /* the weighted sum of the bone matrices for vertex i, in the frame the bind matrices use */
    const g = mesh.geometry, ia = g.attributes.skinIndex.array, wa = g.attributes.skinWeight.array, bm = mesh.skeleton.boneMatrices, e = out.elements; for (let k = 0; k < 16; k++) e[k] = 0;
    const t = skinMatrix.t || (skinMatrix.t = new M4());
    for (let k = 0; k < 4; k++) { const w = wa[i * 4 + k]; if (!w) continue; t.fromArray(bm, ia[i * 4 + k] * 16); for (let q = 0; q < 16; q++) e[q] += t.elements[q] * w; }
    return out;
  }
  function posedAt(mesh, i, out) {
    effRest(mesh, i, out); if (!skinned(mesh)) return out;
    const A = posedAt.A || (posedAt.A = new M4()); skinMatrix(mesh, i, A);
    return out.applyMatrix4(mesh.bindMatrix).applyMatrix4(A).applyMatrix4(mesh.bindMatrixInverse);
  }
  function buildGrid(en) {
    const n = en.posed.length / 3, bb = new THREE.Box3(), v = new V3(); for (let i = 0; i < n; i++) { v.set(en.posed[i * 3], en.posed[i * 3 + 1], en.posed[i * 3 + 2]); bb.expandByPoint(v); }
    const sz = bb.getSize(new V3()); en.cell = Math.max(sz.x, sz.y, sz.z) / 40 || 1; en.origin = bb.min.clone(); en.grid = new Map(); en.hi = [Math.floor(sz.x / en.cell) + 1, Math.floor(sz.y / en.cell) + 1, Math.floor(sz.z / en.cell) + 1];
    for (let i = 0; i < n; i++) { const k = cellKey(en, en.posed[i * 3], en.posed[i * 3 + 1], en.posed[i * 3 + 2]); let a = en.grid.get(k); if (!a) { a = []; en.grid.set(k, a); } a.push(i); }
  }
  const cellKey = (en, x, y, z) => Math.floor((x - en.origin.x) / en.cell) + ',' + Math.floor((y - en.origin.y) / en.cell) + ',' + Math.floor((z - en.origin.z) / en.cell);
  /* a cube or any coarse object has too few points for the brushes to find (Ruth 2026-10-11: a flattened cube took no sculpt tool): the first time one is touched it gets points added, in the world's measure, up to 60k */
  function densify(mesh) {
    if (figure && figure.getObjectById(mesh.id)) return;   /* a figure's own pieces keep the points they were made with */
    if (mesh.userData && mesh.userData._bstDense === mesh.geometry.id) return; mesh.userData = mesh.userData || {}; mesh.userData._bstDense = mesh.geometry.id;
    const sc = new V3(); mesh.matrixWorld.decompose(new V3(), new THREE.Quaternion(), sc); const r = subdivideGeometry(THREE, mesh.geometry, { scale: { x: Math.abs(sc.x), y: Math.abs(sc.y), z: Math.abs(sc.z) }, maxEdge: 0.04, maxPoints: 60000 }); if (!r) return;
    mesh.geometry = r.geometry; mesh.userData._bstDense = r.geometry.id; if (mesh.updateMorphTargets) mesh.updateMorphTargets(); entries.delete(mesh);
    say((mesh.name ? '"' + mesh.name + '"' : 'This object') + ' had too few points to shape, so points were added (' + r.geometry.attributes.position.count.toLocaleString('en-US') + ' now).');
  }
  function entryOf(mesh) {
    let en = entries.get(mesh); if (en && en.geometry === mesh.geometry) { if (en.lazy) { en.st = S.prepare(mesh.geometry); buildGrid(en); en.lazy = false; } return en; }
    mesh.updateMatrixWorld(true); if (skinned(mesh)) mesh.skeleton.update(); else densify(mesh);
    const n = mesh.geometry.attributes.position.count; en = { mesh, geometry: mesh.geometry, st: S.prepare(mesh.geometry), posed: new Float32Array(n * 3) };
    const v = new V3(); for (let i = 0; i < n; i++) { posedAt(mesh, i, v); en.posed[i * 3] = v.x; en.posed[i * 3 + 1] = v.y; en.posed[i * 3 + 2] = v.z; }
    buildGrid(en); entries.set(mesh, en); return en;
  }
  /* Only meshes near the hand are looked at, and only a bounded number of points get prepared per frame: entering Sculpt in a big Build-mode room (140 things, 256k triangles) used to prepare every mesh at once and froze the Quest (Ruth 2026-10-11). */
  let built = 0;
  const hasEntry = m => { const en = entries.get(m); return !!(en && en.geometry === m.geometry); };
  function pickable(tip, reach) {
    const out = [], box = new THREE.Box3();
    for (const m of meshes) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); m.updateMatrixWorld();
      box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); if (box.distanceToPoint(tip) > reach + (skinned(m) ? 0.6 : 0)) continue;
      if (!hasEntry(m)) { const n = m.geometry.attributes.position.count; if (n > 250000) continue; if (built > 0 && built + n > 30000) { cursor.waiting = true; continue; } built += n; }
      out.push(m);
    }
    return out;
  }
  function refresh(en, idx) { const v = new V3(); en.mesh.updateMatrixWorld(true); if (skinned(en.mesh)) en.mesh.skeleton.update(); (idx || Array.from({ length: en.posed.length / 3 }, (_, i) => i)).forEach(i => { posedAt(en.mesh, i, v); en.posed[i * 3] = v.x; en.posed[i * 3 + 1] = v.y; en.posed[i * 3 + 2] = v.z; }); buildGrid(en); }
  function nearest(en, p, reach) {   /* the closest vertex to p (mesh-local, posed) within reach, or null */
    let best = -1, bd = reach * reach; const r = Math.ceil(reach / en.cell), cx = Math.floor((p.x - en.origin.x) / en.cell), cy = Math.floor((p.y - en.origin.y) / en.cell), cz = Math.floor((p.z - en.origin.z) / en.cell), P = en.posed;
    const hi = en.hi || [1e9, 1e9, 1e9];   /* never walk cells beyond the mesh: a big reach on a tiny mesh was millions of empty lookups a frame and hung the Quest */
    for (let i = Math.max(cx - r, 0); i <= Math.min(cx + r, hi[0]); i++) for (let j = Math.max(cy - r, 0); j <= Math.min(cy + r, hi[1]); j++) for (let k = Math.max(cz - r, 0); k <= Math.min(cz + r, hi[2]); k++) {
      const a = en.grid.get(i + ',' + j + ',' + k); if (!a) continue;
      for (const v of a) { const dx = P[v * 3] - p.x, dy = P[v * 3 + 1] - p.y, dz = P[v * 3 + 2] - p.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = v; } }
    }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  }

  /* ---------- the figure and the bench ---------- */
  function collect(root, any) { const out = []; if (!root) return out; root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count >= 8 && o.visible && (any ? !/^vr/.test(o.name || '') : skinned(o)) && !(o.userData && o.userData._bfx) && !/^_/.test(o.name || '')) out.push(o); }); return out; }   /* the Atelier's skin-shader shells (userData._bfx) and its depth helpers (names starting with _) are copies of the body, not the body: sculpting them would shape the wrong mesh */
  /* objects in the room (a prop you pulled out, a shape, a speaker's stand) are sculptable too: the host lists them, each plain mesh is its own piece */
  const propMeshes = () => { const out = []; try { ((host.props && host.props()) || []).forEach(r => { if (r && r !== figure) collect(r, true).forEach(m => { if (!out.includes(m)) out.push(m); }); }); } catch (e) { /* the host's list is optional */ } return out.filter(m => !(figure && figure.getObjectById(m.id))); };
  const squeezeMeshes = () => { const out = []; squeezed.forEach(e => { if (e.object.parent) collect(e.object, true).forEach(m => { if (!out.includes(m)) out.push(m); }); }); return out; };   /* tubes squeezed out in this session are objects like any other: sculptable, stampable, savable */
  let meshFilter = null;   /* the host can limit what the tools touch: Clothes only (Ruth 2026-10-11) */
  const targets = () => { const all = collect(figure).concat(propMeshes(), squeezeMeshes().filter(m => !propMeshes().includes(m))).filter(m => !(m.userData && m.userData.figLocked)); return meshFilter ? all.filter(meshFilter) : all; };   /* Lock figure (lib/figure_lock.js): a locked body is skipped, the clothes on it stay sculptable */
  function enter(root) {
    figure = root || (host.figure && host.figure());
    meshes = targets(); if (!meshes.length) { say(figure ? 'This figure has no skin to sculpt.' : 'No figure or object to sculpt.'); return false; }
    try { host.setBench && host.setBench(true); } catch (e) { /* the bench is the host's */ }
    cfg.on = true; say('Sculpt bench. Pinch with a fingertip on the skin: Inflate grows it, Indent pushes it in, Melt sags it, Smooth evens it, Grab drags it.'); return true;
  }
  function leave() { endAll(); try { host.setBench && host.setBench(false); } catch (e) { /* the bench is the host's */ } cfg.on = false; cursor.hands = {}; }

  /* the Atelier draws its skin shaders on shell copies of the body (userData._bfx, same vertices in the same order); a key sculpted on the body must move them too or the body pokes through the shell */
  function mirrorToShells(mesh) {
    if (!figure || !K.keysOf(mesh).length) return;
    try { window.BodyFX && BodyFX.syncMorph && BodyFX.syncMorph(mesh); } catch (e) { /* the glow is the Atelier's; the sculpt goes on without it */ }   /* BodyFX.syncMorph feeds the summed key to each shell's own attribute; a key on a shell's ShaderMaterial hung the page (body-shader lane 2026-10-10) */
  }

  /* ---------- a stroke ---------- */
  const keyBase = () => (cfg.key || '').trim() || 'Shape 1';
  const radiusOf = mesh => cfg.size / 100 / (mesh.matrixWorld.getMaxScaleOnAxis() || 1);
  function symFor(mesh, c) { return cfg.sym === 'radial' ? { radial: { count: cfg.count, ...K.limbAxis(mesh, c) } } : null; }
  function partFor(s, name) {
    let p = s.parts.get(name);
    if (!p) { const k = K.ensureKey(s.mesh, name); if (s.en.geometry !== s.mesh.geometry) { s.en.geometry = s.mesh.geometry; s.en.st.geometry = s.mesh.geometry; } p = { name, k, T: s.mesh.geometry.morphAttributes.position[k].array, rec: new Map() }; s.parts.set(name, p); }
    return p;
  }
  function dabAt(s, c, n) {
    const o = { mode: cfg.mode, radius: radiusOf(s.mesh), strength: cfg.strength / 100 * GAIN, sym: null, target: null, down: new V3(0, -1, 0).transformDirection(new M4().copy(s.mesh.matrixWorld).invert()) };
    const one = (cc, nn, name) => { const p = partFor(s, name); S.stroke(s.en.st, cc, nn, { ...o, target: p.T, sym: symFor(s.mesh, cc) }, p.rec); s.mesh.geometry.morphAttributes.position[p.k].needsUpdate = true; };
    const base = keyBase();
    if (cfg.sym === 'mirror') { const side = K.sideOf(s.mesh, c), other = side === 'left' ? 'right' : 'left'; one(c, n, base + ' (' + side + ')'); one(new V3(-c.x, c.y, c.z), new V3(-n.x, n.y, n.z), base + ' (' + other + ')'); }
    else one(c, n, base);
  }
  function normalAt(mesh, i, out) { const N = mesh.geometry.attributes.normal; if (N) return out.set(N.array[i * 3], N.array[i * 3 + 1], N.array[i * 3 + 2]).normalize(); return out.set(0, 1, 0); }
  function begin(h, hand, hit, mesh, en) {
    if (host.strokeStart) { try { host.strokeStart(); } catch (e) { /* the host's undo is optional */ } }
    const s = { hand: hand.id, mesh, en, parts: new Map(), lastC: null, hold: 0, grab: null };
    hs.set(hand.id, s);
    if (cfg.mode === 'grab') {   /* pick the soft region once, then move it with the hand; the move is turned back into rest space through the skin at the pinched vertex */
      const c = new V3().fromBufferAttribute(mesh.geometry.attributes.position, hit.i), L = new M4();
      if (skinned(mesh)) { const A = skinMatrix(mesh, hit.i, new M4()); L.copy(mesh.bindMatrixInverse).multiply(A).multiply(mesh.bindMatrix); }
      L.setPosition(0, 0, 0); s.inv = new M4().copy(L).invert(); s.prev = mesh.worldToLocal(hand.tip.clone());
      const base = keyBase(), r = radiusOf(mesh), list = [];
      if (cfg.sym === 'mirror') { const side = K.sideOf(mesh, c), other = side === 'left' ? 'right' : 'left'; list.push({ c, name: base + ' (' + side + ')', sign: 1 }, { c: new V3(-c.x, c.y, c.z), name: base + ' (' + other + ')', sign: -1 }); }
      else list.push({ c, name: base, sign: 1 });
      s.grabs = list.map(g => ({ g: S.grabBegin(en.st, g.c, r, null), name: g.name, sign: g.sign }));
    }
    return s;
  }
  function moveStroke(s, hand, hit, dt) {
    const mesh = s.mesh, en = s.en;
    if (cfg.mode === 'grab') {
      const cur = mesh.worldToLocal(hand.tip.clone()), d = cur.clone().sub(s.prev); s.prev = cur;
      const dr = d.applyMatrix4(s.inv);
      s.grabs.forEach(x => { const p = partFor(s, x.name); S.grabMove(en.st, x.g, new V3(dr.x * x.sign, dr.y, dr.z), { target: p.T, sym: null }); p.rec = mergeRec(p.rec, x.g.rec); s.mesh.geometry.morphAttributes.position[p.k].needsUpdate = true; });
      mirrorToShells(mesh); return;
    }
    if (!hit) return;
    const c = new V3().fromBufferAttribute(mesh.geometry.attributes.position, hit.i), n = normalAt(mesh, hit.i, new V3()), r = radiusOf(mesh);
    s.hold += dt; const moved = !s.lastC || s.lastC.distanceTo(c) > r * 0.3;
    if (moved || s.hold > 0.1) { s.hold = 0; s.lastC = c.clone(); dabAt(s, c, n); mirrorToShells(mesh); }
  }
  function mergeRec(a, b) { b.forEach((v, k) => { if (!a.has(k)) a.set(k, v); }); return a; }
  function endStroke(s) {
    hs.delete(s.hand);
    const parts = [...s.parts.values()]; parts.forEach(p => { if (s.grabs) s.grabs.forEach(x => { if (x.name === p.name) p.rec = mergeRec(p.rec, x.g.rec); }); });
    const live = parts.filter(p => p.rec.size); if (!live.length) return;
    S.finish(s.en.st, { target: {} });
    const mesh = s.mesh, changed = new Set(); live.forEach(p => p.rec.forEach((_, m) => changed.add(m)));
    const recs = live.map(p => ({ p, m: p.rec })); const flip = () => { recs.forEach(r => { r.m = S.swap(s.en.st, r.m, r.p.T); mesh.geometry.morphAttributes.position[r.p.k].needsUpdate = true; }); S.rebuildGrid(s.en.st); refresh(s.en, [...changed]); mirrorToShells(mesh); };
    refresh(s.en, [...changed]); undoS.push({ label: cfg.mode, flip, keys: live.map(p => p.name) }); redoS.length = 0; if (undoS.length > 100) undoS.shift();
    if (host.dirty) try { host.dirty(mesh); } catch (e) { /* optional */ }
    say(`${cfg.mode === 'deflate' ? 'Indent' : cfg.mode[0].toUpperCase() + cfg.mode.slice(1)}: ${[...changed].length.toLocaleString('en-US')} points in ${live.map(p => '"' + p.name + '"').join(' and ')}.`);
  }
  function endAll() { [...sqS.values()].forEach(sqEnd); sqS.clear(); [...hs.values()].forEach(endStroke); [...carveS.entries()].forEach(([k, cs]) => { carveEnd(cs); carveS.delete(k); }); [...sawS.entries()].forEach(([k, sw]) => { sawEnd(sw); sawS.delete(k); }); }


  /* ---------- Cut: a flat plane at the fingertip, facing the way the hand points; the side the hand points to goes (cfg.cutGoes 'front'), or the other side ('back'). The cap closes the open end. One undo step. ---------- */
  const shellsOf = mesh => { const out = []; if (!figure) return out; const n = mesh.geometry.attributes.position.count; figure.traverse(o => { if (o !== mesh && o.isMesh && o.geometry && ((o.userData && o.userData._bfx) || /^_/.test(o.name || '')) && o.geometry.attributes.position.count === n) out.push(o); }); return out; };
  /* ---------- Saw (Ruth 2026-10-13: "why is the blade slicing everything off instead of just being a saw that is the width of how much it cuts"): the blade is a thin slab as wide as the Size ring, centred on the fingertip and facing the way the hand points. Only the skin inside that slab goes, a slit the width of the blade, so the rest of the piece stays. cfg.cutBlade 'plane' brings back the old whole-plane cut. ---------- */
  function sawDab(hand, sw) {
    if (!hand.dir) { say('The saw needs the direction your hand points.'); return false; }
    let bm = sw && sw.mesh || null;
    if (!bm) { let bd = 1e9; for (const m of pickable(hand.tip, 0.25)) { const en = entryOf(m); m.updateMatrixWorld(); const h = nearest(en, m.worldToLocal(hand.tip.clone()), 0.25 / (m.matrixWorld.getMaxScaleOnAxis() || 1)); if (h && h.d < bd) { bd = h.d; bm = m; } } }
    if (!bm) { if (!sw || !sw.n) say('Hold the saw on the piece you want to cut, within a hand\'s width of it.'); return false; }
    bm.updateMatrixWorld(true); const R = Math.max(0.005, cfg.size / 100), kerf = Math.max(0.004, Math.min(0.012, R * 0.2));
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), hand.dir.clone().normalize()), bladeM = new M4().compose(hand.tip, q, new V3(1, 1, 1)), bodyInv = new M4().copy(bm.matrixWorld).invert();
    const sd = solidFromMesh(THREE, new THREE.BoxGeometry(2 * R, 2 * R, kerf), new M4().multiplyMatrices(bodyInv, bladeM), null); if (!sd || !sd.closed) return false;
    const en = entryOf(bm), inPosed = en.posed, jobs = [bm].concat(shellsOf(bm));
    let restFix = null; if (skinned(bm)) { const cache = new Map(); restFix = (i, d) => { let m = cache.get(i); if (!m) { const A = skinMatrix(bm, i, new M4()), Lm = new M4().copy(bm.bindMatrixInverse).multiply(A).multiply(bm.bindMatrix); Lm.setPosition(0, 0, 0); m = Lm.invert(); cache.set(i, m); } return d.clone().applyMatrix4(m); }; }
    const res = stampGeometry(THREE, bm.geometry, sd, { posed: inPosed, keep: 'outside', restFix }); if (!res) return false;
    if (!sw.olds.size && host.strokeStart) { try { host.strokeStart(); } catch (e) { /* optional */ } }
    jobs.forEach(j => { if (!sw.olds.has(j)) sw.olds.set(j, j.geometry); });
    bm.geometry = res.geometry; if (bm.updateMorphTargets) bm.updateMorphTargets(); entries.delete(bm); entries.set(bm, { mesh: bm, geometry: res.geometry, st: null, posed: res.posed, lazy: true });
    jobs.slice(1).forEach(j => { const r2 = stampGeometry(THREE, j.geometry, sd, { posed: inPosed, keep: 'outside', restFix }); if (r2) { j.geometry = r2.geometry; if (j.updateMorphTargets) j.updateMorphTargets(); entries.delete(j); } });
    sw.mesh = bm; sw.n++; sw.R = R; sw.last = hand.tip.clone(); return true;
  }
  /* a sweep is one undo step, however far the hand went */
  function sawEnd(sw) {
    if (!sw || !sw.olds.size) return; const bm = sw.mesh, jobs = [...sw.olds.keys()].map(j => ({ j, old: sw.olds.get(j), neu: j.geometry })); let at = 'new'; mirrorToShells(bm);
    const flip = () => { at = at === 'new' ? 'old' : 'new'; jobs.forEach(x => { x.j.geometry = at === 'new' ? x.neu : x.old; if (x.j.updateMorphTargets) x.j.updateMorphTargets(); entries.delete(x.j); }); entryOf(bm); mirrorToShells(bm); };
    undoS.push({ label: 'saw', flip, keys: [] }); redoS.length = 0; if (undoS.length > 100) undoS.shift(); entryOf(bm);
    if (host.dirty) try { host.dirty(bm); } catch (e) { /* optional */ }
    say('Sawed through "' + String(bm.name || 'the piece').replace(/^cloth_/, '') + '" (' + sw.n + ' pass' + (sw.n === 1 ? '' : 'es') + ', ' + Math.round(sw.R * 200) + ' cm wide). Undo puts it all back.');
  }
  function sawAt(hand) { const sw = { mesh: null, olds: new Map(), n: 0, R: 0, last: null }; const ok = sawDab(hand, sw); if (ok) sawEnd(sw); return ok; }
  function cutAt(hand) {
    if (cfg.cutBlade !== 'plane') return sawAt(hand);
    if (!hand.dir) { say('Cut needs the direction your hand points.'); return false; }
    let bm = null, bd = 1e9; for (const m of pickable(hand.tip, 0.25)) { const en = entryOf(m); m.updateMatrixWorld(); const h = nearest(en, m.worldToLocal(hand.tip.clone()), 0.25 / (m.matrixWorld.getMaxScaleOnAxis() || 1)); if (h && h.d < bd) { bd = h.d; bm = m; } }
    if (!bm) { say('Hold the cut plane on the piece you want to cut, within a hand\'s width of it.'); return false; }
    const en = entryOf(bm), inv = new M4().copy(bm.matrixWorld).invert(), nl = hand.dir.clone().transformDirection(inv), pl = bm.worldToLocal(hand.tip.clone()), d0 = nl.dot(pl);
    const n = en.posed.length / 3, dist = new Float32Array(n); for (let i = 0; i < n; i++) dist[i] = nl.x * en.posed[i * 3] + nl.y * en.posed[i * 3 + 1] + nl.z * en.posed[i * 3 + 2] - d0;
    const keep = cfg.cutGoes === 'front' ? 'back' : 'front', jobs = [bm].concat(shellsOf(bm)), done = [];
    for (const m of jobs) { const r = cutGeometry(THREE, m.geometry, { n: nl, d: d0 }, { keep, dist, cap: cfg.cutCap }); if (!r) { if (m === bm) { say('The plane does not cut anything: move it onto the piece, or it would take all of it.'); return false; } continue; } done.push({ m, old: m.geometry, neu: r.geometry, r }); }
    const main = done[0].r; if (host.strokeStart) { try { host.strokeStart(); } catch (e) { /* optional */ } }
    const apply = to => { done.forEach(j => { j.m.geometry = to === 'new' ? j.neu : j.old; if (j.m.updateMorphTargets) j.m.updateMorphTargets(); entries.delete(j.m); }); };
    apply('new'); mirrorToShells(bm); let at = 'new'; const flip = () => { at = at === 'new' ? 'old' : 'new'; apply(at); entryOf(bm); mirrorToShells(bm); };
    undoS.push({ label: 'cut', flip, keys: [] }); redoS.length = 0; if (undoS.length > 100) undoS.shift(); entryOf(bm);
    if (host.dirty) try { host.dirty(bm); } catch (e) { /* optional */ }
    say('Cut: ' + main.removed.toLocaleString('en-US') + ' triangles cut' + (cfg.cutCap ? ' and ' + main.capped + ' to close the end' : ', left open') + '. Undo puts it back.'); return true;
  }

  /* ---------- Carve: a ball at the fingertip takes the skin inside it away (subtract), or keeps only the skin inside it (intersect). Hold and sweep to carve a groove; one hold is one undo step. ---------- */
  function carveDab(cs, hand, mirrored) {
    const m = cs.mesh, en0 = entries.get(m), en = (cfg.mode === 'wrinkle' && en0 && en0.geometry === m.geometry) ? en0 : entryOf(m); m.updateMatrixWorld(); const c = m.worldToLocal(hand.tip.clone()), r = radiusOf(m), inPosed = en.posed, jobs = [m].concat(shellsOf(m)); if (mirrored) c.x = -c.x;
    const healing = cfg.mode === 'heal' || cfg.mode === 'close', fn = cfg.mode === 'erase' ? (g, b, o) => eraseGeometry(THREE, g, b, o) : healing ? (g, b, o) => healGeometry(THREE, g, b, { posed: o.posed, mode: cfg.mode === 'close' ? 'close' : 'smooth', split: r * Math.max(0.05, 0.4 - 0.0035 * cfg.strength) }) : cfg.mode === 'wrinkle' ? (g, b, o) => wrinkleGeometry(THREE, g, b, { posed: o.posed, depth: r * 0.0016 * cfg.strength, maxEdge: r * 0.8 }) : (g, b, o) => carveGeometry(THREE, g, b, o);   /* Wrinkle: a dab every quarter ball stacks about four dabs at the middle, so one pass is a groove about a third of the ball deep at 50%, with points added so it can bend */
    const res = fn(m.geometry, { c, r }, { posed: inPosed, keep: cfg.carveKeep }); if (!res) return false; if (!res.posed && !healing) res.posed = inPosed;
    if (!cs.olds.has(m)) jobs.forEach(j => cs.olds.set(j, j.geometry));
    m.geometry = res.geometry; if (m.updateMorphTargets) m.updateMorphTargets(); if (healing) entries.delete(m); else entries.set(m, { mesh: m, geometry: res.geometry, st: null, posed: res.posed, lazy: true });
    jobs.slice(1).forEach(j => { const r2 = fn(j.geometry, { c, r }, { posed: inPosed, keep: cfg.carveKeep }); if (r2) { j.geometry = r2.geometry; if (j.updateMorphTargets) j.updateMorphTargets(); entries.delete(j); } });
    cs.n = (cs.n || 0) + (healing ? (res.split || 0) + (res.closed || 0) : cfg.mode === 'wrinkle' ? (res.added || 0) : res.removed); if (healing || cfg.mode === 'wrinkle') cs.moved = (cs.moved || 0) + (res.moved || 0);
    if (!mirrored && cfg.mode === 'wrinkle' && cfg.sym === 'mirror') carveDab(cs, hand, true);   /* Mirror: the same mark on the other side of the face */
    return true;
  }
  function carveEnd(cs) {
    if (!cs.olds.size) return; const jobs = [...cs.olds.keys()].map(j => ({ j, old: cs.olds.get(j), neu: j.geometry })); let at = 'new';
    const flip = () => { at = at === 'new' ? 'old' : 'new'; jobs.forEach(x => { x.j.geometry = at === 'new' ? x.neu : x.old; if (x.j.updateMorphTargets) x.j.updateMorphTargets(); entries.delete(x.j); }); entryOf(cs.mesh); mirrorToShells(cs.mesh); };
    mirrorToShells(cs.mesh); undoS.push({ label: cs.mode || 'carve', flip, keys: [] }); redoS.length = 0; if (undoS.length > 100) undoS.shift(); entryOf(cs.mesh);
    if (host.dirty) try { host.dirty(cs.mesh); } catch (e) { /* optional */ }
    if (cs.mode === 'heal' || cs.mode === 'close') { say(cs.mode === 'close' ? 'Closed ' + cs.n + ' open loop' + (cs.n === 1 ? '' : 's') + ' with a fan of triangles. Undo puts it back.' : 'Edge healed: ' + cs.n + ' triangles added along the rim and the rim smoothed. Hold longer or sweep again for more. Undo puts it back.'); return; }
    if (cs.mode === 'wrinkle') { say('Wrinkle: ' + (cs.moved || 0).toLocaleString('en-US') + ' points pushed in' + (cs.n ? ', ' + cs.n.toLocaleString('en-US') + ' points added so it can bend' : '') + '. Undo puts it back.'); return; }
    say(cs.mode === 'erase' ? 'Erased: ' + cs.n.toLocaleString('en-US') + ' triangles went. Undo puts them back.' : (cfg.carveKeep === 'inside' ? 'Kept only what is inside the ball: ' : 'Carved: ') + cs.n.toLocaleString('en-US') + ' triangles went. Undo puts it back.');
  }

  /* ---------- Stamp: ANY closed object is your own subtraction tool. It rides in your hand (the host draws a ghost of it), and a pinch presses it into the figure or object: the skin inside the stamp goes
     (or, with the Carve+Stamp switch on keep-inside, only the skin inside it stays). The object must be a closed solid; one pinch is one undo step. host.stampSource() -> { root, name } says which object. ---------- */
  const effPositions = o => { const g = o.geometry, P = g.attributes.position, mp = g.morphAttributes && g.morphAttributes.position, inf = o.morphTargetInfluences, out = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { out[i * 3] = P.getX(i); out[i * 3 + 1] = P.getY(i); out[i * 3 + 2] = P.getZ(i); }
    if (mp && inf) for (let k = 0; k < mp.length; k++) { const w = inf[k]; if (w) { const a = mp[k].array; for (let i = 0; i < out.length; i++) out[i] += a[i] * w; } } return out; };   /* a sculpted shape is its base plus its shape keys at their strength */
  function stampSet() { const src = host.stampSource && host.stampSource(); if (!src) return null; const roots = (src.roots || (src.root ? [src.root] : [])).filter(r => r && r.parent); return roots.length ? { roots, name: src.name } : null; }
  function stampAt(hand) {
    const src = stampSet(); if (!src) { say('Pick a stamp first: More > Pick stamp. A group of objects is one stamp.'); return false; }
    const roots = src.roots; roots.forEach(r => r.updateMatrixWorld(true)); const under = m => { for (let q = m; q; q = q.parent) if (roots.includes(q)) return true; return false; }; let bm = null, bd = 1e9;
    for (const m of pickable(hand.tip, 0.3)) { if (under(m)) continue; const en = entryOf(m); m.updateMatrixWorld(); const h = nearest(en, m.worldToLocal(hand.tip.clone()), 0.3 / (m.matrixWorld.getMaxScaleOnAxis() || 1)); if (h && h.d < bd) { bd = h.d; bm = m; } }
    if (!bm) { say('The stamp is too far from the skin: press it onto the figure or object.'); return false; }
    const box = new THREE.Box3(); roots.forEach(r => box.expandByObject(r)); const pivot = box.getCenter(new V3()), pivInv = new M4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    const stampM = new M4().compose(hand.tip, hand.quat || new THREE.Quaternion(), new V3(1, 1, 1).multiplyScalar(cfg.stampScale || 1)), bodyInv = new M4().copy(bm.matrixWorld).invert(), solids = []; let open = [];
    roots.forEach(r => r.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || /^vr/.test(o.name || '') || (o.userData && o.userData._bfx)) return;
      const M = new M4().multiplyMatrices(bodyInv, new M4().multiplyMatrices(stampM, new M4().multiplyMatrices(pivInv, o.matrixWorld))), sd = solidFromMesh(THREE, o.geometry, M, effPositions(o)); if (!sd.closed) { open.push(o.name || 'a piece'); return; } solids.push(sd); }));
    if (!solids.length) { say(open.length ? 'That is not a closed solid (its skin has holes), so it cannot cut. A ball, box, ring or any closed shape works.' : 'The stamp is empty.'); return false; }
    if (open.length) say('Left out (not closed solids): ' + open.slice(0, 3).join(', '));
    const solid = solids.length > 1 ? solidUnion(THREE, solids) : solids[0], en = entryOf(bm), inPosed = en.posed, jobs = [bm].concat(shellsOf(bm)), keep = cfg.carveKeep;
    let restFix = null; if (skinned(bm)) { const cache = new Map(); restFix = (i, d) => { let m = cache.get(i); if (!m) { const A = skinMatrix(bm, i, new M4()), Lm = new M4().copy(bm.bindMatrixInverse).multiply(A).multiply(bm.bindMatrix); Lm.setPosition(0, 0, 0); m = Lm.invert(); cache.set(i, m); } return d.clone().applyMatrix4(m); }; }
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0), res = stampGeometry(THREE, bm.geometry, solid, { posed: inPosed, keep, restFix }); if (!res) { say('The stamp did not touch the body: press it in further.'); return false; }
    if (host.strokeStart) { try { host.strokeStart(); } catch (e) { /* optional */ } }
    const done = [{ m: bm, old: bm.geometry, neu: res.geometry }]; jobs.slice(1).forEach(j => { const r2 = stampGeometry(THREE, j.geometry, solid, { posed: inPosed, keep, restFix }); if (r2) done.push({ m: j, old: j.geometry, neu: r2.geometry }); });
    done.forEach(d => { d.m.geometry = d.neu; if (d.m.updateMorphTargets) d.m.updateMorphTargets(); entries.delete(d.m); }); entries.set(bm, { mesh: bm, geometry: res.geometry, st: null, posed: res.posed, lazy: true }); mirrorToShells(bm);
    let at = 'new'; const flip = () => { at = at === 'new' ? 'old' : 'new'; done.forEach(d => { d.m.geometry = at === 'new' ? d.neu : d.old; if (d.m.updateMorphTargets) d.m.updateMorphTargets(); entries.delete(d.m); }); entryOf(bm); mirrorToShells(bm); };
    undoS.push({ label: 'stamp', flip, keys: [] }); redoS.length = 0; if (undoS.length > 100) undoS.shift();
    if (host.dirty) try { host.dirty(bm); } catch (e) { /* optional */ }
    say((keep === 'inside' ? 'Kept only what is inside "' : 'Carved with "') + (src.name || 'the stamp') + '": ' + (res.lining ? res.lining.toLocaleString('en-US') + ' wall faces make the space. ' : 'open hole. ') + 'Undo puts it back.'); return true;
  }

  /* ---------- Squeeze: hold the trigger and move; a tube comes out of your fingertip. It is as fat as the Size tile, fatter when you move slowly (Thickness: speed) or when the trigger is pressed harder, with a round,
     flat, taffy or beaded shape. Mirror and 360 make the copies together; the copies are one object. One stroke is one undo step; the object is saved with Save object (More page). ---------- */
  const sqCentre = () => { if (figure) { figure.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(figure); if (!b.isEmpty()) return b.getCenter(new V3()); } return new V3(); };
  function sqRadius(st, hand, dt) {
    let r = cfg.size / 100 * 0.5; if (hand.press != null) r *= 0.25 + 0.75 * Math.max(0, Math.min(1, hand.press));
    if (cfg.thick === 'speed') { const sp = st.last ? hand.tip.distanceTo(st.last) / Math.max(dt, 0.008) : 0; r *= Math.max(0.35, Math.min(1.3, 1.3 - sp * 1.2)); }
    return r;
  }
  function sqRebuild(st) {
    const copies = strokeCopies(THREE, st.pts, cfg.sym === 'off' ? 'off' : cfg.sym, st.centre, cfg.count);
    while (st.group.children.length < copies.length) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: SQ_COLORS[st.color % SQ_COLORS.length], roughness: 0.55, metalness: 0.05 })); m.name = st.group.name + ' ' + (st.group.children.length + 1); st.group.add(m); }
    copies.forEach((c, k) => { const m = st.group.children[k], g = tubeGeometry(THREE, c.pts, st.rad, { profile: st.profile, reflect: c.reflect, up: st.up }); if (m.geometry) m.geometry.dispose(); m.geometry = g; });
    st.group.updateMatrixWorld(true);
  }
  function sqStart(hand) {
    sqN++; const group = new THREE.Group(); group.name = 'Squeeze ' + sqN; group.userData.noMerge = true;
    const st = { pts: [], rad: [], last: null, group, centre: sqCentre(), color: cfg.color, profile: cfg.profile, up: hand.dir ? new V3(0, 1, 0) : new V3(0, 1, 0), id: 'sq' + sqN };
    try { host.addObject ? host.addObject(group) : null; } catch (e) { /* the host adds it */ } return st;
  }
  function sqEnd(st) {
    if (!st.pts.length) { if (st.group.parent && host.removeObject) host.removeObject(st.group); return; }
    const ent = { id: st.id, name: st.group.name, object: st.group, kind: 'squeeze' }; squeezed.push(ent); meshes = targets();
    let on = true; const flip = () => { on = !on; if (on) { host.addObject && host.addObject(st.group); if (!squeezed.includes(ent)) squeezed.push(ent); } else { host.removeObject && host.removeObject(st.group); const i = squeezed.indexOf(ent); if (i >= 0) squeezed.splice(i, 1); } meshes = targets(); };
    undoS.push({ label: 'squeeze', flip, keys: [] }); redoS.length = 0; if (undoS.length > 100) undoS.shift();
    if (host.dirty) try { host.dirty(st.group); } catch (e) { /* optional */ }
    say(st.group.name + ' is an object now: pick it as a stamp, glue it, or save it with Save object (More page). Undo takes it away.');
  }

  /* ---------- every XR frame ---------- */
  function frame(hands, dt) {
    if (!cfg.on) return; dt = dt || 0.016; cursor.hands = {}; built = 0;
    if (++tick % 45 === 0 && !hs.size) meshes = targets();   /* pick up objects pulled into the room while the bench is on, drop ones that were deleted */
    for (const hand of hands) {
      if (cfg.mode === 'cut') {   /* a cut is one pinch, not a held stroke: the plane shows at the tip, the pinch cuts */
        cursor.hands[hand.id] = { tip: hand.tip, hit: false, radius: 0.15, mode: 'cut', plane: hand.dir || null };
        if (cfg.cutBlade !== 'plane') {   /* the saw: hold the pinch and move, a slit follows the blade (Ruth 2026-10-13: "SWEEP was the whole point"); one undo for the whole sweep */
          cursor.hands[hand.id].radius = Math.max(0.02, cfg.size / 100);
          let sw = sawS.get(hand.id);
          if (hand.pinch) { const s0 = hs.get(hand.id); if (s0) endStroke(s0);
            if (!sw) { sw = { mesh: null, olds: new Map(), n: 0, R: 0, last: null }; sawS.set(hand.id, sw); }
            const R = Math.max(0.005, cfg.size / 100); if (!sw.last || hand.tip.distanceTo(sw.last) >= Math.max(0.008, R * 0.5)) sawDab(hand, sw); }
          else if (sw) { sawEnd(sw); sawS.delete(hand.id); }
          continue; }
        if (hand.pinch && !cutHeld.has(hand.id)) { cutHeld.add(hand.id); const s0 = hs.get(hand.id); if (s0) endStroke(s0); cutAt(hand); } else if (!hand.pinch) cutHeld.delete(hand.id);
        continue;
      }
      if (cfg.mode === 'stamp') {   /* a stamp is one pinch: the ghost rides at the tip, the pinch presses it in */
        cursor.hands[hand.id] = { tip: hand.tip, hit: false, radius: 0.1, mode: 'stamp' };
        if (hand.pinch && !cutHeld.has(hand.id)) { cutHeld.add(hand.id); const s0 = hs.get(hand.id); if (s0) endStroke(s0); stampAt(hand); } else if (!hand.pinch) cutHeld.delete(hand.id);
        continue;
      }
      if (cfg.mode === 'squeeze') {
        let st = sqS.get(hand.id); cursor.hands[hand.id] = { tip: hand.tip, hit: false, radius: cfg.size / 100 * 0.5, mode: 'squeeze' };
        if (hand.pinch) {
          if (!st) { st = sqStart(hand); sqS.set(hand.id, st); }
          const r = sqRadius(st, hand, dt), minStep = Math.max(0.004, r * 0.6);
          if (!st.last || hand.tip.distanceTo(st.last) >= minStep) { st.pts.push(hand.tip.clone()); st.rad.push(r); st.last = hand.tip.clone(); sqRebuild(st); }
        } else if (st) { sqEnd(st); sqS.delete(hand.id); }
        continue;
      }
      if (cfg.mode === 'carve' || cfg.mode === 'erase' || cfg.mode === 'heal' || cfg.mode === 'close' || cfg.mode === 'wrinkle') {   /* hold to carve, erase or heal: a dab about every tenth of a second, or sooner when the hand has moved a third of the ball */
        cursor.hands[hand.id] = { tip: hand.tip, hit: false, radius: cfg.size / 100, mode: 'carve' };
        let cs = carveS.get(hand.id);
        if (hand.pinch) {
          if (!cs) { let bm0 = null, bd0 = 1e9; for (const m of pickable(hand.tip, cfg.size / 100 * 1.5 + 0.05)) { const en = entryOf(m); m.updateMatrixWorld(); const h = nearest(en, m.worldToLocal(hand.tip.clone()), radiusOf(m) * 1.5 + 0.02); if (h && h.d < bd0) { bd0 = h.d; bm0 = m; } } if (bm0) { cs = { mesh: bm0, olds: new Map(), last: null, t: 1, n: 0, mode: cfg.mode }; carveS.set(hand.id, cs); } }
          if (cs) { cs.t += dt; const wk = cs.mode === 'wrinkle', moved = !cs.last || cs.last.distanceTo(hand.tip) > cfg.size / 100 * (wk ? 0.25 : 0.33); if ((moved && cs.t >= (wk ? 0.04 : 0.1)) || cs.t >= 0.5) {   /* a wrinkle line dabs every quarter ball and up to 25 times a second, so a quick stroke is still a line */ cs.t = 0; cs.last = hand.tip.clone(); carveDab(cs, hand); } }
        } else if (cs) { carveEnd(cs); carveS.delete(hand.id); }
        continue;
      }
      let hit = null, bm = null, ben = null;
      for (const m of pickable(hand.tip, cfg.size / 100 * 1.2 + 0.05)) {
        const en = entryOf(m); m.updateMatrixWorld(); const local = m.worldToLocal(hand.tip.clone()), reach = radiusOf(m) * 1.2 + 0.02, h = nearest(en, local, reach);
        if (h && (!hit || h.d < hit.d)) { hit = h; bm = m; ben = en; }
      }
      cursor.hands[hand.id] = { tip: hand.tip, hit: !!hit, radius: cfg.size / 100, mode: cfg.mode };
      let s = hs.get(hand.id);
      if (hand.pinch) {
        if (!s && hit) s = begin(hit, hand, hit, bm, ben);
        if (s) moveStroke(s, hand, s.mesh === bm ? hit : null, dt);
      } else if (s) endStroke(s);
    }
    for (const s of [...hs.values()]) if (!hands.some(h => h.id === s.hand)) endStroke(s);
  }

  /* ---------- the menu's calls ---------- */
  const set = { mode: m => { cfg.mode = m; endAll(); }, size: v => { cfg.size = Math.max(0.3, Math.min(30, v)); }, strength: v => { cfg.strength = Math.max(5, Math.min(100, v)); }, sym: v => { cfg.sym = v; }, cutGoes: v => { cfg.cutGoes = v; }, cutCap: v => { cfg.cutCap = !!v; }, cutBlade: v => { cfg.cutBlade = v === 'plane' ? 'plane' : 'saw'; }, profile: v => { cfg.profile = v; }, thick: v => { cfg.thick = v; }, color: v => { cfg.color = v; }, carveKeep: v => { cfg.carveKeep = v; }, stampScale: v => { cfg.stampScale = Math.max(0.1, Math.min(6, v)); }, count: n => { cfg.count = Math.max(2, Math.min(24, n | 0)); } };
  function newKey() { const m = meshes[0]; cfg.key = m ? K.nextKeyName(m) : 'Shape 1'; say('Next stroke starts a new shape key: ' + cfg.key + '.'); return cfg.key; }
  function keys() { const out = []; meshes.forEach(m => K.keysOf(m).forEach(n => out.push({ mesh: m, name: n, value: m.morphTargetInfluences[m.morphTargetDictionary[n]] || 0 }))); return out; }
  function setKey(name, v) { meshes.forEach(m => { const k = m.morphTargetDictionary && m.morphTargetDictionary[name]; if (k !== undefined) { m.morphTargetInfluences[k] = v; mirrorToShells(m); } }); meshes.forEach(m => { const en = entries.get(m); if (en) refresh(en); }); }
  function undo() { if (hs.size) return false; const c = undoS.pop(); if (!c) return false; c.flip(); redoS.push(c); if (host.dirty) try { host.dirty(); } catch (e) { /* optional */ } say('Undid ' + c.label + '.'); return true; }
  function redo() { if (hs.size) return false; const c = redoS.pop(); if (!c) return false; c.flip(); undoS.push(c); if (host.dirty) try { host.dirty(); } catch (e) { /* optional */ } say('Redid ' + c.label + '.'); return true; }
  async function save(name, opts) {
    let roots2 = null; opts = opts || {}; if (!figure && !(opts.roots && opts.roots.length)) throw new Error('Nothing to save.');
    const loadExporter = () => new Promise(ok => { if (typeof THREE.GLTFExporter === 'function' || typeof document === 'undefined') return ok(); const sc = document.createElement('script'); sc.src = '/pe_lib/GLTFExporter.js'; sc.onload = () => ok(); sc.onerror = () => ok(); document.head.appendChild(sc); });
    const exp = host.exportGlb || (async root => { await loadExporter(); return new Promise((ok, no) => { if (typeof THREE.GLTFExporter !== 'function') return no(new Error('The glb exporter is not loaded.')); try { new THREE.GLTFExporter().parse(root, ok, { binary: true, embedImages: true, onlyVisible: true }); } catch (e) { no(e); } }); });
    let target = figure;
    if (opts.roots && opts.roots.length) {   /* objects (a shape you sculpted or carved, or a group of them): one glb, laid out round their own middle so the saved piece sits at its own origin */
      roots2 = opts.roots.filter(r => r && r.parent); if (!roots2.length) throw new Error('Nothing to save.'); const box = new THREE.Box3(); roots2.forEach(r => { r.updateMatrixWorld(true); box.expandByObject(r); }); const pv = box.getCenter(new V3()), grp = new THREE.Group(); grp.name = (name || 'Sculpted object');
      roots2.forEach(r => { const c = r.clone(true); c.matrix.copy(r.matrixWorld).premultiply(new M4().makeTranslation(-pv.x, -pv.y, -pv.z)); c.matrix.decompose(c.position, c.quaternion, c.scale); c.updateMatrix(); grp.add(c); }); grp.updateMatrixWorld(true); target = grp; }
    const buf = await exp(target), nm = (name || (opts.roots ? 'Sculpted object' : 'Sculpted figure')).trim(), id = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sculpt', proj = opts.proj || 'studio';
    const mine = { name: 'Own work', source: 'Sculpted by hand in the headset', restricted: false }, inh = (host.sources && host.sources()) || [];
    const card = { name: nm, proj, budget: { id: 'none', label: 'No budget picked', limit: 0 }, licence: mine, sources: inh.concat([mine]) };
    const fd = new FormData(); fd.append('glb', new Blob([buf], { type: 'model/gltf-binary' }), id + '.glb'); fd.append('card', JSON.stringify(card));
    const r = await fetch('/pe_assets/item/' + id + '?proj=' + proj, { method: 'POST', body: fd }), j = await r.json().catch(() => ({ ok: false, why: 'The library did not answer.' }));
    if (!j.ok) throw new Error(j.why || 'The library said no.'); say('Saved "' + nm + '" to the library.'); return j;
  }
  return { cfg, set, enter, leave, frame, undo, redo, strokes: () => undoS.length, squeezed, canUndo: () => undoS.length > 0, canRedo: () => redoS.length > 0, newKey, keys, setKey, save, cursor, entryOf, nearest, endAll, cutAt, stampAt, repose: () => { entries.clear(); meshes = targets(); }, setFilter: f => { meshFilter = f || null; entries.clear(); meshes = targets(); }, filtered: () => !!meshFilter, targetNames: () => meshes.map(m => m.name), hasEntry, squeezed: () => squeezed.filter(e => e.object.parent), colors: SQ_COLORS };
}
