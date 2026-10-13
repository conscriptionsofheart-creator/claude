/* sculpt_next_clay.js: clay WORKS made of LAYERS, as in Substance 3D Modeler (Ruth 2026-10-13). A work is a group in the room; each layer is its own clay field (sculpt_next_sdf.js) shown as chunks of
   triangles (sculpt_next_mesher.js), meshed in a Web Worker so a stroke never holds up a frame. Layers can be hidden, locked, grouped, duplicated, merged down (add, subtract, intersect) and remeshed;
   every change is one undo step. Strokes take mirror and radial symmetry from the work's own frame: the mirror is the work's middle plane, radial goes round its upright.
   makeClay(THREE, env): env = { say, addObject, removeObject, pushUndo({label, undo, redo}), dirty(obj), workerUrl (optional), noWorker (tests) }. */
import { createField, opShape, opOffset, opSmooth, opPlane, opWarp, opIntersectField, opMergeField, surfacePlane, sdCapsule, sdPrim, falloff, bunkey, B } from './sculpt_next_sdf.js';
import { meshChunk } from './sculpt_next_mesher.js';

const N = 16;   /* cells per chunk side: 8 cm of clay at the normal 5 mm detail */
const OFS = 1024, SP = 2048, ckey = (x, y, z) => ((x + OFS) * SP + (y + OFS)) * SP + (z + OFS), cunkey = k => { const z = k % SP, r = (k - z) / SP, y = r % SP, x = (r - y) / SP; return [x - OFS, y - OFS, z - OFS]; };
export const CLAY_COLORS = [[214, 196, 170], [196, 120, 96], [143, 184, 217], [167, 212, 155], [242, 213, 107], [183, 154, 217], [245, 240, 230], [90, 85, 96]];

export function makeClay(THREE, env) {
  env = env || {};
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion, say = t => { try { env.say && env.say(t); } catch (e) { /* the host's voice is optional */ } };
  const works = [], S = { active: null, layerN: 0, workN: 0, groupN: 0, worker: null, workerOk: false, inflight: 0, jobId: 0, meshMs: 0, meshCount: 0, lastDabMs: 0, dabs: 0, dabMs: 0 };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- the worker (off the page's thread); if it cannot start, meshing runs on the page within a time budget per frame ---------- */
  function startWorker() {
    if (env.noWorker || typeof Worker === 'undefined') return;
    try {
      const url = env.workerUrl || new URL('./sculpt_next_worker.js', import.meta.url);
      const w = new Worker(url, { type: 'module' });
      w.onmessage = e => { S.inflight = Math.max(0, S.inflight - 1); S.workerOk = true; for (const r of e.data.out) applyMesh(r.layer, r.key, r.ver, r); };
      w.onerror = e => { say('Clay meshing moved to the main thread (' + String(e && e.message || 'worker failed').slice(0, 50) + ').'); try { w.terminate(); } catch (x) { /* already gone */ } S.worker = null; S.inflight = 0; allLayers().forEach(l => l.chunkVer.forEach((_, k) => l.dirty.add(k))); };
      S.worker = w;
    } catch (e) { S.worker = null; }
  }
  startWorker();
  const layerById = new Map();

  /* ---------- works and layers ---------- */
  function newWork(at, quat) {
    const group = new THREE.Group(); S.workN++; group.name = 'Clay ' + S.workN; group.userData.clayWork = true; group.userData.noMerge = true;
    if (at) group.position.copy(at); if (quat) group.quaternion.copy(quat);
    const w = { id: 'clay' + S.workN, name: group.name, group, layers: [] }; works.push(w);
    try { env.addObject ? env.addObject(group) : null; } catch (e) { /* the host adds it to the room */ }
    group.updateMatrixWorld(true); return w;
  }
  function newLayer(work, opts) {
    opts = opts || {}; S.layerN++;
    const h = opts.h || env.detail && env.detail() || 0.005, color = opts.color || (env.color && env.color()) || CLAY_COLORS[0];
    const g = new THREE.Group(); g.name = (opts.name || 'Layer ' + S.layerN); g.userData.clayLayer = true; g.userData.noMerge = true;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.0 });
    const L = { id: 'L' + S.layerN, name: g.name, work, group: g, field: opts.field || createField({ h, color }), chunks: new Map(), dirty: new Set(), chunkVer: new Map(), material: mat, locked: false, groupId: opts.groupId || null };
    if (opts.matrix) { opts.matrix.decompose(g.position, g.quaternion, g.scale); }
    work.group.add(g); g.updateMatrixWorld(true); const at = opts.index == null ? work.layers.length : opts.index; work.layers.splice(at, 0, L); layerById.set(L.id, L);
    if (opts.field) markAll(L);
    return L;
  }
  const allLayers = () => { const out = []; works.forEach(w => w.layers.forEach(l => out.push(l))); return out; };
  const live = l => l && l.group.parent && l.work.group.parent;
  function ensureLayer(at, frameObj) {   /* the layer a clay stroke goes into: the picked one, else a new work (at the figure's middle plane when a figure is on the bench, else where the hand is) */
    if (live(S.active) && S.active.group.visible) return S.active;
    if (S.active && live(S.active) && !S.active.group.visible) { say('The picked layer is hidden: show it, or pick another layer.'); return null; }
    const w0 = works.find(w => w.group.parent && w.layers.length);
    if (w0) { const L = w0.layers.find(l => l.group.visible && !l.locked) || w0.layers[0]; S.active = L; return L; }
    let pos = at.clone(), quat = new Q();
    if (frameObj) { frameObj.updateMatrixWorld(true); const p = new V3(), q = new Q(), s = new V3(); frameObj.matrixWorld.decompose(p, q, s); const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); quat.setFromEuler(new THREE.Euler(0, e.y, 0, 'YXZ')); pos.set(p.x, at.y, p.z); }
    const w = newWork(pos, quat), L = newLayer(w); S.active = L;
    env.pushUndo && env.pushUndo({ label: 'new clay', undo: () => { detachWork(w); }, redo: () => { attachWork(w); } });
    return L;
  }
  function detachWork(w) { if (w.group.parent) { try { env.removeObject ? env.removeObject(w.group) : w.group.parent.remove(w.group); } catch (e) { /* gone already */ } } if (S.active && S.active.work === w) S.active = null; }
  function attachWork(w) { if (!w.group.parent) { try { env.addObject ? env.addObject(w.group) : null; } catch (e) { /* host */ } } if (!S.active) S.active = w.layers[0] || null; }

  /* ---------- chunks: which ones a change touches, meshing them, showing them ---------- */
  function markBox(L, b) {   /* b = sample box [i0, j0, k0, i1, j1, k1]: every chunk that reads any of those samples is remeshed */
    if (!b) return; const lo = [0, 1, 2].map(a => Math.ceil((b[a] - N) / N)), hi = [3, 4, 5].map(a => Math.floor((b[a] + 1) / N));
    for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) L.dirty.add(ckey(x, y, z));
  }
  function markBricks(L, keys) { keys.forEach(k => { const [bx, by, bz] = bunkey(k); markBox(L, [bx * B, by * B, bz * B, bx * B + B - 1, by * B + B - 1, bz * B + B - 1]); }); }
  function markAll(L) { const bb = L.field.bounds(); L.chunks.forEach((_, k) => L.dirty.add(k)); if (bb) markBox(L, bb); }
  function job(L, k) {
    const [cx, cy, cz] = cunkey(k), i0 = cx * N - 1, j0 = cy * N - 1, k0 = cz * N - 1, r = L.field.read(i0, j0, k0, N + 2, N + 2, N + 2), ver = (L.chunkVer.get(k) || 0) + 1; L.chunkVer.set(k, ver);
    return { layer: L.id, key: k, ver, d: r.d, c: r.c, n: N + 2, i0, j0, k0, h: L.field.h };
  }
  function applyMesh(lid, k, ver, m) {
    const L = layerById.get(lid); if (!L || L.chunkVer.get(k) !== ver) return;   /* a newer job is on its way: this one is stale */
    let mesh = L.chunks.get(k);
    if (!m.index.length) { if (mesh) { L.group.remove(mesh); mesh.geometry.dispose(); L.chunks.delete(k); } return; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(m.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3)); g.setAttribute('color', new THREE.BufferAttribute(m.color, 3)); g.setIndex(new THREE.BufferAttribute(m.index, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
    if (!mesh) { mesh = new THREE.Mesh(g, L.material); mesh.name = '_clay_chunk'; mesh.userData.noMerge = true; mesh.userData.clayLayer = L.id; L.group.add(mesh); L.chunks.set(k, mesh); }
    else { const old = mesh.geometry; mesh.geometry = g; old.dispose(); }
    mesh.updateMatrixWorld(true);
  }
  /* every frame: send dirty chunks to the worker, or mesh them here until the time budget is spent. The picked layer goes first. */
  function tick(budgetMs) {
    const order = allLayers().filter(l => l.dirty.size).sort((a, b) => (a === S.active ? -1 : b === S.active ? 1 : 0)); if (!order.length) return 0;
    let done = 0; const t0 = now();
    if (S.worker && S.inflight < 3) {
      const jobs = []; for (const L of order) { for (const k of L.dirty) { jobs.push(job(L, k)); L.dirty.delete(k); if (jobs.length >= 24) break; } if (jobs.length >= 24) break; }
      if (jobs.length) { S.inflight++; const move = []; jobs.forEach(j => move.push(j.d.buffer, j.c.buffer)); S.worker.postMessage({ id: ++S.jobId, jobs }, move); done = jobs.length; }
      return done;
    }
    if (S.worker) return 0;
    for (const L of order) { for (const k of [...L.dirty]) { const j = job(L, k); L.dirty.delete(k); const m = meshChunk(j.d, j.c, j.n, j.i0, j.j0, j.k0, j.h); applyMesh(L.id, k, j.ver, m); done++; if (now() - t0 > (budgetMs || 4)) break; } if (now() - t0 > (budgetMs || 4)) break; }
    S.meshMs += now() - t0; S.meshCount += done; return done;
  }
  function flush() {   /* mesh everything that waits, right now, here (tests, a save, an export) */
    const t0 = now(); let n = 0; allLayers().forEach(L => { for (const k of [...L.dirty]) { const j = job(L, k); L.dirty.delete(k); applyMesh(L.id, k, j.ver, meshChunk(j.d, j.c, j.n, j.i0, j.j0, j.k0, j.h)); n++; } }); S.meshMs += now() - t0; S.meshCount += n; return n;
  }
  const pending = () => allLayers().reduce((a, l) => a + l.dirty.size, 0) + S.inflight;

  /* ---------- where the clay is: the nearest visible, unlocked layer surface to a world point (distance in metres, null when farther than the reach) ---------- */
  const scaleOf = obj => { obj.updateMatrixWorld(true); const s = new V3(); obj.matrixWorld.decompose(new V3(), new Q(), s); return Math.max(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z)) || 1; };
  function hit(pw, reach, onlyUnlocked) {
    let best = null;
    for (const L of allLayers()) {
      if (!live(L) || !L.group.visible || (onlyUnlocked && L.locked)) continue; const sc = scaleOf(L.group), p = L.group.worldToLocal(pw.clone()), d = L.field.sample(p.x, p.y, p.z) * sc;
      if (d >= L.field.band * sc * 0.999) continue;   /* farther than the stored band: no surface close enough to say */
      if (d <= reach && (!best || d < best.d)) best = { layer: L, d, local: p, scale: sc };
    }
    return best;
  }
  /* ---------- symmetry in the work's frame: world points for every copy of a stroke step ---------- */
  function copiesWorld(work, pts, sym, count) {
    const out = [pts.map(p => p.clone())]; if (!sym || sym === 'off') return out.map(ps => ({ pts: ps, mirror: false }));
    const g = work.group; g.updateMatrixWorld(true); const toL = p => g.worldToLocal(p.clone()), toW = p => g.localToWorld(p.clone());
    const local = pts.map(toL); let sets = [{ pts: local, mirror: false }];
    if (sym === 'mirror' || sym === 'both') sets = sets.concat(sets.map(s => ({ pts: s.pts.map(p => new V3(-p.x, p.y, p.z)), mirror: true })));
    if (sym === 'radial' || sym === 'both') { const n = Math.max(2, count || 6), ax = new V3(0, 1, 0), o = []; sets.forEach(s => { for (let k = 0; k < n; k++) { const a = Math.PI * 2 * k / n; o.push({ pts: s.pts.map(p => p.clone().applyAxisAngle(ax, a)), mirror: s.mirror, turn: a }); } }); sets = o; }
    return sets.map(s => ({ pts: s.pts.map(toW), mirror: s.mirror, turn: s.turn || 0 }));
  }
  /* a direction (not a point) through the same copy: the work's turn and mirror */
  function copyDir(work, dirW, set) {
    const g = work.group, qi = g.getWorldQuaternion(new Q()), d = dirW.clone().applyQuaternion(qi.clone().invert());
    if (set.mirror) d.x = -d.x; if (set.turn) d.applyAxisAngle(new V3(0, 1, 0), set.turn); return d.applyQuaternion(qi);
  }

  /* ---------- a clay stroke: begin, step (one dab between the last point and this one), end (one undo step) ---------- */
  function strokeBegin(L, opts) {
    const st = { L, work: L.work, snaps: new Map(), last: null, lastDab: null, hold: 0, opts, temp: null, changed: false, dots: 0, travel: 0 };
    if (opts.op === 'intersect' && (opts.mode === 'clay' || opts.mode === 'dots')) st.temp = createField({ h: L.field.h, color: L.field.base });   /* intersect: the stroke is gathered first, then only the clay inside it stays */
    return st;
  }
  const snapFor = (st, L) => { let m = st.snaps.get(L); if (!m) { m = new Map(); st.snaps.set(L, m); } return m; };
  /* one step. pw = the brush point (world), prev = the last step's point, dirW = the hand's pointing way, deltaW = the hand's move since the last frame (grab, smear) */
  function strokeStep(st, pw, prevW, opts) {
    const t0 = now(), L = st.L; if (L.locked) return false; const fld = L.field, sc = scaleOf(L.group), mode = opts.mode, op = opts.op, rW = opts.radius;
    const sets = copiesWorld(st.work, [pw, prevW || pw], opts.sym, opts.count), fall = falloff(opts.falloff), snap = snapFor(st, L), toL = p => L.group.worldToLocal(p.clone());
    const r = rW / sc, h = fld.h; let any = false;
    for (const set of sets) {
      const a = toL(set.pts[1]), b = toL(set.pts[0]), A = [a.x, a.y, a.z], Bp = [b.x, b.y, b.z];
      const lo = [Math.min(A[0], Bp[0]) - r, Math.min(A[1], Bp[1]) - r, Math.min(A[2], Bp[2]) - r], hi = [Math.max(A[0], Bp[0]) + r, Math.max(A[1], Bp[1]) + r, Math.max(A[2], Bp[2]) + r];
      let box = null;
      if (op === 'paint' && mode !== 'clay' && mode !== 'dots') box = opShape(fld, [Bp[0] - r, Bp[1] - r, Bp[2] - r], [Bp[0] + r, Bp[1] + r, Bp[2] + r], (x, y, z) => Math.hypot(x - Bp[0], y - Bp[1], z - Bp[2]) - r, 'paint', 0, opts.color, snap, opts.strength);
      else if (mode === 'clay') {
        let nrm = null; if (opts.profile === 'flat') { const pl = surfacePlane(fld, Bp, r * 1.5); nrm = pl ? pl.n : (opts.dirW ? (() => { const d = copyDir(st.work, opts.dirW, set); const dl = L.group.worldToLocal(pw.clone().add(d)).sub(b).normalize(); return [dl.x, dl.y, dl.z]; })() : [0, 1, 0]); }
        const rr = r * (0.35 + 0.65 * opts.press), k = opts.blend * rr, dist = (x, y, z) => sdCapsule(x, y, z, A, Bp, rr, nrm, opts.profile === 'flat' ? 0.85 : 0);
        if (st.temp) box = opShape(st.temp, lo, hi, dist, 'add', k, opts.color, null);
        else box = opShape(fld, lo, hi, dist, op === 'subtract' ? 'subtract' : op === 'paint' ? 'paint' : 'add', k, opts.color, snap, opts.strength);
      }
      else if (mode === 'inflate' || mode === 'deflate') { const sg = (mode === 'deflate' ? -1 : 1) * (op === 'subtract' ? -1 : 1); box = opOffset(fld, Bp, r, sg * Math.min(h * 0.8, opts.strength * r * 0.06), fall, snap); }
      else if (mode === 'smooth') box = opSmooth(fld, Bp, r, opts.strength * 0.9, fall, snap);
      else if (mode === 'flatten' || mode === 'scrape' || mode === 'fill') {
        const pl = surfacePlane(fld, Bp, r); if (!pl) continue;
        const dig = mode === 'scrape' ? r * 0.04 * opts.strength : mode === 'fill' ? -r * 0.04 * opts.strength : 0; pl.p = [pl.p[0] - pl.n[0] * dig, pl.p[1] - pl.n[1] * dig, pl.p[2] - pl.n[2] * dig];
        box = opPlane(fld, Bp, r, pl, opts.strength * 0.5, mode, fall, snap);
      }
      else if (mode === 'pinch') {   /* pull the clay toward the stroke's line, and cut a soft groove (subtract: a crease) or lay a thin ridge (add) */
        const ab = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2], s = opts.strength;
        box = opWarp(fld, lo, hi, r * 0.3, (x, y, z) => { const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - A[0]) * ab[0] + (y - A[1]) * ab[1] + (z - A[2]) * ab[2]) / L2)) : 0; const qx = A[0] + ab[0] * t - x, qy = A[1] + ab[1] * t - y, qz = A[2] + ab[2] * t - z, d = Math.hypot(qx, qy, qz), w = fall(d / r); if (w <= 0 || d < 1e-9) return null; const m = Math.min(d, r * 0.25 * s * w); return [qx / d * m, qy / d * m, qz / d * m]; }, snap) || box;
        const gr = Math.max(h * 1.2, r * 0.18), b2 = opShape(fld, lo, hi, (x, y, z) => sdCapsule(x, y, z, A, Bp, gr), op === 'subtract' ? 'subtract' : 'add', gr, opts.color, snap); box = box || b2; if (b2) markBox(L, b2);
      }
      else if (mode === 'grab' || mode === 'smear' || mode === 'melt') {
        let dW; if (mode === 'melt') dW = new V3(0, -1, 0).multiplyScalar(opts.strength * rW * 0.06); else { if (!opts.deltaW) continue; dW = copyDir(st.work, opts.deltaW, set).multiplyScalar(mode === 'smear' ? Math.min(1, opts.strength * 1.2) : 1); }
        const c0 = mode === 'grab' ? toL(set.pts[1]) : b, dL = L.group.worldToLocal(set.pts[0].clone().add(dW)).sub(b), D = [dL.x, dL.y, dL.z], C = [c0.x, c0.y, c0.z], Dl = Math.hypot(D[0], D[1], D[2]); if (Dl < 1e-7) continue;
        box = opWarp(fld, [C[0] - r, C[1] - r, C[2] - r], [C[0] + r, C[1] + r, C[2] + r], Dl, (x, y, z) => { const w = fall(Math.hypot(x - C[0] - D[0], y - C[1] - D[1], z - C[2] - D[2]) / r); return w > 0 ? [D[0] * w, D[1] * w, D[2] * w] : null; }, snap);
      }
      else if (mode === 'dots') {   /* a stamp every so often along the stroke, pointing out of the surface (or along the hand) */
        const pl = surfacePlane(fld, Bp, r * 1.5), up = pl ? new V3(...pl.n) : new V3(0, 1, 0), q = new Q().setFromUnitVectors(new V3(0, 1, 0), up.normalize()), M = new M4().compose(new V3(...Bp), q, new V3(r * 0.5, r * 0.5, r * 0.5)), Mi = new M4().copy(M).invert(), kind = ({ ball: 'sphere', ring: 'torus', cube: 'cube', spike: 'cone' })[opts.dot] || 'sphere', e = Mi.elements, sc2 = r * 0.5;
        const dist = (x, y, z) => { const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; return sdPrim(kind, X, Y, Z, 0.15) * sc2; };
        const lo2 = [Bp[0] - r, Bp[1] - r, Bp[2] - r], hi2 = [Bp[0] + r, Bp[1] + r, Bp[2] + r];
        box = st.temp ? opShape(st.temp, lo2, hi2, dist, 'add', 0, opts.color, null) : opShape(fld, lo2, hi2, dist, op === 'subtract' ? 'subtract' : op === 'paint' ? 'paint' : 'add', h * 0.5, opts.color, snap, opts.strength);
      }
      if (box) { any = true; if (!st.temp) markBox(L, box); }
    }
    if (any) st.changed = true; const ms = now() - t0; S.lastDabMs = ms; S.dabs++; S.dabMs += ms; return any;
  }
  function strokeEnd(st, label) {
    const L = st.L;
    if (st.temp && !st.temp.empty()) { const b = opIntersectField(L.field, st.temp, 0, snapFor(st, L)); if (b) { markAll(L); st.changed = true; } }
    if (!st.changed) return false;
    const snaps = [...st.snaps.entries()].filter(([, m]) => m.size); if (!snaps.length) return false;
    const flipTo = list => list.map(([Lr, m]) => { const back = Lr.field.restore(m); markBricks(Lr, [...m.keys()]); return [Lr, back]; });
    let state = snaps; const entry = { label: label || 'clay', undo: () => { state = flipTo(state); }, redo: () => { state = flipTo(state); } };
    env.pushUndo && env.pushUndo(entry); env.dirty && env.dirty(L.work.group); return true;
  }

  /* ---------- a whole shape at once (a primitive from the shape tool, a stamp, the saw's slab): dist in WORLD space via a matrix, so the layer's own placement is respected ---------- */
  /* snapOuter: the caller's snapshot (a saw sweep, a carve hold): no undo step here, the caller makes one for the whole sweep */
  function applyShapeWorld(L, kind, worldMatrix, mode, blend, color, sym, count, label, round, snapOuter) {
    const sets = sym && sym !== 'off' ? copiesMatrix(L.work, worldMatrix, sym, count) : [worldMatrix], snap = snapOuter || new Map(); let any = false;
    for (const Mw of sets) {
      const Ml = new M4().copy(L.group.matrixWorld).invert().multiply(Mw), Mi = new M4().copy(Ml).invert(), e = Mi.elements, s = new V3(); Ml.decompose(new V3(), new Q(), s); const smin = Math.min(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
      const dist = (x, y, z) => sdPrim(kind, e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14], round) * smin;
      const bb = new THREE.Box3(new V3(-1, -1, -1), new V3(1, 1, 1)).applyMatrix4(Ml), lo = [bb.min.x, bb.min.y, bb.min.z], hi = [bb.max.x, bb.max.y, bb.max.z];
      if (mode === 'intersect') { const tmp = createField({ h: L.field.h, color: L.field.base }); opShape(tmp, lo, hi, dist, 'add', 0, null, null); const b = opIntersectField(L.field, tmp, blend, snap); if (b) { any = true; markAll(L); } continue; }
      const b = opShape(L.field, lo, hi, dist, mode, blend, color, snap, 1); if (b) { any = true; markBox(L, b); } else if (b === null && (bb.max.x - bb.min.x) / L.field.h > 160) say('That shape is too big for this layer\'s detail: make the layer coarser (Detail) or the shape smaller.');
    }
    if (!any) return false; if (snapOuter) { env.dirty && env.dirty(L.work.group); return true; }
    let state = [[L, snap]]; const flip = () => { state = state.map(([Lr, m]) => { const back = Lr.field.restore(m); markBricks(Lr, [...m.keys()]); return [Lr, back]; }); };
    env.pushUndo && env.pushUndo({ label: label || 'shape', undo: flip, redo: flip }); env.dirty && env.dirty(L.work.group); return true;
  }
  function copiesMatrix(work, Mw, sym, count) {
    const g = work.group; g.updateMatrixWorld(true); const W = g.matrixWorld, Wi = new M4().copy(W).invert(), Ml = new M4().multiplyMatrices(Wi, Mw); let list = [Ml];
    if (sym === 'mirror' || sym === 'both') list = list.concat(list.map(m => new M4().makeScale(-1, 1, 1).multiply(m)));
    if (sym === 'radial' || sym === 'both') { const n = Math.max(2, count || 6), o = []; list.forEach(m => { for (let k = 0; k < n; k++) o.push(new M4().makeRotationY(Math.PI * 2 * k / n).multiply(m)); }); list = o; }
    return list.map(m => new M4().multiplyMatrices(W, m));
  }

  /* ---------- the layer list ---------- */
  function structural(label, doIt, undoIt) { doIt(); env.pushUndo && env.pushUndo({ label, undo: undoIt, redo: doIt }); }
  function addLayer() {
    const w = S.active ? S.active.work : works.find(x => x.group.parent); if (!w) { say('Make some clay first: pick Clay and pinch in the air.'); return null; }
    const idx = w.layers.indexOf(S.active) + 1; let L = null, prev = S.active;
    structural('new layer', () => { if (!L) L = newLayer(w, { index: idx }); else { w.group.add(L.group); w.layers.splice(Math.min(idx, w.layers.length), 0, L); layerById.set(L.id, L); } S.active = L; }, () => { w.group.remove(L.group); const i = w.layers.indexOf(L); if (i >= 0) w.layers.splice(i, 1); S.active = prev; });
    say(L.name + ': new strokes go here.'); return L;
  }
  function pickLayer(L) { if (L && live(L)) { S.active = L; say(L.name + (L.locked ? ' (locked)' : '') + (L.group.visible ? '' : ' (hidden)') + ' is picked.'); } }
  function stepLayer(d) { const list = allLayers().filter(live); if (!list.length) return null; const i = Math.max(0, list.indexOf(S.active)); pickLayer(list[(i + d + list.length) % list.length]); return S.active; }
  function toggleHide(L) { L = L || S.active; if (!L) return; const v = L.group.visible; structural(v ? 'hide layer' : 'show layer', () => { L.group.visible = !v; }, () => { L.group.visible = v; }); say(L.name + (v ? ' hidden: no tool touches it.' : ' shown.')); }
  function toggleLock(L) { L = L || S.active; if (!L) return; const v = L.locked; structural(v ? 'unlock layer' : 'lock layer', () => { L.locked = !v; }, () => { L.locked = v; }); say(L.name + (v ? ' unlocked.' : ' locked: no tool changes it.')); }
  function duplicate(L) {
    L = L || S.active; if (!L) return null; const w = L.work; let C = null;
    structural('duplicate layer', () => { if (!C) { C = newLayer(w, { field: L.field.clone(), index: w.layers.indexOf(L) + 1, name: L.name + ' copy', matrix: L.group.matrix.clone(), groupId: L.groupId }); } else { w.group.add(C.group); w.layers.splice(w.layers.indexOf(L) + 1, 0, C); layerById.set(C.id, C); } S.active = C; }, () => { w.group.remove(C.group); const i = w.layers.indexOf(C); if (i >= 0) w.layers.splice(i, 1); S.active = L; });
    say(C.name + ' made (on top of ' + L.name + ').'); return C;
  }
  function removeLayer(L) {
    L = L || S.active; if (!L) return; const w = L.work, i = w.layers.indexOf(L);
    structural('delete layer', () => { w.group.remove(L.group); const j = w.layers.indexOf(L); if (j >= 0) w.layers.splice(j, 1); if (S.active === L) S.active = w.layers[Math.max(0, i - 1)] || null; }, () => { w.group.add(L.group); w.layers.splice(i, 0, L); S.active = L; });
    say(L.name + ' deleted. Undo brings it back.');
  }
  /* Merge down: the picked layer goes INTO the one below it, as clay (add), as a cutter (subtract: the picked layer's shape is taken out of the one below) or as a keep-only (intersect). One undo step. */
  function mergeDown(mode, blend) {
    const L = S.active; if (!L) return false; const w = L.work, i = w.layers.indexOf(L), D = w.layers[i - 1]; if (!D) { say('There is no layer below ' + L.name + ' to merge into.'); return false; }
    const map = layerMap(D, L), bb = worldBoxOf(L, D); if (!bb && mode !== 'intersect') { say(L.name + ' is empty.'); return false; }
    const snap = new Map(), b = opMergeField(D.field, L.field, map, mode || 'add', (blend || 0) * 0.02, snap, bb && bb[0], bb && bb[1]); markAll(D);
    let gone = false; const apply = () => { w.group.remove(L.group); const j = w.layers.indexOf(L); if (j >= 0) w.layers.splice(j, 1); S.active = D; gone = true; };
    apply(); let state = snap;
    env.pushUndo && env.pushUndo({ label: 'merge ' + (mode || 'add'), undo: () => { state = D.field.restore(state); markBricks(D, [...state.keys()]); if (gone) { w.group.add(L.group); w.layers.splice(i, 0, L); S.active = L; gone = false; } }, redo: () => { state = D.field.restore(state); markBricks(D, [...state.keys()]); apply(); } });
    say(mode === 'subtract' ? L.name + ' was cut out of ' + D.name + '.' : mode === 'intersect' ? 'Only what ' + L.name + ' and ' + D.name + ' share is kept.' : L.name + ' merged into ' + D.name + '.'); void b; return true;
  }
  /* a point of D's space -> the same place in L's space */
  function layerMap(D, L) { D.group.updateMatrixWorld(true); L.group.updateMatrixWorld(true); const M = new M4().copy(L.group.matrixWorld).invert().multiply(D.group.matrixWorld), e = M.elements; return (x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; }
  function worldBoxOf(L, D) {   /* L's clay box in D's space (metres) */
    const bb = L.field.bounds(); if (!bb) return null; const h = L.field.h, M = new M4().copy(D.group.matrixWorld).invert().multiply(L.group.matrixWorld), box = new THREE.Box3(new V3(bb[0] * h, bb[1] * h, bb[2] * h), new V3(bb[3] * h, bb[4] * h, bb[5] * h)).applyMatrix4(M);
    return [[box.min.x, box.min.y, box.min.z], [box.max.x, box.max.y, box.max.z]];
  }
  /* Group: layers that share a group move together (Hold) and merge together (Merge group); a group can be a cutter as a whole */
  function groupWithBelow() {
    const L = S.active; if (!L) return; const w = L.work, i = w.layers.indexOf(L), D = w.layers[i - 1]; if (!D) { say('No layer below to group with.'); return; }
    const was = [L.groupId, D.groupId], id = D.groupId || L.groupId || ('G' + (++S.groupN)); structural('group', () => { const old = L.groupId; w.layers.forEach(x => { if (old && x.groupId === old) x.groupId = id; }); L.groupId = id; D.groupId = id; }, () => { L.groupId = was[0]; D.groupId = was[1]; });
    say(L.name + ' and ' + D.name + ' are one group now (' + w.layers.filter(x => x.groupId === id).length + ' layers).');
  }
  function ungroup() { const L = S.active; if (!L || !L.groupId) { say('The picked layer is not in a group.'); return; } const id = L.groupId, mem = L.work.layers.filter(x => x.groupId === id); structural('ungroup', () => mem.forEach(x => { x.groupId = null; }), () => mem.forEach(x => { x.groupId = id; })); say('Group taken apart: ' + mem.length + ' layers on their own again.'); }
  /* Merge group: every layer of the picked layer's group becomes one layer (the lowest), so the group can be used as one cutter or one stamp */
  function mergeGroup() {
    const L = S.active; if (!L || !L.groupId) { say('Pick a layer in a group first.'); return false; } const w = L.work, mem = w.layers.filter(x => x.groupId === L.groupId); if (mem.length < 2) return false;
    const base = mem[0], snap = new Map(); mem.slice(1).forEach(x => { const bb = worldBoxOf(x, base); if (bb) opMergeField(base.field, x.field, layerMap(base, x), 'add', 0, snap, bb[0], bb[1]); }); markAll(base);
    const rest = mem.slice(1), idx = rest.map(x => w.layers.indexOf(x)); const apply = () => { rest.forEach(x => { w.group.remove(x.group); const j = w.layers.indexOf(x); if (j >= 0) w.layers.splice(j, 1); }); S.active = base; }; apply(); let state = snap;
    env.pushUndo && env.pushUndo({ label: 'merge group', undo: () => { state = base.field.restore(state); markBricks(base, [...state.keys()]); rest.forEach((x, k) => { w.group.add(x.group); w.layers.splice(idx[k], 0, x); }); }, redo: () => { state = base.field.restore(state); markBricks(base, [...state.keys()]); apply(); } });
    say('The group is one layer now: ' + base.name + '.'); return true;
  }
  /* Remesh: the picked layer sampled again at a new detail (h metres): finer for small work, coarser for speed. One undo step. */
  function remesh(h) {
    const L = S.active; if (!L) return false; const old = L.field, bb = old.bounds(); if (!bb) return false; const nf = createField({ h, color: old.base }), oh = old.h;
    const t0 = now(); opMergeField(nf, old, (x, y, z) => [x, y, z], 'add', 0, null, [bb[0] * oh, bb[1] * oh, bb[2] * oh], [bb[3] * oh, bb[4] * oh, bb[5] * oh]); const ms = now() - t0;
    const swap = f => { L.chunks.forEach(m => { L.group.remove(m); m.geometry.dispose(); }); L.chunks.clear(); L.chunkVer.clear(); L.dirty.clear(); L.field = f; markAll(L); };
    swap(nf); env.pushUndo && env.pushUndo({ label: 'remesh', undo: () => swap(old), redo: () => swap(nf) });
    say(L.name + ' remeshed at ' + Math.round(h * 1000) + ' mm detail (' + Math.round(ms) + ' ms).'); return ms;
  }
  /* Make clay: a closed mesh (a prop, a shape, a baked layer) becomes a clay layer, so every clay tool and boolean works on it. The mesh is hidden, not deleted (undo shows it again). */
  function fromMesh(mesh, h) {
    mesh.updateMatrixWorld(true); const g = mesh.geometry, P = g.attributes.position, I = g.index ? g.index.array : null, nT = (I ? I.length : P.count) / 3, sc = scaleOf(mesh);
    h = h || Math.max(0.003, Math.min(0.012, (new THREE.Box3().setFromObject(mesh).getSize(new V3()).length()) / 120));
    const at = new THREE.Box3().setFromObject(mesh).getCenter(new V3()), w = works.find(x => x.group.parent) || newWork(at, null), L = newLayer(w, { h, name: (mesh.name || 'object').replace(/^cloth_/, '') + ' clay' });
    const toL = new M4().copy(L.group.matrixWorld).invert().multiply(mesh.matrixWorld), tri = [], v = new V3();
    for (let t = 0; t < nT; t++) { const q = []; for (let k = 0; k < 3; k++) { v.fromBufferAttribute(P, I ? I[t * 3 + k] : t * 3 + k).applyMatrix4(toL); q.push(v.x, v.y, v.z); } tri.push(q); }
    const t0 = now(), r = voxelize(L.field, tri); void sc;
    if (!r) { removeLayerQuiet(L); say('That object is too big to turn into clay at this detail.'); return null; }
    markAll(L); const vis = mesh.visible; mesh.visible = false; S.active = L;
    env.pushUndo && env.pushUndo({ label: 'make clay', undo: () => { mesh.visible = vis; w.group.remove(L.group); const j = w.layers.indexOf(L); if (j >= 0) w.layers.splice(j, 1); }, redo: () => { mesh.visible = false; w.group.add(L.group); w.layers.push(L); S.active = L; } });
    say('"' + (mesh.name || 'The object') + '" is clay now (' + Math.round(now() - t0) + ' ms). The original is hidden; undo brings it back.'); return L;
  }
  function removeLayerQuiet(L) { const w = L.work; w.group.remove(L.group); const j = w.layers.indexOf(L); if (j >= 0) w.layers.splice(j, 1); }
  /* signed distances near a closed triangle soup: the distance to the nearest triangle, the sign from a ray count along x (odd = inside). Bounded: refuses more than 4 M samples. */
  function voxelize(f, tris) {
    const h = f.h, band = f.band, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; tris.forEach(t => { for (let k = 0; k < 9; k++) { const a = k % 3; if (t[k] < lo[a]) lo[a] = t[k]; if (t[k] > hi[a]) hi[a] = t[k]; } });
    const i0 = Math.floor(lo[0] / h) - 5, j0 = Math.floor(lo[1] / h) - 5, k0 = Math.floor(lo[2] / h) - 5, nx = Math.ceil(hi[0] / h) + 5 - i0 + 1, ny = Math.ceil(hi[1] / h) + 5 - j0 + 1, nz = Math.ceil(hi[2] / h) + 5 - k0 + 1;
    if (nx * ny * nz > 4e6) return null;
    const d = new Float32Array(nx * ny * nz).fill(band), c = new Uint8Array(nx * ny * nz * 3); for (let i = 0; i < nx * ny * nz; i++) { c[i * 3] = f.base[0]; c[i * 3 + 1] = f.base[1]; c[i * 3 + 2] = f.base[2]; }
    /* unsigned distance in the band: each triangle writes to the samples round it */
    const cp = new Float64Array(3);
    for (const t of tris) {
      const a0 = Math.floor((Math.min(t[0], t[3], t[6]) - band) / h) - i0, a1 = Math.ceil((Math.max(t[0], t[3], t[6]) + band) / h) - i0, b0 = Math.floor((Math.min(t[1], t[4], t[7]) - band) / h) - j0, b1 = Math.ceil((Math.max(t[1], t[4], t[7]) + band) / h) - j0, c0 = Math.floor((Math.min(t[2], t[5], t[8]) - band) / h) - k0, c1 = Math.ceil((Math.max(t[2], t[5], t[8]) + band) / h) - k0;
      for (let z = Math.max(0, c0); z <= Math.min(nz - 1, c1); z++) for (let y = Math.max(0, b0); y <= Math.min(ny - 1, b1); y++) for (let x = Math.max(0, a0); x <= Math.min(nx - 1, a1); x++) {
        const px = (i0 + x) * h, py = (j0 + y) * h, pz = (k0 + z) * h; closestOnTri(px, py, pz, t, cp); const dd = Math.hypot(px - cp[0], py - cp[1], pz - cp[2]), o = x + nx * (y + ny * z); if (dd < d[o]) d[o] = dd;
      }
    }
    /* the sign: a ray along +x from each row; crossings toggle inside */
    const rows = new Map(); tris.forEach((t, ti) => { const y0 = Math.floor(Math.min(t[1], t[4], t[7]) / h) - j0, y1 = Math.ceil(Math.max(t[1], t[4], t[7]) / h) - j0, z0 = Math.floor(Math.min(t[2], t[5], t[8]) / h) - k0, z1 = Math.ceil(Math.max(t[2], t[5], t[8]) / h) - k0; for (let z = Math.max(0, z0); z <= Math.min(nz - 1, z1); z++) for (let y = Math.max(0, y0); y <= Math.min(ny - 1, y1); y++) { const k = y + ny * z; let l = rows.get(k); if (!l) { l = []; rows.set(k, l); } l.push(ti); } });
    rows.forEach((list, k) => {
      const y = k % ny, z = (k - y) / ny, py = (j0 + y) * h + h * 1e-3, pz = (k0 + z) * h + h * 7e-4, xs = [];
      for (const ti of list) { const t = tris[ti], ay = t[1], az = t[2], by = t[4], bz = t[5], cy = t[7], cz = t[8], dd = (by - ay) * (cz - az) - (cy - ay) * (bz - az); if (Math.abs(dd) < 1e-18) continue; const w1 = ((py - ay) * (cz - az) - (cy - ay) * (pz - az)) / dd, w2 = ((by - ay) * (pz - az) - (py - ay) * (bz - az)) / dd; if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue; xs.push(t[0] + w1 * (t[3] - t[0]) + w2 * (t[6] - t[0])); }
      if (xs.length < 2) return; xs.sort((p, q) => p - q);
      for (let x = 0; x < nx; x++) { const px = (i0 + x) * h; let n = 0; for (const xx of xs) { if (xx < px) n++; else break; } if (n % 2 === 1) { const o = x + nx * (y + ny * z); d[o] = -d[o]; } }
    });
    f.write({ d, c, i0, j0, k0, nx, ny, nz }, null); return true;
  }
  function closestOnTri(px, py, pz, t, out) {   /* the closest point of triangle t (9 numbers) to p (Ericson, Real-Time Collision Detection 5.1.5) */
    const ax = t[0], ay = t[1], az = t[2], abx = t[3] - ax, aby = t[4] - ay, abz = t[5] - az, acx = t[6] - ax, acy = t[7] - ay, acz = t[8] - az, apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz; if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
    const bpx = px - t[3], bpy = py - t[4], bpz = pz - t[5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz; if (d3 >= 0 && d4 <= d3) { out[0] = t[3]; out[1] = t[4]; out[2] = t[5]; return; }
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + abx * v; out[1] = ay + aby * v; out[2] = az + abz * v; return; }
    const cpx = px - t[6], cpy = py - t[7], cpz = pz - t[8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz; if (d6 >= 0 && d5 <= d6) { out[0] = t[6]; out[1] = t[7]; out[2] = t[8]; return; }
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + acx * w; out[1] = ay + acy * w; out[2] = az + acz * w; return; }
    const va = d3 * d6 - d5 * d4; if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); out[0] = t[3] + (t[6] - t[3]) * w; out[1] = t[4] + (t[7] - t[4]) * w; out[2] = t[5] + (t[8] - t[5]) * w; return; }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
  }
  /* the triangles of a layer as ONE mesh (welded where chunks meet), in the layer's space: for export, Bake to mesh, Decimate and stamping a figure with clay */
  function bakeGeometry(L) {
    flushLayer(L); const pos = [], nrm = [], col = [], idx = [], ids = new Map(), q = 1e6;
    L.chunks.forEach(m => { const g = m.geometry, P = g.attributes.position.array, Nn = g.attributes.normal.array, C = g.attributes.color.array, I = g.index.array, map = new Int32Array(P.length / 3);
      for (let i = 0; i < P.length / 3; i++) { const k = Math.round(P[i * 3] * q) + ',' + Math.round(P[i * 3 + 1] * q) + ',' + Math.round(P[i * 3 + 2] * q); let id = ids.get(k); if (id === undefined) { id = pos.length / 3; ids.set(k, id); pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); nrm.push(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]); col.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]); } map[i] = id; }
      for (let t = 0; t < I.length; t++) idx.push(map[I[t]]); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  function flushLayer(L) { for (const k of [...L.dirty]) { const j = job(L, k); L.dirty.delete(k); applyMesh(L.id, k, j.ver, meshChunk(j.d, j.c, j.n, j.i0, j.j0, j.k0, j.h)); } }
  /* a stand-in for a work in a save or an export: one plain mesh per visible layer (colours as vertex colours), laid out as the work is */
  function bakedClone(w) {
    const g = new THREE.Group(); g.name = w.name; w.group.updateMatrixWorld(true); g.matrix.copy(w.group.matrixWorld); g.matrix.decompose(g.position, g.quaternion, g.scale);
    w.layers.forEach(L => { if (!L.group.visible) return; const geo = bakeGeometry(L); if (!geo.index.count) return; const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); m.name = L.name; m.matrix.copy(L.group.matrix); m.matrix.decompose(m.position, m.quaternion, m.scale); g.add(m); });
    g.updateMatrixWorld(true); return g;
  }
  function stats() { let tris = 0, chunks = 0, bytes = 0, bricks = 0; allLayers().forEach(L => { if (!live(L)) return; L.chunks.forEach(m => { tris += m.geometry.index.count / 3; chunks++; }); bytes += L.field.bytes(); bricks += L.field.bricks.size; }); return { works: works.filter(w => w.group.parent).length, layers: allLayers().filter(live).length, tris, chunks, bricks, kB: Math.round(bytes / 1024), pending: pending(), worker: !!S.worker, workerOk: S.workerOk, dabs: S.dabs, dabMsAvg: S.dabs ? S.dabMs / S.dabs : 0, meshMsPerChunk: S.meshCount ? S.meshMs / S.meshCount : 0 }; }
  function resetStats() { S.dabs = 0; S.dabMs = 0; S.meshMs = 0; S.meshCount = 0; }
  return {
    S, works, allLayers, live, newWork, newLayer, ensureLayer, hit, strokeBegin, strokeStep, strokeEnd, applyShapeWorld, copiesWorld, copiesMatrix, tick, flush, pending,
    voxelizeField: voxelize, addLayer, pickLayer, stepLayer, toggleHide, toggleLock, duplicate, removeLayer, mergeDown, groupWithBelow, ungroup, mergeGroup, remesh, fromMesh, bakeGeometry, bakedClone, stats, resetStats, markAll, scaleOf,
    get active() { return S.active; }, set active(L) { S.active = L; },
  };
}
