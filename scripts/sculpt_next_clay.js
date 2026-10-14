/* sculpt_next_clay.js: clay WORKS made of LAYERS, as in Substance 3D Modeler (Ruth 2026-10-13). A work is a group in the room; each layer is its own clay field (sculpt_next_sdf.js) shown as chunks of
   triangles (sculpt_next_mesher.js), meshed in a Web Worker so a stroke never holds up a frame. Layers can be hidden, locked, grouped, duplicated, merged down (add, subtract, intersect) and remeshed;
   every change is one undo step. Strokes take mirror and radial symmetry from the work's own frame: the mirror is the work's middle plane, radial goes round its upright.
   makeClay(THREE, env): env = { say, addObject, removeObject, pushUndo({label, undo, redo}), dirty(obj), workerUrl (optional), noWorker (tests) }. */
import { createField, voxelizeTris, INSIDE, bkey, opIntersectFieldGen, opShapeGen, opOffsetGen, opSmoothGen, opPlaneGen, opWarpGen, opShape, opOffset, opSmooth, opPlane, opWarp, opIntersectField, opMergeField, surfacePlane, sdCapsule, sdPrim, falloff, bunkey, B } from './sculpt_next_sdf.js';
import { meshChunk } from './sculpt_next_mesher.js';
import { makeMaterial } from './sculpt_next_looks.js';

const N = 16;   /* cells per chunk side: 8 cm of clay at the normal 5 mm detail */
const OFS = 1024, SP = 2048, ckey = (x, y, z) => ((x + OFS) * SP + (y + OFS)) * SP + (z + OFS), cunkey = k => { const z = k % SP, r = (k - z) / SP, y = r % SP, x = (r - y) / SP; return [x - OFS, y - OFS, z - OFS]; };
export const CLAY_COLORS = [[214, 196, 170], [196, 120, 96], [143, 184, 217], [167, 212, 155], [242, 213, 107], [183, 154, 217], [245, 240, 230], [90, 85, 96], [74, 44, 255], [138, 60, 255], [255, 138, 30], [255, 36, 36]];   /* the last four are the emblem's: royal blue, violet, orange, crimson */

export function makeClay(THREE, env) {
  env = env || {};
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion, say = t => { try { env.say && env.say(t); } catch (e) { /* the host's voice is optional */ } };
  const LINEAR = parseInt(THREE.REVISION, 10) >= 152 && !(THREE.ColorManagement && THREE.ColorManagement.enabled === false), SL = new Float32Array(1025); for (let i = 0; i <= 1024; i++) { const c = i / 1024; SL[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const toLinear = a => { for (let i = 0; i < a.length; i++) { const v = a[i] <= 0 ? 0 : a[i] >= 1 ? 1 : a[i]; a[i] = SL[Math.round(v * 1024)]; } };
  const works = [], S = { queue: [], jobsDone: 0, pumpMs: 0, jobs: new Map(), active: null, layerN: 0, workN: 0, groupN: 0, worker: null, workerOk: false, inflight: 0, jobId: 0, slowMs: 0, slowWhat: '', meshMs: 0, meshCount: 0, lastDabMs: 0, dabs: 0, dabMs: 0 };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- the worker (off the page's thread); if it cannot start, meshing runs on the page within a time budget per frame ---------- */
  function startWorker() {
    if (env.noWorker || typeof Worker === 'undefined') return;
    try {
      const url = env.workerUrl || new URL('./sculpt_next_worker.js', import.meta.url);
      const w = new Worker(url, { type: 'module' });
      w.onmessage = e => { const m = e.data; S.workerOk = true;
        if (m.type === 'mesh' || !m.type) { S.inflight = Math.max(0, S.inflight - 1); if (m.out) for (const r of m.out) applyMesh(r.layer, r.key, r.ver, r); return; }
        const p = S.jobs.get(m.id); if (!p) return; S.jobs.delete(m.id); if (m.error) p.no(new Error(m.error)); else p.ok(m.r); };
      w.onerror = e => { say('Clay meshing moved to the main thread (' + String(e && e.message || 'worker failed').slice(0, 50) + ').'); try { w.terminate(); } catch (x) { /* already gone */ } S.worker = null; S.inflight = 0; S.jobs.forEach(p => p.no(new Error('worker stopped'))); S.jobs.clear(); allLayers().forEach(l => l.chunkVer.forEach((_, k) => l.dirty.add(k))); };
      S.worker = w;
    } catch (e) { S.worker = null; }
  }
  startWorker();
  const layerById = new Map();
  /* a one-off heavy job (voxelize, decimate) in the worker: a Promise, or null when there is no worker (the caller then does it here) */
  function work(type, payload, move) { if (!S.worker) return null; const id = ++S.jobId; return new Promise((ok, no) => { S.jobs.set(id, { ok, no }); S.worker.postMessage(Object.assign({ type, id }, payload), move || []); }); }

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
    const mat = makeMaterial(THREE, 'satin', { vertexColors: true });
    const L = { id: 'L' + S.layerN, name: g.name, work, group: g, field: opts.field || createField({ h, color }), chunks: new Map(), dirty: new Set(), chunkVer: new Map(), material: mat, locked: false, groupId: opts.groupId || null };
    if (opts.matrix) { opts.matrix.decompose(g.position, g.quaternion, g.scale); }
    work.group.add(g); g.updateMatrixWorld(true); const at = opts.index == null ? work.layers.length : opts.index; work.layers.splice(at, 0, L); layerById.set(L.id, L);
    if (opts.field) markAll(L);
    return L;
  }
  const allLayers = () => { const out = []; works.forEach(w => w.layers.forEach(l => out.push(l))); return out; };
  const live = l => l && l.group.parent && l.work.group.parent;
  function ensureLayer(at, frameObj) {   /* the layer a clay stroke goes into: the picked one, else a new work (at the figure's middle plane when a figure is on the bench, else where the hand is) */
    if (S.forceNew) {   /* the asset bench: a new work of its own, where the hand is, not tied to the figure */
      S.forceNew = false; const w = newWork(at.clone(), null), L = newLayer(w); S.active = L;
      env.pushUndo && env.pushUndo({ label: 'new asset', undo: () => { detachWork(w); }, redo: () => { attachWork(w); S.active = L; } }); return L;
    }
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
    if (LINEAR) toLinear(m.color);   /* three r152 and later read vertex colours as linear light: the clay's colours are picked as screen (sRGB) colours, so they are turned once here, or a deep navy comes out pale */
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(m.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3)); g.setAttribute('color', new THREE.BufferAttribute(m.color, 3)); g.setIndex(new THREE.BufferAttribute(m.index, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
    if (!mesh) { mesh = new THREE.Mesh(g, L.material); mesh.name = '_clay_chunk'; mesh.userData.noMerge = true; mesh.userData.clayLayer = L.id; L.group.add(mesh); L.chunks.set(k, mesh); }
    else { const old = mesh.geometry; mesh.geometry = g; old.dispose(); }
    mesh.updateMatrixWorld(true);
  }
  /* every frame: send dirty chunks to the worker, or mesh them here until the time budget is spent. The picked layer goes first. */
  function tick(budgetMs) {
    pump(Math.max(2, budgetMs || 4));   /* queued dabs first: what the hand did shows soonest */
    if (remeshJobs.length) remeshTick(Math.max(2, (budgetMs || 4) * 0.75), false);
    const order = allLayers().filter(l => l.dirty.size).sort((a, b) => (a === S.active ? -1 : b === S.active ? 1 : 0)); if (!order.length) return 0;
    let done = 0; const t0 = now();
    if (S.worker && S.inflight < 3) {
      const jobs = [], tj = now(); for (const L of order) { for (const k of L.dirty) { jobs.push(job(L, k)); L.dirty.delete(k); if (jobs.length >= 24 || now() - tj > 2.5) break; } if (jobs.length >= 24 || now() - tj > 2.5) break; }   /* reading the chunks to send costs time too: at most 2.5 ms of it a frame */
      if (jobs.length) { S.inflight++; const move = []; jobs.forEach(j => move.push(j.d.buffer, j.c.buffer)); S.worker.postMessage({ type: 'mesh', id: ++S.jobId, jobs }, move); done = jobs.length; }
      return done;
    }
    if (S.worker) return 0;
    for (const L of order) { for (const k of [...L.dirty]) { const j = job(L, k); L.dirty.delete(k); const m = meshChunk(j.d, j.c, j.n, j.i0, j.j0, j.k0, j.h); applyMesh(L.id, k, j.ver, m); done++; if (now() - t0 > (budgetMs || 4)) break; } if (now() - t0 > (budgetMs || 4)) break; }
    S.meshMs += now() - t0; S.meshCount += done; return done;
  }
  function flush() {   /* run every queued dab, finish every remesh and mesh everything that waits, right now, here (tests, a save, an export, an undo) */
    drainQueue(); remeshTick(0, true); const t0 = now(); let n = 0; allLayers().forEach(L => { for (const k of [...L.dirty]) { const j = job(L, k); L.dirty.delete(k); applyMesh(L.id, k, j.ver, meshChunk(j.d, j.c, j.n, j.i0, j.j0, j.k0, j.h)); n++; } }); S.meshMs += now() - t0; S.meshCount += n; return n;
  }
  const pending = () => allLayers().reduce((a, l) => a + l.dirty.size, 0) + S.inflight + remeshJobs.length + S.queue.length;

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
  /* the nearest layer by its BOX (a saw or carve sweep often starts in the air beside the clay, farther than the stored band): { layer, d } within reach, or null */
  function nearBox(pw, reach) {
    let best = null;
    for (const L of allLayers()) {
      if (!live(L) || !L.group.visible || L.locked) continue; const bb = L.field.bounds(); if (!bb) continue; const h = L.field.h;
      const box = new THREE.Box3(new V3(bb[0] * h, bb[1] * h, bb[2] * h), new V3(bb[3] * h, bb[4] * h, bb[5] * h)).applyMatrix4(L.group.matrixWorld), d = box.distanceToPoint(pw);
      if (d <= reach && (!best || d < best.d)) best = { layer: L, d };
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
    const st = { who: env.who ? env.who() : undefined, L, work: L.work, snaps: new Map(), last: null, lastDab: null, hold: 0, opts, temp: null, changed: false, dots: 0, travel: 0, jobs: 0, ending: false, done: false };
    if (opts.op === 'intersect' && (opts.mode === 'clay' || opts.mode === 'dots')) st.temp = createField({ h: L.field.h, color: L.field.base });   /* intersect: the stroke is gathered first, then only the clay inside it stays */
    return st;
  }
  const snapFor = (st, L) => { let m = st.snaps.get(L); if (!m) { m = new Map(); st.snaps.set(L, m); } return m; };
  /* one step. pw = the brush point (world), prev = the last step's point, dirW = the hand's pointing way, deltaW = the hand's move since the last frame (grab, smear) */
  function strokeStep(st, pw, prevW, opts) {
    const t0 = now(), L = st.L; if (L.locked) return false; const fld = L.field, sc = scaleOf(L.group), mode = opts.mode, op = opts.op, rW = opts.radius;
    const sets = copiesWorld(st.work, [pw, prevW || pw], opts.sym, opts.count), fall = falloff(opts.falloff), snap = snapFor(st, L), toL = p => L.group.worldToLocal(p.clone());
    const r = rW / sc, h = fld.h, gens = [];   /* the dabs are queued and run within the frame budget (pump), so a heavy one never holds up a frame */
    for (const set of sets) {
      const a = toL(set.pts[1]), b = toL(set.pts[0]), A = [a.x, a.y, a.z], Bp = [b.x, b.y, b.z];
      const lo = [Math.min(A[0], Bp[0]) - r, Math.min(A[1], Bp[1]) - r, Math.min(A[2], Bp[2]) - r], hi = [Math.max(A[0], Bp[0]) + r, Math.max(A[1], Bp[1]) + r, Math.max(A[2], Bp[2]) + r];
      let box = null;
      if (op === 'paint' && mode !== 'clay' && mode !== 'dots') box = opShapeGen(fld, [Bp[0] - r, Bp[1] - r, Bp[2] - r], [Bp[0] + r, Bp[1] + r, Bp[2] + r], (x, y, z) => Math.hypot(x - Bp[0], y - Bp[1], z - Bp[2]) - r, 'paint', 0, opts.color, snap, opts.strength);
      else if (mode === 'clay') {
        let nrm = null; if (opts.profile === 'flat') { const pl = surfacePlane(fld, Bp, r * 1.5); nrm = pl ? pl.n : (opts.dirW ? (() => { const d = copyDir(st.work, opts.dirW, set); const dl = L.group.worldToLocal(pw.clone().add(d)).sub(b).normalize(); return [dl.x, dl.y, dl.z]; })() : [0, 1, 0]); }
        const rr = r * (0.35 + 0.65 * opts.press), k = opts.blend * rr, dist = (x, y, z) => sdCapsule(x, y, z, A, Bp, rr, nrm, opts.profile === 'flat' ? 0.85 : 0);
        if (st.temp) box = opShapeGen(st.temp, lo, hi, dist, 'add', k, opts.color, null);
        else box = opShapeGen(fld, lo, hi, dist, op === 'subtract' ? 'subtract' : op === 'paint' ? 'paint' : 'add', k, opts.color, snap, opts.strength);
      }
      else if (mode === 'inflate' || mode === 'deflate') { const sg = (mode === 'deflate' ? -1 : 1) * (op === 'subtract' ? -1 : 1); box = opOffsetGen(fld, Bp, r, sg * Math.min(h * 0.8, opts.strength * r * 0.12), fall, snap); }   /* at most 0.8 voxel a dab, so the stored band always holds the new surface */
      else if (mode === 'smooth') box = opSmoothGen(fld, Bp, r, opts.strength * 0.9, fall, snap);
      else if (mode === 'flatten' || mode === 'scrape' || mode === 'fill') {
        const pl = surfacePlane(fld, Bp, r); if (!pl) continue;
        const dig = mode === 'scrape' ? r * 0.04 * opts.strength : mode === 'fill' ? -r * 0.04 * opts.strength : 0; pl.p = [pl.p[0] - pl.n[0] * dig, pl.p[1] - pl.n[1] * dig, pl.p[2] - pl.n[2] * dig];
        box = opPlaneGen(fld, Bp, r, pl, opts.strength * 0.5, mode, fall, snap);
      }
      else if (mode === 'pinch') {   /* pull the clay toward the stroke's line, and cut a soft groove (subtract: a crease) or lay a thin ridge (add) */
        const ab = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2], s = opts.strength;
        gens.push([opWarpGen(fld, lo, hi, r * 0.3, (x, y, z) => { const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - A[0]) * ab[0] + (y - A[1]) * ab[1] + (z - A[2]) * ab[2]) / L2)) : 0; const qx = A[0] + ab[0] * t - x, qy = A[1] + ab[1] * t - y, qz = A[2] + ab[2] * t - z, d = Math.hypot(qx, qy, qz), w = fall(d / r); if (w <= 0 || d < 1e-9) return null; const m = Math.min(d, r * 0.25 * s * w); return [qx / d * m, qy / d * m, qz / d * m]; }, snap), false]);
        const gr = Math.max(h * 1.2, r * 0.18), b2 = opShapeGen(fld, lo, hi, (x, y, z) => sdCapsule(x, y, z, A, Bp, gr), op === 'subtract' ? 'subtract' : 'add', gr, opts.color, snap); box = box || b2; if (b2) markBox(L, b2);
      }
      else if (mode === 'grab' || mode === 'smear' || mode === 'melt') {
        let dW; if (mode === 'melt') dW = new V3(0, -1, 0).multiplyScalar(opts.strength * rW * 0.06); else { if (!opts.deltaW) continue; dW = copyDir(st.work, opts.deltaW, set).multiplyScalar(mode === 'smear' ? Math.min(1, opts.strength * 1.2) : 1); }
        const c0 = mode === 'grab' ? toL(set.pts[1]) : b, dL = L.group.worldToLocal(set.pts[0].clone().add(dW)).sub(b), D = [dL.x, dL.y, dL.z], C = [c0.x, c0.y, c0.z], Dl = Math.hypot(D[0], D[1], D[2]); if (Dl < 1e-7) continue;
        box = opWarpGen(fld, [C[0] - r, C[1] - r, C[2] - r], [C[0] + r, C[1] + r, C[2] + r], Dl, (x, y, z) => { const w = fall(Math.hypot(x - C[0] - D[0], y - C[1] - D[1], z - C[2] - D[2]) / r); return w > 0 ? [D[0] * w, D[1] * w, D[2] * w] : null; }, snap);
      }
      else if (mode === 'dots') {   /* a stamp every so often along the stroke, pointing out of the surface (or along the hand) */
        const pl = surfacePlane(fld, Bp, r * 1.5), up = pl ? new V3(...pl.n) : new V3(0, 1, 0), q = new Q().setFromUnitVectors(new V3(0, 1, 0), up.normalize()), sv = fld.sample(Bp[0], Bp[1], Bp[2]), onS = pl && Math.abs(sv) < fld.band * 0.99 ? new V3(Bp[0] - up.x * sv, Bp[1] - up.y * sv, Bp[2] - up.z * sv) : new V3(...Bp), M = new M4().compose(onS, q, new V3(r * 0.5, r * 0.5, r * 0.5)),   /* the stamp sits ON the surface under the fingertip */ Mi = new M4().copy(M).invert(), kind = ({ ball: 'sphere', ring: 'torus', cube: 'cube', spike: 'cone' })[opts.dot] || 'sphere', e = Mi.elements, sc2 = r * 0.5;
        const dist = (x, y, z) => { const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; return sdPrim(kind, X, Y, Z, 0.15) * sc2; };
        const lo2 = [Bp[0] - r, Bp[1] - r, Bp[2] - r], hi2 = [Bp[0] + r, Bp[1] + r, Bp[2] + r];
        box = st.temp ? opShapeGen(st.temp, lo2, hi2, dist, 'add', 0, opts.color, null) : opShapeGen(fld, lo2, hi2, dist, op === 'subtract' ? 'subtract' : op === 'paint' ? 'paint' : 'add', h * 0.5, opts.color, snap, opts.strength);
      }
      if (box) gens.push([box, !!(st.temp && (mode === 'clay' || mode === 'dots'))]);
    }
    gens.forEach(([g, tmp]) => { qpush({ gen: g, st, L, tmp, ms: 0 }); st.jobs++; }); S.dabs++; void t0; return gens.length > 0;
  }
  /* ---------- the queue: dabs run in order, a slice at a time, within a few ms a frame ---------- */
  function pump(budgetMs) {
    const t0 = now(); let n = 0;
    while (S.queue.length) {
      const j = S.queue[0], t1 = now(); S.cur = j; S.ins = 1; let r; try { r = j.gen.next(); } finally { S.cur = null; } const dj = now() - t1; j.ms += dj; if (dj > S.slowMs) { S.slowMs = dj; S.slowWhat = j.label || (j.st ? 'dab ' + (j.st.opts && j.st.opts.mode) : 'job'); }
      if (r.done && j.onDone) { S.queue.shift(); S.jobsDone++; try { j.onDone(r.value); } catch (e) { console.warn('clay job', e); } }
      else if (r.done) { S.queue.shift(); j.st.jobs--; S.dabMs += j.ms; S.jobsDone++; S.lastDabMs = j.ms; if (r.value) { j.st.changed = true; if (j.all) markAll(j.L); else if (!j.tmp) markBox(j.L, r.value); } if (j.st.ending && !j.st.jobs) finishStroke(j.st); }
      if (++n % 4 === 0 && now() - t0 > budgetMs) break;
    }
    S.pumpMs = now() - t0;
  }
  const drainQueue = () => { if (S.queue.length && !S.cur) pump(Infinity); };   /* never from inside a running job (an ordered step of a shared session runs as a job) */
  function qpush(item) { if (S.cur) S.queue.splice(S.ins++, 0, item); else S.queue.push(item); }   /* a job started by a running job goes right after it, so every headset runs the same order */
  const enqueue = (gen, onDone, label) => { qpush({ gen, onDone, ms: 0, label }); };   /* any sliced job (a generator) with something to do when it ends */
  const backlog = () => S.queue.length;
  /* the stroke's undo step is made when its last queued dab has run */
  function strokeEnd(st, label) {
    st.label = label; if (st.ending) return true;
    if (st.temp && !st.temp.empty()) { qpush({ gen: opIntersectFieldGen(st.L.field, st.temp, 0, snapFor(st, st.L)), st, L: st.L, tmp: false, ms: 0, all: true }); st.jobs++; st.temp = null; }   /* only what the stroke covered stays: queued like any dab */
    if (st.half) { qpush({ gen: opIntersectFieldGen(st.L.field, st.half, 0, snapFor(st, st.L)), st, L: st.L, tmp: false, ms: 0, all: true }); st.jobs++; st.half = null; }
    st.ending = true; if (!st.jobs) return finishStroke(st); return true;
  }
  function finishStroke(st) {
    if (st.done) return false; st.done = true; const label = st.label;
    const L = st.L;
    if (!st.changed) return false;
    const snaps = [...st.snaps.entries()].filter(([, m]) => m.size); if (!snaps.length) return false;
    const flipTo = list => list.map(([Lr, m]) => { const back = Lr.field.restore(m); markBricks(Lr, [...m.keys()]); return [Lr, back]; });
    let state = snaps; const entry = { who: st.who, label: label || 'clay', undo: () => { state = flipTo(state); }, redo: () => { state = flipTo(state); }, touch: snaps.map(([Lr]) => 'L:' + Lr.id) };
    env.pushUndo && env.pushUndo(entry); env.dirty && env.dirty(L.work.group); return true;
  }

  /* ---------- a whole shape at once (a primitive from the shape tool, a stamp, the saw's slab): dist in WORLD space via a matrix, so the layer's own placement is respected ---------- */
  /* snapOuter: the caller's snapshot (a saw sweep, a carve hold): no undo step here, the caller makes one for the whole sweep */
  function applyShapeWorld(L, kind, worldMatrix, mode, blend, color, sym, count, label, round, snapOuter) {
    drainQueue();
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
    env.pushUndo && env.pushUndo({ label: label || 'shape', undo: flip, redo: flip, touch: ['L:' + L.id] }); env.dirty && env.dirty(L.work.group); return true;
  }
  /* one shape inside a stroke (the saw's slab, Carve's ball): queued, sliced, one undo for the sweep. intoTemp: gathered for a keep-inside, applied when the stroke ends. */
  function shapeStep(st, kind, worldMatrix, mode, blend, sym, count, intoTemp) {
    const L = st.L; if (L.locked) return false; const sets = sym && sym !== 'off' ? copiesMatrix(L.work, worldMatrix, sym, count) : [worldMatrix];
    if (intoTemp && !st.temp) st.temp = createField({ h: L.field.h, color: L.field.base });
    for (const Mw of sets) {
      const Ml = new M4().copy(L.group.matrixWorld).invert().multiply(Mw), Mi = new M4().copy(Ml).invert(), e = Mi.elements, s = new V3(); Ml.decompose(new V3(), new Q(), s); const smin = Math.min(Math.abs(s.x), Math.abs(s.y), Math.abs(s.z));
      const dist = (x, y, z) => sdPrim(kind, e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14], 0) * smin;
      const bb = new THREE.Box3(new V3(-1, -1, -1), new V3(1, 1, 1)).applyMatrix4(Ml);
      qpush({ gen: opShapeGen(intoTemp ? st.temp : L.field, [bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.max.y, bb.max.z], dist, intoTemp ? 'add' : mode, blend, null, intoTemp ? null : snapFor(st, L), 1), st, L, tmp: !!intoTemp, ms: 0 }); st.jobs++;
    }
    return true;
  }
  /* a whole-side cut: keep only what is on one side of a plane, queued as the stroke ends (dist: height above the plane in the layer's units) */
  function halfStep(st, dist) { st.half = { sample: dist }; return true; }
  function copiesMatrix(work, Mw, sym, count) {
    const g = work.group; g.updateMatrixWorld(true); const W = g.matrixWorld, Wi = new M4().copy(W).invert(), Ml = new M4().multiplyMatrices(Wi, Mw); let list = [Ml];
    if (sym === 'mirror' || sym === 'both') list = list.concat(list.map(m => new M4().makeScale(-1, 1, 1).multiply(m)));
    if (sym === 'radial' || sym === 'both') { const n = Math.max(2, count || 6), o = []; list.forEach(m => { for (let k = 0; k < n; k++) o.push(new M4().makeRotationY(Math.PI * 2 * k / n).multiply(m)); }); list = o; }
    return list.map(m => new M4().multiplyMatrices(W, m));
  }

  /* ---------- a layer's surface: Substance paints colour, roughness and metal; here colour is painted per point and the finish is per layer (matte, satin, gloss, metal, glow) ---------- */
  /* a layer's look (sculpt_next_looks.js: matte, satin, gloss, metal, chrome, glow, glass, pearl, velvet, candy, toon) and how see-through it is; one material per layer, shared by its chunks */
  function applyFinish(L, f, alpha) {
    const m = makeMaterial(THREE, f || 'satin', { vertexColors: true, name: L.name }); const a = alpha == null ? 1 : alpha;
    if (a < 0.999) { m.transparent = true; m.opacity = Math.min(m.opacity == null ? 1 : m.opacity, a); m.depthWrite = false; }
    L.material = m; L.chunks.forEach(c => { c.material = m; }); L.finish = f || 'satin'; L.alpha = a;
  }
  function setFinish(L, f, alpha) {
    if (!L) return; const was = L.finish || 'satin', wasA = L.alpha == null ? 1 : L.alpha, a = alpha == null ? wasA : alpha; if (was === f && Math.abs(wasA - a) < 1e-3) return;
    applyFinish(L, f, a); env.pushUndo && env.pushUndo({ label: 'look', undo: () => applyFinish(L, was, wasA), redo: () => applyFinish(L, f, a), touch: ['L:' + L.id] }); env.dirty && env.dirty(L.work.group);
    say(L.name + ': ' + f + (a < 0.999 ? ', ' + Math.round((1 - a) * 100) + '% see-through' : '') + '.');
  }
  /* colour a whole layer by a rule (the Gradient tool, a skin): rgbAt(x, y, z) in the layer's own space -> [r, g, b] 0..255, for every stored point near the surface. One undo step. */
  function* paintFieldByGen(L, rgbAt, label, who) {   /* 48 bricks a slice */
    const f = L.field, h = f.h, band = f.band * 0.999, snap = new Map(); let n = 0;
    for (const [k, br] of [...f.bricks.entries()]) { if (br === INSIDE) continue; const [bx, by, bz] = bunkey(k); snap.set(k, { d: br.d.slice(), c: br.c.slice() });
      for (let z = 0; z < B; z++) for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const s = x + B * (y + B * z); if (Math.abs(br.d[s]) >= band) continue; const c = rgbAt((bx * B + x) * h, (by * B + y) * h, (bz * B + z) * h); br.c[s * 3] = c[0]; br.c[s * 3 + 1] = c[1]; br.c[s * 3 + 2] = c[2]; }
      if (++n % 48 === 0) { markBricks(L, [...snap.keys()].slice(-48)); yield; } }
    if (!snap.size) return false; f.version++; markAll(L); let state = snap;
    const flip = () => { state = f.restore(state); markBricks(L, [...state.keys()]); };
    env.pushUndo && env.pushUndo({ who, label: label || 'gradient', undo: flip, redo: flip, touch: ['L:' + L.id] }); env.dirty && env.dirty(L.work.group); return true;
  }
  const paintFieldBy = (L, rgbAt, label) => runGen(paintFieldByGen(L, rgbAt, label));

  /* ---------- the layer list ---------- */
  function structural(label, doIt, undoIt, touch) { doIt(); env.pushUndo && env.pushUndo({ label, undo: undoIt, redo: doIt, touch: touch || (S.active ? ['W:' + S.active.work.id] : ['*']) }); }
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
    drainQueue();
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
    drainQueue();
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
    drainQueue();
    const L = S.active; if (!L || !L.groupId) { say('Pick a layer in a group first.'); return false; } const w = L.work, mem = w.layers.filter(x => x.groupId === L.groupId); if (mem.length < 2) return false;
    const base = mem[0], snap = new Map(); mem.slice(1).forEach(x => { const bb = worldBoxOf(x, base); if (bb) opMergeField(base.field, x.field, layerMap(base, x), 'add', 0, snap, bb[0], bb[1]); }); markAll(base);
    const rest = mem.slice(1), idx = rest.map(x => w.layers.indexOf(x)); const apply = () => { rest.forEach(x => { w.group.remove(x.group); const j = w.layers.indexOf(x); if (j >= 0) w.layers.splice(j, 1); }); S.active = base; }; apply(); let state = snap;
    env.pushUndo && env.pushUndo({ label: 'merge group', undo: () => { state = base.field.restore(state); markBricks(base, [...state.keys()]); rest.forEach((x, k) => { w.group.add(x.group); w.layers.splice(idx[k], 0, x); }); }, redo: () => { state = base.field.restore(state); markBricks(base, [...state.keys()]); apply(); } });
    say('The group is one layer now: ' + base.name + '.'); return true;
  }
  /* Remesh: the picked layer sampled again at a new detail (h metres): finer for small work, coarser for speed. One undo step.
     Each new brick is filled straight from the old field (trilinear), bricks wholly in air or wholly inside are settled from one sample at their middle, and only a few ms of bricks are done per frame
     (from tick()), so even a big layer never freezes the headset; the old layer stays in view until the new one is ready. */
  const remeshJobs = [];
  function remesh(h) {
    drainQueue();
    const L = S.active; if (!L) return false; if (remeshJobs.some(j => j.L === L)) { say(L.name + ' is already being remeshed.'); return false; }
    const old = L.field, bb = old.bounds(); if (!bb) return false; const oh = old.h, nf = createField({ h, color: old.base }), list = [];
    for (let bz = Math.floor(bb[2] * oh / h / B) - 1; bz <= Math.floor(bb[5] * oh / h / B) + 1; bz++) for (let by = Math.floor(bb[1] * oh / h / B) - 1; by <= Math.floor(bb[4] * oh / h / B) + 1; by++) for (let bx = Math.floor(bb[0] * oh / h / B) - 1; bx <= Math.floor(bb[3] * oh / h / B) + 1; bx++) list.push([bx, by, bz]);
    if (env.ordered && env.ordered()) {   /* sculpting together: the remesh runs as jobs in the shared order (a few bricks a slice), so every headset swaps the layer at the same point */
      const w0 = env.who ? env.who() : undefined, t0 = now();
      enqueue((function* () { for (let i = 0; i < list.length; i++) { const [bx, by, bz] = list[i]; remeshBrick(old, nf, bx, by, bz); if (i % 48 === 47) yield; }
        const swap = f => { L.chunks.forEach(m => { L.group.remove(m); m.geometry.dispose(); }); L.chunks.clear(); L.chunkVer.clear(); L.dirty.clear(); L.field = f; markAll(L); };
        swap(nf); S.lastRemeshMs = now() - t0; env.pushUndo && env.pushUndo({ who: w0, label: 'remesh', undo: () => swap(old), redo: () => swap(nf), touch: ['L:' + L.id] }); })());
      say('Remeshing ' + L.name + ' at ' + Math.round(h * 1000) + ' mm detail…'); return true;
    }
    remeshJobs.push({ L, old, nf, list, i: 0, ms: 0, ver: old.version }); say('Remeshing ' + L.name + ' at ' + Math.round(h * 1000) + ' mm detail…'); return true;
  }
  function remeshBrick(old, nf, bx, by, bz) {
    const h = nf.h, band = nf.band, half = 3.5 * h * Math.sqrt(3), mid = old.sample((bx * B + 3.5) * h, (by * B + 3.5) * h, (bz * B + 3.5) * h);
    if (mid - half >= Math.min(band, old.band * 0.999)) return;   /* all air */
    if (mid + half <= -Math.min(band, old.band * 0.999)) { nf.bricks.set(bkey(bx, by, bz), INSIDE); return; }   /* all inside */
    const br = nf.newBrick(band); let any = false, allIn = true;
    for (let z = 0; z < B; z++) for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const s = x + B * (y + B * z), X = (bx * B + x) * h, Y = (by * B + y) * h, Z = (bz * B + z) * h, v = Math.max(-band, Math.min(band, old.sample(X, Y, Z))); br.d[s] = v; if (v < band) any = true; if (v > -band) allIn = false; if (Math.abs(v) < h * 2) { const c = old.colorAt(X, Y, Z); br.c[s * 3] = c[0]; br.c[s * 3 + 1] = c[1]; br.c[s * 3 + 2] = c[2]; } }
    if (allIn) nf.bricks.set(bkey(bx, by, bz), INSIDE); else if (any) nf.bricks.set(bkey(bx, by, bz), br);
  }
  function remeshTick(budgetMs, all) {
    const t0 = now();
    while (remeshJobs.length && (all || now() - t0 < budgetMs)) {
      const j = remeshJobs[0];
      if (j.L.field !== j.old || j.old.version !== j.ver) { remeshJobs.shift(); say(j.L.name + ' changed while it was being remeshed; remesh again when you are ready.'); continue; }
      const t1 = now(); while (j.i < j.list.length && (all || now() - t0 < budgetMs)) { const [bx, by, bz] = j.list[j.i++]; remeshBrick(j.old, j.nf, bx, by, bz); } j.ms += now() - t1;
      if (j.i < j.list.length) continue;
      remeshJobs.shift(); const L = j.L, old = j.old, nf = j.nf;
      const swap = f => { L.chunks.forEach(m => { L.group.remove(m); m.geometry.dispose(); }); L.chunks.clear(); L.chunkVer.clear(); L.dirty.clear(); L.field = f; markAll(L); };
      swap(nf); env.pushUndo && env.pushUndo({ label: 'remesh', undo: () => swap(old), redo: () => swap(nf) }); S.lastRemeshMs = j.ms;
      say(L.name + ' remeshed at ' + Math.round(nf.h * 1000) + ' mm detail.');
    }
  }
  /* Make clay: a closed mesh (a prop, a shape, a baked layer) becomes a clay layer, so every clay tool and boolean works on it. The mesh is hidden, not deleted (undo shows it again). */
  function fromMesh(mesh, h) {
    drainQueue();
    mesh.updateMatrixWorld(true); const g = mesh.geometry, P = g.attributes.position, I = g.index ? g.index.array : null, nT = (I ? I.length : P.count) / 3, sc = scaleOf(mesh);
    h = h || Math.max(0.003, Math.min(0.012, (new THREE.Box3().setFromObject(mesh).getSize(new V3()).length()) / 120));
    const at = new THREE.Box3().setFromObject(mesh).getCenter(new V3()), w = works.find(x => x.group.parent) || newWork(at, null), L = newLayer(w, { h, name: (mesh.name || 'object').replace(/^cloth_/, '') + ' clay' });
    const toL = new M4().copy(L.group.matrixWorld).invert().multiply(mesh.matrixWorld), tri = [], v = new V3();
    for (let t = 0; t < nT; t++) { const q = []; for (let k = 0; k < 3; k++) { v.fromBufferAttribute(P, I ? I[t * 3 + k] : t * 3 + k).applyMatrix4(toL); q.push(v.x, v.y, v.z); } tri.push(q); }
    const t0 = now(); void sc;
    const finish = r => {
      if (!r) { removeLayerQuiet(L); say('That object is too big to turn into clay at this detail.'); return null; }
      L.field.write(r, null); markAll(L); const vis = mesh.visible; mesh.visible = false; S.active = L;
      env.pushUndo && env.pushUndo({ label: 'make clay', undo: () => { mesh.visible = vis; w.group.remove(L.group); const j = w.layers.indexOf(L); if (j >= 0) w.layers.splice(j, 1); }, redo: () => { mesh.visible = false; w.group.add(L.group); w.layers.push(L); S.active = L; } });
      env.dirty && env.dirty(w.group); say('"' + (mesh.name || 'The object') + '" is clay now (' + Math.round(now() - t0) + ' ms). The original is hidden; undo brings it back.'); return L;
    };
    const job = env.syncMake && env.syncMake() ? null : work('voxel', { tris: tri, h: L.field.h, band: L.field.band, base: L.field.base });
    if (job) { say('Turning "' + (mesh.name || 'the object') + '" into clay…'); return job.then(finish, () => finish(voxelizeTris(tri, L.field.h, L.field.band, L.field.base))); }
    return finish(voxelizeTris(tri, L.field.h, L.field.band, L.field.base));
  }
  function removeLayerQuiet(L) { const w = L.work; w.group.remove(L.group); const j = w.layers.indexOf(L); if (j >= 0) w.layers.splice(j, 1); }
  /* a closed triangle soup -> signed distances in f (sculpt_next_sdf.js voxelizeTris does the maths, here or in the worker) */
  function voxelize(f, tris) { const r = voxelizeTris(tris, f.h, f.band, f.base); if (!r) return null; f.write(r, null); return true; }
  /* the triangles of a layer as ONE mesh (welded where chunks meet), in the layer's space: for export, Bake to mesh, Decimate and stamping a figure with clay */
  function bakeGeometry(L) {
    drainQueue();
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
    w.layers.forEach(L => { if (!L.group.visible) return; const geo = bakeGeometry(L); if (!geo.index.count) return; const m = new THREE.Mesh(geo, L.material.clone()); m.name = L.name; m.matrix.copy(L.group.matrix); m.matrix.decompose(m.position, m.quaternion, m.scale); g.add(m); });
    g.updateMatrixWorld(true); return g;
  }
  /* sculpting together: the whole clay state as plain data (a newcomer's snapshot), and back. enc/dec are sculpt_next_collab.js encodeField / decodeFieldInto. */
  const trs = o => [o.position.toArray(), o.quaternion.toArray(), o.scale.toArray()], setTrs = (o, t) => { o.position.fromArray(t[0]); o.quaternion.fromArray(t[1]); o.scale.fromArray(t[2]); o.updateMatrix(); o.updateMatrixWorld(true); };
  const runGen = g => { let r; do r = g.next(); while (!r.done); return r.value; };
  function* exportStateGen(enc) {   /* a layer per slice (yield between), so a big work never holds a frame up */
    const out = { n: [S.layerN, S.workN, S.groupN], works: [] };
    for (const w of works) { if (!w.group.parent) continue; const ws = { id: w.id, name: w.name, t: trs(w.group), layers: [] }; out.works.push(ws);
      for (const L of w.layers) { ws.layers.push({ id: L.id, name: L.name, t: trs(L.group), vis: L.group.visible, locked: L.locked, groupId: L.groupId, finish: L.finish || 'satin', alpha: L.alpha == null ? 1 : L.alpha, field: enc(L.field, INSIDE) }); yield; } }
    return out;
  }
  function* importStateGen(st, dec) {
    drainQueue(); remeshJobs.length = 0; works.slice().forEach(w => detachWork(w)); works.length = 0; layerById.clear(); S.active = null;
    for (const ws of st.works) {
      const w = newWork(null, null); w.id = ws.id; w.name = ws.name; w.group.name = ws.name; setTrs(w.group, ws.t);
      for (const ls of ws.layers) { const f = dec(createField({ h: ls.field.h, band: ls.field.band, color: ls.field.base }), ls.field, INSIDE), L = newLayer(w, { field: f, name: ls.name, groupId: ls.groupId }); setTrs(L.group, ls.t);
        layerById.delete(L.id); L.id = ls.id; layerById.set(L.id, L); L.group.visible = ls.vis; L.locked = ls.locked; applyFinish(L, ls.finish, ls.alpha); yield; }
    }
    [S.layerN, S.workN, S.groupN] = st.n; return true;
  }
  const exportState = enc => runGen(exportStateGen(enc)), importState = (st, dec) => runGen(importStateGen(st, dec));
  function stats() { let tris = 0, chunks = 0, bytes = 0, bricks = 0; allLayers().forEach(L => { if (!live(L)) return; L.chunks.forEach(m => { tris += m.geometry.index.count / 3; chunks++; }); bytes += L.field.bytes(); bricks += L.field.bricks.size; }); return { works: works.filter(w => w.group.parent).length, layers: allLayers().filter(live).length, tris, chunks, bricks, kB: Math.round(bytes / 1024), pending: pending(), worker: !!S.worker, workerOk: S.workerOk, dabs: S.dabs, dabMsAvg: S.jobsDone ? S.dabMs / S.jobsDone : 0, queue: S.queue.length, pumpMs: S.pumpMs, meshMsPerChunk: S.meshCount ? S.meshMs / S.meshCount : 0 }; }
  function resetStats() { S.dabs = 0; S.jobsDone = 0; S.dabMs = 0; S.meshMs = 0; S.meshCount = 0; }
  return {
    S, works, allLayers, live, newWork, newLayer, ensureLayer, hit, nearBox, strokeBegin, strokeStep, strokeEnd, applyShapeWorld, copiesWorld, copiesMatrix, tick, flush, pending,
    layerById: id => allLayers().find(l => l.id === id) || null, voxelizeField: voxelize, work, shapeStep, halfStep, enqueue, detachWork, attachWork, pump, drainQueue, backlog, setFinish, paintFieldBy, paintFieldByGen, addLayer, pickLayer, stepLayer, toggleHide, toggleLock, duplicate, removeLayer, mergeDown, groupWithBelow, ungroup, mergeGroup, remesh, fromMesh, bakeGeometry, bakedClone, stats, resetStats, markAll, scaleOf, exportState, importState, exportStateGen, importStateGen,
    get active() { return S.active; }, set active(L) { S.active = L; },
  };
}
