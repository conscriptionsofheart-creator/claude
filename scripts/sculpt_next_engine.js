/* sculpt_next_engine.js: the NEXT sculpt engine (Ruth 2026-10-13: "sculpt objects in VR as well as in Adobe Substance 3D Modeler, with the features Substance has"). Drop-in for lib/bst_vr_sculpt.js behind the
   same contract (lib/sculpt_next_README.md): the Atelier and the BSA load this file when Sculpt > More tools says "Engine: next"; if it fails to load they fall back to the current engine by themselves.
   What it is made of (all files sit flat in lib/, named sculpt_next_*.js):
     sculpt_next_sdf.js      the clay: a narrow-band signed distance field in 8x8x8 bricks (Substance keeps clay as a volume too), with the brush maths
     sculpt_next_mesher.js   clay -> triangles (Surface Nets, 16-cell chunks), run in sculpt_next_worker.js off the page's thread
     sculpt_next_clay.js     clay works, layers, groups, merge / boolean, remesh, Make clay from an object, strokes with mirror and radial symmetry
     sculpt_next_surface.js  the brushes on triangle meshes (figures, clothes, props), also exported here as makeSculpt(THREE) (a superset of bst_sculpt_core.js)
     sculpt_next_figure.js   hand strokes on figures into SHAPE KEYS (skeleton, skin weights and rest shape untouched), paint, keys
     sculpt_next_shapes.js   primitive shapes with a hand gizmo (add / subtract / intersect / paint), and Hold: two hands move, turn and resize the work
     sculpt_next_export.js   bake, decimate a copy to a triangle budget, glTF export (three r128 and r186)
     sculpt_next_ui.js       the wrist-menu pages, their picture-tile icons, and one lesson step per tool
   What it keeps: the current engine (bst_vr_sculpt.js) runs INSIDE this one for the tools that already work on meshes: the saw and the plane cut, Carve, Erase, Heal edge, Close hole, Wrinkle, Stamp
   and Squeeze (bst_cut.js does the geometry, as before), so the saw is the same saw. On clay those tools have clay versions here. One undo stack holds both. */
import { createVrSculpt as createCurrent } from '/pe_lib/bst_vr_sculpt.js?v=wr7';
import { makeSculpt as makeCurrentCore } from '/pe_lib/bst_sculpt_core.js';
import { stampGeometry, solidFromMesh, solidUnion } from '/pe_lib/bst_cut.js';
import { makeSculpt } from './sculpt_next_surface.js';
import { makeClay, CLAY_COLORS } from './sculpt_next_clay.js';
import { makeFigureBrushes } from './sculpt_next_figure.js';
import { makeShapes, makeHold } from './sculpt_next_shapes.js';
import { makeExport } from './sculpt_next_export.js';
import { makeMenu, ICONS, LESSONS, TILES } from './sculpt_next_ui.js';
import { createField, opShape, opIntersectField } from './sculpt_next_sdf.js';
export { makeSculpt };
export const ENGINE = 'next', ENGINE_VERSION = '2026-10-13';

const CURRENT_MODES = new Set(['cut', 'stamp', 'carve', 'erase', 'heal', 'close', 'wrinkle', 'squeeze']);
const BRUSHES = new Set(['inflate', 'deflate', 'melt', 'smooth', 'grab', 'clay', 'flatten', 'scrape', 'fill', 'pinch', 'smear', 'dots']);
const HOLD_BRUSHES = new Set(['grab', 'smear']);   /* these follow the hand every frame */

export function createVrSculpt(THREE, core, host) {
  host = host || {};
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion, say = t => { try { host.say && host.say(t); } catch (e) { /* the host's voice is optional */ } };
  core = core && core.kind === 'next' ? core : makeSculpt(THREE);
  const cfg = {
    /* the current engine's settings, same names and meanings */
    stampScale: 1, carveKeep: 'outside', cutGoes: 'front', cutBlade: 'saw', cutCap: true, profile: 'round', thick: 'steady', color: 0, mode: 'inflate', size: 5, strength: 50, sym: 'off', count: 6, key: 'Shape 1', into: 'key', on: false,
    /* new: Substance's settings */
    op: 'add',            /* every brush and shape: add | subtract | paint | intersect */
    falloff: 'smooth',    /* smooth | linear | sharp | flat (Substance's hardness) */
    stabilize: 0.3,       /* 0 = off .. 1 = very steady (lazy-mouse: the brush trails the fingertip on a string) */
    blend: 0.3,           /* how softly new clay and shapes melt into the old (0 = hard edge) */
    clayProfile: 'round', /* round | flat (a ribbon) */
    dot: 'ball',          /* Dots: ball | ring | cube | spike */
    prim: 'sphere',       /* Shapes: sphere | cube | cylinder | cone | torus | capsule */
    detail: 5,            /* new clay layers: voxel size in mm (3 fine, 5 normal, 10 rough) */
    tint: 0,              /* clay and paint colour (index into CLAY_COLORS) */
    holdWhat: 'work',     /* Hold moves the whole work, or only the picked layer (with its group) */
    clayOnFigure: 'skin', /* the Clay brush on a figure: build up its skin in a key (skin), or put new clay on it (clay) */
    budget: 0,            /* export: triangle budget for the COPY (0 = keep every triangle); people are never thinned */
  };
  const undoS = [], redoS = [];
  function pushUndo(e) { undoS.push(e); redoS.length = 0; if (undoS.length > 100) undoS.shift(); }
  const cursor = { hands: {} };
  let figure = null, entered = false, tick = 0, meshFilter = null, current = null, currentOn = false, lastMsg = 0;
  const once = (t, ms) => { const n = Date.now(); if (n - lastMsg > (ms || 2500)) { lastMsg = n; say(t); } };
  const dirty = obj => { if (host.dirty) try { host.dirty(obj); } catch (e) { /* optional */ } };
  const strokeStart = () => { if (host.strokeStart) try { host.strokeStart(); } catch (e) { /* optional */ } };

  /* ---------- the current engine, inside: it does the mesh tools it already does well ---------- */
  const innerHost = Object.assign({}, host, { setBench: () => {}, say: t => say(t) });
  function currentEngine() { if (!current) current = createCurrent(THREE, makeCurrentCore(THREE), innerHost); return current; }
  function syncCurrent() { const c = currentEngine().cfg; ['stampScale', 'carveKeep', 'cutGoes', 'cutBlade', 'cutCap', 'profile', 'thick', 'color', 'size', 'strength', 'count', 'key'].forEach(k => { c[k] = cfg[k]; }); c.sym = cfg.sym === 'both' ? 'radial' : cfg.sym; if (c.mode !== cfg.mode && CURRENT_MODES.has(cfg.mode)) currentEngine().set.mode(cfg.mode); }
  /* every undo step the current engine records becomes one step here, in order */
  function viaCurrent(fn) { const c = currentEngine(), n0 = c.strokes(); const r = fn(c); const n1 = c.strokes(); for (let i = n0; i < n1; i++) pushUndo({ label: 'mesh tool', undo: () => c.undo(), redo: () => c.redo(), current: true }); return r; }

  /* ---------- what the tools touch ---------- */
  const isClayMesh = o => { for (let q = o; q; q = q.parent) if (q.userData && (q.userData.clayWork || q.userData.clayLayer)) return true; return false; };
  function collect(root, any) { const out = []; if (!root) return out; root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count >= 8 && o.visible && (any ? !/^vr/.test(o.name || '') : (o.isSkinnedMesh && o.skeleton)) && !(o.userData && o.userData._bfx) && !/^_/.test(o.name || '') && !isClayMesh(o)) out.push(o); }); return out; }
  const propMeshes = () => { const out = []; try { ((host.props && host.props()) || []).forEach(r => { if (r && r !== figure && !isClayMesh(r)) collect(r, true).forEach(m => { if (!out.includes(m)) out.push(m); }); }); } catch (e) { /* the host's list is optional */ } return out.filter(m => !(figure && figure.getObjectById(m.id))); };
  const tubeMeshes = () => { const out = []; if (current) current.squeezed().forEach(e => collect(e.object, true).forEach(m => { if (!out.includes(m)) out.push(m); })); return out; };
  let targetsCache = [];
  function targets() { const all = collect(figure).concat(propMeshes()); tubeMeshes().forEach(m => { if (!all.includes(m)) all.push(m); }); const ok = all.filter(m => !(m.userData && m.userData.figLocked)); targetsCache = meshFilter ? ok.filter(meshFilter) : ok; return targetsCache; }

  const paintRGB = () => CLAY_COLORS[cfg.tint % CLAY_COLORS.length].map(v => v / 255);
  Object.defineProperty(cfg, 'paintRGB', { get: paintRGB, enumerable: false });
  const fig = makeFigureBrushes(THREE, core, { say, cfg, figure: () => figure, targets: () => targetsCache, pushUndo, dirty, strokeStart, afterEdit: () => { if (current) current.repose(); } });
  const clay = makeClay(THREE, { say, pushUndo, dirty, addObject: o => { try { host.addObject ? host.addObject(o) : null; } catch (e) { /* the host's */ } }, removeObject: o => { try { host.removeObject ? host.removeObject(o) : (o.parent && o.parent.remove(o)); } catch (e) { /* gone */ } }, detail: () => cfg.detail / 1000, color: () => CLAY_COLORS[cfg.tint % CLAY_COLORS.length], noWorker: host.noWorker });
  const exporter = makeExport(THREE, { say, clay });
  const shapes = makeShapes(THREE, { say, cfg, clay, pushUndo, dirty, strokeStart, figure: () => figure, addHelper: o => { try { host.addObject ? host.addObject(o) : null; } catch (e) { /* host */ } }, removeHelper: o => { try { if (o.parent) o.parent.remove(o); } catch (e) { /* gone */ } }, stampMesh: (m, solid, keep) => stampMesh(m, solid, keep), meshNear: (p, r) => meshNear(p, r), color: () => CLAY_COLORS[cfg.tint % CLAY_COLORS.length] });
  const hold = makeHold(THREE, { say, cfg, clay, pushUndo, dirty, props: () => { try { return ((host.props && host.props()) || []).filter(o => o && o !== figure && !(figure && figure.getObjectById(o.id))); } catch (e) { return []; } } });

  /* ---------- the bench ---------- */
  function enter(root) {
    figure = root || (host.figure && host.figure()); targets();
    try { host.setBench && host.setBench(true); } catch (e) { /* the bench is the host's */ }
    clay.works.forEach(w => { if (w.group.parent) w.group.traverse(o => o.layers.set(0)); });   /* the bench moves what it does not know to a hidden layer; clay works are the work, so they stay in view */
    currentOn = false; try { syncCurrent(); currentOn = currentEngine().enter(figure); } catch (e) { currentOn = false; console.warn('sculpt next: current engine', e); }
    if (!targetsCache.length && !clay.works.some(w => w.group.parent)) { if (!CURRENT_MODES.has(cfg.mode)) cfg.mode = 'clay'; say('Nothing here to shape yet, so the brush is Clay: pinch in the air to start a lump.'); }
    else say('Sculpt bench (next engine). Clay builds in the air, Smooth, Flatten, Pinch, Inflate, Grab, Scrape, Smear and Dots shape what you touch; the mode tile says add, subtract, paint or intersect.');
    cfg.on = true; entered = true; return true;
  }
  function leave() { endAll(); shapes.applyPending(false); try { if (current && current.cfg.on) current.leave(); } catch (e) { /* fine */ } try { host.setBench && host.setBench(false); } catch (e) { /* the bench is the host's */ } cfg.on = false; entered = false; cursor.hands = {}; shapes.hide(); clay.flush(); }

  /* ---------- the stabiliser: the brush point trails the fingertip on a string (Substance's lazy mouse), so a shaky hand still draws a clean line ---------- */
  const lazy = new Map();
  function steady(hands) {
    const out = [], R = cfg.stabilize * 0.03;
    for (const h of hands) {
      let L = lazy.get(h.id); if (!L || !h.pinch) { L = { p: h.tip.clone() }; lazy.set(h.id, L); }
      if (R > 0 && h.pinch) { const d = h.tip.distanceTo(L.p); if (d > R) L.p.lerp(h.tip, 1 - R / d); } else L.p.copy(h.tip);
      out.push(Object.assign({}, h, { tip: L.p.clone(), rawTip: h.tip }));
    }
    for (const id of [...lazy.keys()]) if (!hands.some(h => h.id === id)) lazy.delete(id);
    return out;
  }

  /* ---------- routing: clay or mesh, decided when the pinch starts and kept until it ends ---------- */
  const route = new Map();   /* hand id -> { to: 'clay' | 'mesh' | 'current', st, ... } */
  function meshNear(p, reach) { const h = fig.hitAt(p, Math.max(cfg.size, reach * 100)); return h && h.dWorld <= reach + 1e-6 ? h : null; }
  function decide(hand) {
    targets();   /* things made since the last look (a tube just squeezed, a prop just pulled in) are brushable at once */
    const r = cfg.size / 100, ch = clay.hit(hand.tip, r * 1.3 + 0.01, true), mh = (cfg.mode === 'clay' && cfg.clayOnFigure === 'clay') ? null : fig.hitAt(hand.tip, cfg.size);
    if (ch && (!mh || ch.d <= mh.dWorld)) return { to: 'clay', layer: ch.layer };
    if (mh) return { to: 'mesh', hit: mh };
    return { to: cfg.mode === 'clay' || cfg.mode === 'dots' && cfg.op !== 'paint' ? 'air' : 'none' };
  }

  /* ---------- the clay side of a brush ---------- */
  function clayOpts(hand, prevTip) {
    return { mode: cfg.mode, op: cfg.op, radius: cfg.size / 100, strength: cfg.strength / 100, falloff: cfg.falloff, sym: cfg.sym, count: cfg.count, color: CLAY_COLORS[cfg.tint % CLAY_COLORS.length], blend: cfg.blend, profile: cfg.clayProfile, dot: cfg.dot, press: hand.press != null ? 0.25 + 0.75 * Math.max(0, Math.min(1, hand.press)) : 1, dirW: hand.dir || null, deltaW: prevTip ? hand.tip.clone().sub(prevTip) : null };
  }
  function clayFrame(hand, rt, dt) {
    const r = cfg.size / 100;
    if (!rt.st) {
      let L = rt.layer;
      if (!L && clay.active && clay.live(clay.active) && clay.active.group.visible) L = clay.active;   /* a stroke that starts in the air works on the picked layer (a subtract or intersect stroke drawn in from outside) */
      if (!L) { if (cfg.op === 'subtract' || cfg.op === 'paint' || cfg.op === 'intersect') { once(cfg.op === 'paint' ? 'Paint needs clay or a figure under the brush.' : 'There is no clay here to ' + cfg.op + ': switch the mode to add to build some.'); return; } L = clay.ensureLayer(hand.tip, figure); if (!L) return; }
      if (L.locked) { once(L.name + ' is locked: unlock it on the Layers page.'); return; }
      strokeStart(); rt.st = clay.strokeBegin(L, { mode: cfg.mode, op: cfg.op }); rt.last = hand.tip.clone(); rt.prevTip = hand.tip.clone(); rt.t = 1; rt.travel = 0;
      if (!HOLD_BRUSHES.has(cfg.mode)) { clay.strokeStep(rt.st, hand.tip, hand.tip, clayOpts(hand, null)); }
      return;
    }
    rt.t += dt; const moved = hand.tip.distanceTo(rt.last), spacing = cfg.mode === 'dots' ? r * 1.4 : Math.max(clay.S.active ? clay.S.active.field.h * 0.8 : 0.004, r * 0.25);
    if (rt.cool > 0) { rt.cool--; return; }   /* the last dab was costly (a big brush on fine clay): skip a frame or two. Nothing is lost: the next dab joins the last point to this one. */
    const cost = () => { const ms = clay.S.lastDabMs; rt.cool = ms > 6 ? Math.min(3, Math.floor(ms / 6)) : 0; };
    if (HOLD_BRUSHES.has(cfg.mode)) { if (hand.tip.distanceTo(rt.prevTip) > 1e-4) { clay.strokeStep(rt.st, hand.tip, rt.prevTip, clayOpts(hand, rt.prevTip)); rt.prevTip = hand.tip.clone(); cost(); } return; }
    if (moved >= spacing || (cfg.mode !== 'dots' && cfg.mode !== 'clay' && rt.t > 0.05)) { clay.strokeStep(rt.st, hand.tip, cfg.mode === 'clay' ? rt.last : hand.tip, clayOpts(hand, rt.last)); rt.last = hand.tip.clone(); rt.t = 0; cost(); }
  }
  function clayEnd(rt) { if (rt.st) clay.strokeEnd(rt.st, ({ clay: 'clay', dots: 'dots' })[cfg.mode] || cfg.mode); rt.st = null; }

  /* ---------- clay versions of the mesh tools: saw, plane cut, carve, erase, stamp ---------- */
  function clayCut(hand, rt) {
    if (!hand.dir) { once('The cut needs the direction your hand points.'); return; }
    const L = rt.layer, q = new Q().setFromUnitVectors(new V3(0, 1, 0), hand.dir.clone().normalize());
    if (cfg.cutBlade === 'plane') {   /* the whole side the hand points to goes (or the other side) */
      if (rt.done) return; rt.done = true; strokeStart(); const Mi = new M4().compose(hand.tip, q, new V3(1, 1, 1)).invert(), toL = new M4().copy(Mi).multiply(L.group.matrixWorld), e = toL.elements, sc = clay.scaleOf(L.group), sign = cfg.cutGoes === 'front' ? 1 : -1;
      const half = { sample: (x, y, z) => sign * (e[1] * x + e[5] * y + e[9] * z + e[13]) / sc };   /* height above the plane (world metres) in the layer's own units */
      const snap = new Map(), b = opIntersectField(L.field, half, 0, snap); if (!b) { say('The plane does not cut this clay.'); return; } clay.markAll(L);
      let state = snap; const flip = () => { state = L.field.restore(state); clay.markAll(L); }; pushUndo({ label: 'cut clay', undo: flip, redo: flip }); dirty(L.work.group); say('Cut ' + L.name + ' along the plane. Undo puts it back.'); return;
    }
    const R = Math.max(0.005, cfg.size / 100), kerf = Math.max(0.004, Math.min(0.012, R * 0.2));   /* the saw: a slab as wide as the Size ring and a few mm thick, swept with the hand; one undo for the sweep */
    if (rt.last && hand.tip.distanceTo(rt.last) < Math.max(0.004, R * 0.25)) return;
    const qs = new Q().setFromUnitVectors(new V3(0, 0, 1), hand.dir.clone().normalize()), M = new M4().compose(hand.tip, qs, new V3(R, R, kerf / 2));
    if (!rt.snap) { rt.snap = new Map(); strokeStart(); }
    clay.applyShapeWorld(L, 'cube', M, 'subtract', 0, null, cfg.sym, cfg.count, null, 0, rt.snap); rt.last = hand.tip.clone(); rt.n = (rt.n || 0) + 1;
  }
  function clayBall(hand, rt, dt) {   /* Carve and Erase on clay: a ball that takes clay away as it sweeps; Carve set to keep inside keeps only what the sweep covered */
    const L = rt.layer, R = cfg.size / 100; rt.t = (rt.t || 1) + dt; if (rt.last && hand.tip.distanceTo(rt.last) < R * 0.3 && rt.t < 0.12) return; rt.t = 0;
    const M = new M4().compose(hand.tip, new Q(), new V3(R, R, R)); if (!rt.snap) { rt.snap = new Map(); strokeStart(); }
    if (cfg.mode === 'carve' && cfg.carveKeep === 'inside') { if (!rt.keep) rt.keep = createField({ h: L.field.h, color: L.field.base }); const p = L.group.worldToLocal(hand.tip.clone()), r = R / clay.scaleOf(L.group); opShape(rt.keep, [p.x - r, p.y - r, p.z - r], [p.x + r, p.y + r, p.z + r], (x, y, z) => Math.hypot(x - p.x, y - p.y, z - p.z) - r, 'add', 0, null, null); }
    else clay.applyShapeWorld(L, 'sphere', M, 'subtract', cfg.blend * R * 0.3, null, cfg.sym, cfg.count, null, 0, rt.snap);
    rt.last = hand.tip.clone(); rt.n = (rt.n || 0) + 1;
  }
  function clayToolEnd(rt, label) {
    const L = rt.layer; if (!L) return;
    if (rt.keep) { const b = opIntersectField(L.field, rt.keep, 0, rt.snap); if (b) clay.markAll(L); }
    if (!rt.snap || !rt.snap.size) return; let state = rt.snap; const flip = () => { state = L.field.restore(state); clay.markAll(L); };
    pushUndo({ label, undo: flip, redo: flip }); dirty(L.work.group); say((label === 'saw clay' ? 'Sawed through ' : label === 'erase clay' ? 'Erased from ' : 'Carved ') + L.name + ' (' + (rt.n || 1) + ' pass' + ((rt.n || 1) === 1 ? '' : 'es') + '). Undo puts it back.');
  }
  /* Stamp: the picked objects press in. Into CLAY: the stamp is turned into clay for a moment and taken away (or kept-only). Into a MESH with clay in the stamp: the clay's triangles make the cutter
     (bst_cut.js stampGeometry, exactly as the current engine's Stamp does it). Anything else is the current engine's own Stamp. */
  function stampSources() { const src = host.stampSource && host.stampSource(); if (!src) return null; const roots = (src.roots || (src.root ? [src.root] : [])).filter(r => r && r.parent); return roots.length ? { roots, name: src.name } : null; }
  function stampSolid(roots, hand, intoMesh) {   /* the stamp's closed triangles, posed at the hand, in intoMesh's space (or world when intoMesh is null) */
    const box = new THREE.Box3(); roots.forEach(r => { r.updateMatrixWorld(true); box.expandByObject(r); }); const pivot = box.getCenter(new V3()), pivInv = new M4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    const stampM = new M4().compose(hand.tip, hand.quat || new Q(), new V3(1, 1, 1).multiplyScalar(cfg.stampScale || 1)), bodyInv = intoMesh ? new M4().copy(intoMesh.matrixWorld).invert() : new M4(), solids = [], open = [];
    roots.forEach(r => r.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || /^vr/.test(o.name || '') || (o.userData && o.userData._bfx)) return;
      if (o.userData.clayLayer && o.name === '_clay_chunk') return;   /* clay is added below as one welded piece per layer */
      const M = new M4().multiplyMatrices(bodyInv, new M4().multiplyMatrices(stampM, new M4().multiplyMatrices(pivInv, o.matrixWorld))), sd = solidFromMesh(THREE, o.geometry, M, null); if (!sd.closed) { open.push(o.name || 'a piece'); return; } solids.push(sd);
    }));
    roots.forEach(r => { if (!r.userData || !r.userData.clayWork) return; const w = clay.works.find(x => x.group === r); if (!w) return; w.layers.forEach(L => { if (!L.group.visible) return; const g = clay.bakeGeometry(L); if (!g.index.count) return; L.group.updateMatrixWorld(true); const M = new M4().multiplyMatrices(bodyInv, new M4().multiplyMatrices(stampM, new M4().multiplyMatrices(pivInv, L.group.matrixWorld))), sd = solidFromMesh(THREE, g, M, null); sd.closed = true; solids.push(sd); }); });   /* clay is closed by how it is made; Surface Nets can pinch an edge where two strokes touch, which the strict check would refuse */
    return { solid: solids.length > 1 ? solidUnion(THREE, solids) : solids[0] || null, open };
  }
  function stampAt(hand) {
    const src = stampSources(); if (!src) { say('Pick a stamp first: More > Pick stamp. A group of objects is one stamp.'); return false; }
    const hasClay = src.roots.some(r => r.userData && r.userData.clayWork), under = m => { for (let q = m; q; q = q.parent) if (src.roots.includes(q)) return true; return false; };
    const ch = clay.hit(hand.tip, 0.3, true); let mh = null; for (const m of fig.pickable(hand.tip, 0.3)) { if (under(m)) continue; const en = fig.entryOf(m), h = fig.nearest(en, m.worldToLocal(hand.tip.clone()), 0.3 / (m.matrixWorld.getMaxScaleOnAxis() || 1)); if (h && (!mh || h.d < mh.d)) mh = { ...h, mesh: m, dWorld: h.d * (m.matrixWorld.getMaxScaleOnAxis() || 1) }; }
    if (ch && !under(ch.layer.group) && (!mh || ch.d <= mh.dWorld)) {   /* into clay */
      const L = ch.layer, { solid } = stampSolid(src.roots, hand, null); if (!solid) { say('The stamp is empty.'); return false; }
      const tris = solid.tris.map(t => { const a = t.map(v => L.group.worldToLocal(v.clone())); return [a[0].x, a[0].y, a[0].z, a[1].x, a[1].y, a[1].z, a[2].x, a[2].y, a[2].z]; });
      const tmp = createField({ h: L.field.h, color: L.field.base }), ok = voxelInto(tmp, tris); if (!ok) { say('The stamp is too big for this clay\'s detail.'); return false; }
      strokeStart(); const snap = new Map(); let b;
      if (cfg.carveKeep === 'inside') b = opIntersectField(L.field, tmp, 0, snap);
      else { const bb = tmp.bounds(), h = tmp.h; b = bb && opShape(L.field, [bb[0] * h, bb[1] * h, bb[2] * h], [bb[3] * h, bb[4] * h, bb[5] * h], (x, y, z) => tmp.sample(x, y, z), 'subtract', 0, null, snap); }
      if (!b) { say('The stamp did not touch the clay: press it in further.'); return false; } clay.markAll(L);
      let state = snap; const flip = () => { state = L.field.restore(state); clay.markAll(L); }; pushUndo({ label: 'stamp clay', undo: flip, redo: flip }); dirty(L.work.group);
      say((cfg.carveKeep === 'inside' ? 'Kept only what is inside "' : 'Carved "') + (src.name || 'the stamp') + '" into ' + L.name + '. Undo puts it back.'); return true;
    }
    if (!mh) { say('The stamp is too far from the skin: press it onto the figure, object or clay.'); return false; }
    if (!hasClay) return viaCurrent(c => { syncCurrent(); return c.stampAt(hand); });   /* the current engine's own Stamp, unchanged */
    const bm = mh.mesh, { solid } = stampSolid(src.roots, hand, bm); if (!solid) { say('The stamp is empty.'); return false; }
    return stampMesh(bm, solid, cfg.carveKeep, src.name);
  }
  /* a closed solid (in the mesh's space) pressed into a triangle mesh, figure or not, with every attribute, the skin and the keys carried (bst_cut.js), shells following; one undo step */
  const shellsOf = mesh => { const out = []; if (!figure) return out; const n = mesh.geometry.attributes.position.count; figure.traverse(o => { if (o !== mesh && o.isMesh && o.geometry && ((o.userData && o.userData._bfx) || /^_/.test(o.name || '')) && o.geometry.attributes.position.count === n) out.push(o); }); return out; };
  function restFixFor(bm) {
    if (!fig.skinned(bm)) return null; const cache = new Map(), g = bm.geometry, ia = g.attributes.skinIndex.array, wa = g.attributes.skinWeight.array, bmx = bm.skeleton.boneMatrices, t = new M4();
    return (i, d) => { let m = cache.get(i); if (!m) { const A = new M4(), e = A.elements; for (let k = 0; k < 16; k++) e[k] = 0; for (let k = 0; k < 4; k++) { const w = wa[i * 4 + k]; if (!w) continue; t.fromArray(bmx, ia[i * 4 + k] * 16); for (let q = 0; q < 16; q++) e[q] += t.elements[q] * w; } const Lm = new M4().copy(bm.bindMatrixInverse).multiply(A).multiply(bm.bindMatrix); Lm.setPosition(0, 0, 0); m = Lm.invert(); cache.set(i, m); } return d.clone().applyMatrix4(m); };
  }
  function stampMesh(bm, solid, keep, name) {
    bm.updateMatrixWorld(true); if (fig.skinned(bm)) bm.skeleton.update(); const en = fig.entryOf(bm), posed = en.posed, restFix = restFixFor(bm), jobs = [bm].concat(shellsOf(bm));
    const res = stampGeometry(THREE, bm.geometry, solid, { posed, keep: keep || 'outside', restFix }); if (!res) { say('The shape did not touch "' + (bm.name || 'the piece') + '": press it in further.'); return false; }
    strokeStart(); const done = [{ m: bm, old: bm.geometry, neu: res.geometry }]; jobs.slice(1).forEach(j => { const r2 = stampGeometry(THREE, j.geometry, solid, { posed, keep: keep || 'outside', restFix }); if (r2) done.push({ m: j, old: j.geometry, neu: r2.geometry }); });
    let at = 'new'; const apply = () => { done.forEach(d => { d.m.geometry = at === 'new' ? d.neu : d.old; if (d.m.updateMorphTargets) d.m.updateMorphTargets(); }); fig.clear(); if (current) current.repose(); fig.mirrorToShells(bm); };
    apply(); pushUndo({ label: 'stamp', undo: () => { at = 'old'; apply(); }, redo: () => { at = 'new'; apply(); } }); dirty(bm);
    say((keep === 'inside' ? 'Kept only what is inside "' : 'Carved with "') + (name || 'the shape') + '": ' + (res.lining ? res.lining.toLocaleString('en-US') + ' wall faces make the space. ' : 'open hole. ') + 'Undo puts it back.'); return true;
  }
  const voxelInto = (f, tris) => clay.voxelizeField(f, tris);   /* a closed triangle soup into an empty field (Make clay's maths) */

  /* ---------- every XR frame ---------- */
  function frame(hands, dt) {
    if (!cfg.on) return; dt = dt || 0.016; cursor.hands = {}; fig.frameStart(); tick++;
    if (tick % 45 === 0 && !fig.strokes.size && !route.size) targets();   /* pick up objects pulled into the room while the bench is on */
    const sh = steady(hands || []);
    clay.tick(4);   /* clay chunks that changed: to the worker (or meshed here within 4 ms) */
    if (cfg.mode === 'prim') { shapes.frame(sh, dt, cursor); return; }
    shapes.hide();
    if (cfg.mode === 'hold' || (sh.length === 2 && sh.every(h => h.grip))) { hold.frame(sh, dt, cursor); return; }
    if (CURRENT_MODES.has(cfg.mode)) { currentFrame(sh, dt); return; }
    for (const hand of sh) {
      let rt = route.get(hand.id);
      if (hand.pinch && !rt) { rt = decide(hand); route.set(hand.id, rt); if (rt.to === 'mesh') { if (cfg.op === 'intersect') { once('Intersect works on clay and shapes, not on a figure\'s skin (use Carve set to keep inside).'); rt.to = 'none'; } else fig.begin(hand, rt.hit, cfg); } }
      if (!hand.pinch && rt) { if (rt.to === 'mesh') { const s = fig.strokes.get(hand.id); if (s) fig.end(s); } else if (rt.to === 'clay' || rt.to === 'air') clayEnd(rt); route.delete(hand.id); rt = null; }
      let hitNow = false;
      if (rt && rt.to === 'mesh') { const s = fig.strokes.get(hand.id), h = HOLD_BRUSHES.has(s && s.mode) ? null : fig.hitAt(hand.tip, cfg.size); if (s) fig.step(s, hand, h, dt, cfg); hitNow = !!h || HOLD_BRUSHES.has(s && s.mode); }
      else if (rt && (rt.to === 'clay' || rt.to === 'air')) { clayFrame(hand, rt, dt); hitNow = true; }
      else if (!rt) { const ch = clay.hit(hand.tip, cfg.size / 100 * 1.3, true); hitNow = !!ch || (tick % 3 === 0 ? !!fig.hitAt(hand.tip, cfg.size) : false); }
      cursor.hands[hand.id] = { tip: hand.tip, hit: hitNow, radius: cfg.size / 100, mode: cfg.mode };
    }
    for (const [id, rt] of [...route.entries()]) if (!sh.some(h => h.id === id)) { if (rt.to === 'mesh') { const s = fig.strokes.get(id); if (s) fig.end(s); } else clayEnd(rt); route.delete(id); }
  }
  /* the mesh tools: each pinch goes to clay when clay is the nearer thing under the hand, else to the current engine, which draws its own cursor */
  function currentFrame(sh, dt) {
    const toCurrent = [];
    for (const hand of sh) {
      let rt = route.get(hand.id);
      if (hand.pinch && !rt) {
        const reach = Math.max(0.03, cfg.size / 100 * 1.5), ch = clay.works.length ? (clay.hit(hand.tip, reach, true) || clay.nearBox(hand.tip, reach)) : null;   /* a sweep may start in the air beside the clay */
        if (ch && cfg.mode !== 'squeeze') { const mh = fig.hitAt(hand.tip, cfg.size); rt = (!mh || ch.d <= mh.dWorld) ? { to: 'clay', layer: ch.layer } : { to: 'current' }; } else rt = { to: 'current' };
        if (rt.to === 'clay' && (cfg.mode === 'heal' || cfg.mode === 'close' || cfg.mode === 'wrinkle')) { once('Clay has no open edges: it is always closed. Use Smooth or Pinch on clay.'); rt = { to: 'none' }; }
        if (rt.to === 'clay' && cfg.mode === 'stamp') { stampAt(hand); rt = { to: 'none' }; }
        else if (rt.to === 'current' && cfg.mode === 'stamp') { const src = stampSources(); if (src && src.roots.some(r => r.userData && r.userData.clayWork)) { stampAt(hand); rt = { to: 'none' }; } }
        route.set(hand.id, rt);
      }
      if (!hand.pinch && rt) { if (rt.to === 'clay') clayToolEnd(rt, cfg.mode === 'cut' ? (cfg.cutBlade === 'plane' ? 'cut clay' : 'saw clay') : cfg.mode === 'erase' ? 'erase clay' : 'carve clay'); route.delete(hand.id); if (rt.to === 'current') toCurrent.push(hand); continue; }
      if (rt && rt.to === 'clay') { if (cfg.mode === 'cut') clayCut(hand, rt); else if (cfg.mode === 'carve' || cfg.mode === 'erase') clayBall(hand, rt, dt); cursor.hands[hand.id] = { tip: hand.tip, hit: true, radius: Math.max(0.02, cfg.size / 100), mode: cfg.mode === 'cut' ? 'cut' : 'carve', plane: cfg.mode === 'cut' ? hand.dir || null : undefined }; continue; }
      if (rt && rt.to === 'none') { cursor.hands[hand.id] = { tip: hand.tip, hit: false, radius: cfg.size / 100, mode: cfg.mode }; continue; }
      toCurrent.push(hand);
    }
    if (!currentOn && toCurrent.some(h => h.pinch)) { try { syncCurrent(); currentOn = currentEngine().enter(figure); } catch (e) { currentOn = false; } if (!currentOn) { once('This tool needs a figure or an object to work on.'); } }
    if (currentOn && toCurrent.length) { syncCurrent(); viaCurrent(c => c.frame(toCurrent, dt)); Object.assign(cursor.hands, currentEngine().cursor.hands); }
  }

  /* ---------- the menu's calls ---------- */
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const set = {
    mode: m => { if (cfg.mode === 'prim' && m !== 'prim') shapes.applyPending(true); cfg.mode = m; endAll(); if (CURRENT_MODES.has(m) && current) current.set.mode(m); },
    size: v => { cfg.size = clampN(v, 0.3, 30); }, strength: v => { cfg.strength = clampN(v, 5, 100); }, sym: v => { cfg.sym = ['off', 'mirror', 'radial', 'both'].includes(v) ? v : 'off'; },
    cutGoes: v => { cfg.cutGoes = v; }, cutCap: v => { cfg.cutCap = !!v; }, cutBlade: v => { cfg.cutBlade = v === 'plane' ? 'plane' : 'saw'; }, profile: v => { cfg.profile = v; }, thick: v => { cfg.thick = v; }, color: v => { cfg.color = v; },
    carveKeep: v => { cfg.carveKeep = v; }, stampScale: v => { cfg.stampScale = clampN(v, 0.1, 6); }, count: n => { cfg.count = clampN(n | 0, 2, 24); },
    op: v => { cfg.op = ['add', 'subtract', 'paint', 'intersect'].includes(v) ? v : 'add'; endAll(); }, falloff: v => { cfg.falloff = ['smooth', 'linear', 'sharp', 'flat'].includes(v) ? v : 'smooth'; },
    stabilize: v => { cfg.stabilize = clampN(+v || 0, 0, 1); }, blend: v => { cfg.blend = clampN(+v || 0, 0, 1); }, clayProfile: v => { cfg.clayProfile = v === 'flat' ? 'flat' : 'round'; }, dot: v => { cfg.dot = ['ball', 'ring', 'cube', 'spike'].includes(v) ? v : 'ball'; },
    prim: v => { cfg.prim = ['sphere', 'cube', 'cylinder', 'cone', 'torus', 'capsule'].includes(v) ? v : 'sphere'; shapes.setKind(cfg.prim); }, detail: v => { cfg.detail = clampN(+v || 5, 2, 20); }, tint: v => { cfg.tint = ((v | 0) % CLAY_COLORS.length + CLAY_COLORS.length) % CLAY_COLORS.length; },
    holdWhat: v => { cfg.holdWhat = v === 'layer' ? 'layer' : 'work'; }, clayOnFigure: v => { cfg.clayOnFigure = v === 'clay' ? 'clay' : 'skin'; }, budget: v => { cfg.budget = Math.max(0, v | 0); },
  };
  function endAll() {
    for (const [id, rt] of [...route.entries()]) { if (rt.to === 'mesh') { const s = fig.strokes.get(id); if (s) fig.end(s); } else if (rt.to === 'clay' && CURRENT_MODES.has(cfg.mode)) clayToolEnd(rt, 'clay tool'); else if (rt.st) clayEnd(rt); route.delete(id); }
    fig.endAll(); hold.end(); if (current) viaCurrent(c => c.endAll());
  }
  function undo() { if (route.size || fig.strokes.size) return false; const c = undoS.pop(); if (!c) return false; c.undo(); redoS.push(c); dirty(); say('Undid ' + c.label + '.'); return true; }
  function redo() { if (route.size || fig.strokes.size) return false; const c = redoS.pop(); if (!c) return false; c.redo(); undoS.push(c); dirty(); say('Redid ' + c.label + '.'); return true; }
  function cutAt(hand) { if (clay.works.length) { const ch = clay.hit(hand.tip, 0.25, true); if (ch) { const rt = { to: 'clay', layer: ch.layer }; const was = cfg.cutBlade; clayCut(hand, rt); clayToolEnd(rt, was === 'plane' ? 'cut clay' : 'saw clay'); return true; } } syncCurrent(); if (!currentOn) { try { currentOn = currentEngine().enter(figure); } catch (e) { return false; } } return viaCurrent(c => c.cutAt(hand)); }
  const squeezed = () => (current ? current.squeezed() : []).concat(clay.works.filter(w => w.group.parent && w.layers.length).map(w => ({ id: w.id, name: w.name, object: w.group, kind: 'clay' })));
  async function save(name, opts) {
    opts = opts || {}; clay.flush();
    if (!figure && !(opts.roots && opts.roots.length)) { const w = clay.works.filter(x => x.group.parent); if (!w.length) throw new Error('Nothing to save.'); opts = Object.assign({}, opts, { roots: w.map(x => x.group) }); }
    return exporter.save(name, Object.assign({ figure, budget: cfg.budget, sources: host.sources, exportGlb: host.exportGlb }, opts));
  }
  async function exportGlb(roots, opts) { clay.flush(); return exporter.glb(roots && roots.length ? roots : clay.works.filter(w => w.group.parent).map(w => w.group), Object.assign({ budget: cfg.budget }, opts || {})); }

  const vs = {
    cfg, set, enter, leave, frame, undo, redo, strokes: () => undoS.length, canUndo: () => undoS.length > 0, canRedo: () => redoS.length > 0,
    newKey: () => { targets(); return fig.newKey(); }, keys: () => { targets(); return fig.keys(); }, setKey: (n, v) => { targets(); fig.setKey(n, v); if (current) current.repose(); }, save, cursor,
    entryOf: m => fig.entryOf(m), nearest: (en, p, r) => fig.nearest(en, p, r), endAll, cutAt, stampAt,
    repose: () => { fig.clear(); targets(); if (current) current.repose(); }, setFilter: f => { meshFilter = f || null; fig.clear(); targets(); if (current) current.setFilter(f); }, filtered: () => !!meshFilter,
    targetNames: () => targets().map(m => m.name), hasEntry: m => fig.hasEntry(m) || !!(current && current.hasEntry && current.hasEntry(m)), squeezed, get colors() { return current ? current.colors : [0xe8c9a0]; },
    /* new in the next engine */
    engine: ENGINE, version: ENGINE_VERSION, clay, shapes, hold, exportGlb, flush: () => clay.flush(), stats: () => Object.assign(clay.stats(), { undo: undoS.length, redo: redoS.length, targets: targetsCache.length }),
    makeClay: mesh => clay.fromMesh(mesh),   /* a layer, or a Promise of one when the worker voxelizes */ decimate: (g, n) => exporter.decimate(g, n),
    icons: ICONS, lessons: LESSONS, tiles: TILES, colors3: CLAY_COLORS, pickedObject: () => { const s = stampSources(); return s ? s.roots[0] : null; },
  };
  vs.menu = makeMenu(vs, { say });
  vs.menuTitle = pg => vs.menu.title(pg);
  return vs;
}
