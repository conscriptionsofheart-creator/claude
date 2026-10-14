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
import { makeMotion } from './sculpt_next_motion.js';
import { buildEmblem } from './sculpt_next_emblem.js';
import { rodGeometry } from './sculpt_next_rod.js';
import { createField, opShape, opIntersectField } from './sculpt_next_sdf.js';   /* the synchronous forms, for one-off pinches (stamp) */
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
    supportSmooth: true,  /* while one hand sculpts, a pinch with the OTHER hand smooths (Substance keeps Smooth one hold away) */
    haptics: true,        /* a soft tick in the controller for each dab (cursor.hands[id].pulse, 0..1, the page plays it) */
    finish: 'satin',      /* the picked clay layer's surface: matte | satin | gloss | metal | glow */
    pulseDur: 0.6, pulseRepeat: 1,   /* expressions: how long one pulse takes (s), how many times it plays */
    rodTwist: 180, rodEnd: 'taper',   /* Rod: how far it twists from one end to the other (degrees); its far end tapered to a point or blunt */
  };
  const undoS = [], redoS = [];
  function pushUndo(e) { undoS.push(e); redoS.length = 0; if (undoS.length > 100) undoS.shift(); }
  const cursor = { hands: {} }, cfgRoot = cfg;
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
  const assets = [];   /* objects this engine made that are not clay: rods, the emblem ({ id, name, object, kind }) */
  const assetMeshes = () => { const out = []; assets.forEach(a => { if (a.object.parent) a.object.traverse(o => { if (o.isMesh && o.geometry && !/^vr/.test(o.name || '')) out.push(o); }); }); return out; };
  let targetsCache = [];
  function targets() { const all = (asset ? [] : collect(figure)).concat(propMeshes()); tubeMeshes().concat(assetMeshes()).forEach(m => { if (!all.includes(m)) all.push(m); }); const ok = all.filter(m => !(m.userData && m.userData.figLocked)); targetsCache = meshFilter ? ok.filter(meshFilter) : ok; return targetsCache; }

  const LINEAR = parseInt(THREE.REVISION, 10) >= 152 && !(THREE.ColorManagement && THREE.ColorManagement.enabled === false);
  const paintRGB = () => CLAY_COLORS[cfg.tint % CLAY_COLORS.length].map(v => { const c = v / 255; return LINEAR ? (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)) : c; });   /* vertex paint on a figure: the same screen colour on either three */
  Object.defineProperty(cfg, 'paintRGB', { get: paintRGB, enumerable: false });
  const fig = makeFigureBrushes(THREE, core, { say, cfg, figure: () => figure, targets: () => targetsCache, pushUndo, dirty, strokeStart, afterEdit: () => { if (current) current.repose(); } });
  const clay = makeClay(THREE, { say, pushUndo, dirty, addObject: o => { try { host.addObject ? host.addObject(o) : null; } catch (e) { /* the host's */ } }, removeObject: o => { try { host.removeObject ? host.removeObject(o) : (o.parent && o.parent.remove(o)); } catch (e) { /* gone */ } }, detail: () => cfg.detail / 1000, color: () => CLAY_COLORS[cfg.tint % CLAY_COLORS.length], noWorker: host.noWorker });
  const exporter = makeExport(THREE, { say, clay });
  const shapes = makeShapes(THREE, { say, cfg, clay, pushUndo, dirty, strokeStart, figure: () => figure, addHelper: o => { try { host.addObject ? host.addObject(o) : null; } catch (e) { /* host */ } }, removeHelper: o => { try { if (o.parent) o.parent.remove(o); } catch (e) { /* gone */ } }, stampMesh: (m, solid, keep) => stampMesh(m, solid, keep), meshNear: (p, r) => meshNear(p, r), color: () => CLAY_COLORS[cfg.tint % CLAY_COLORS.length] });
  const motion = makeMotion(THREE, { say, targets: () => targetsCache, onChange: (m, light) => { fig.mirrorToShells(m); if (!light) { fig.clear(); if (current) current.repose(); } } });
  let asset = null; const lastTip = new V3(0, 1.3, -0.6);   /* the story-asset bench: { figVisible } while you make an object apart from the figure */
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
  function leave() { endAll(); endAsset(true); shapes.applyPending(false); try { if (current && current.cfg.on) current.leave(); } catch (e) { /* fine */ } try { host.setBench && host.setBench(false); } catch (e) { /* the bench is the host's */ } cfg.on = false; entered = false; cursor.hands = {}; shapes.hide(); clay.flush(); }

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
  /* the settings one stroke keeps from its first frame to its last (a menu tap mid-stroke cannot tear it), with the hand's own twists:
     the OTHER hand while one hand sculpts smooths (cfg.supportSmooth); hand.alt (a button the page maps) or hand.palmUp (a tracked hand turned palm up) swaps to the partner: add <-> subtract */
  function strokeCfg(hand) {
    const c = Object.assign({}, cfg); Object.defineProperty(c, 'paintRGB', { get: paintRGB, enumerable: false });
    const busy = [...route.entries()].some(([id, r]) => id !== hand.id && (r.st || r.to === 'mesh'));
    if (busy && cfg.supportSmooth && BRUSHES.has(cfg.mode)) { c.mode = 'smooth'; c.op = 'add'; c.support = true; return c; }
    if (hand.alt || hand.palmUp) { c.op = ({ add: 'subtract', subtract: 'add', intersect: 'subtract', paint: 'add' })[cfg.op]; if (cfg.mode === 'inflate') c.op = cfg.op === 'subtract' ? 'add' : 'subtract'; c.swapped = true; }
    return c;
  }
  function decide(hand) {
    targets();   /* things made since the last look (a tube just squeezed, a prop just pulled in) are brushable at once */
    const c = strokeCfg(hand), r = c.size / 100, ch = clay.hit(hand.tip, r * 1.3 + 0.01, true), mh = (c.mode === 'clay' && c.clayOnFigure === 'clay') ? null : fig.hitAt(hand.tip, c.size);
    if (ch && (!mh || ch.d <= mh.dWorld)) return { to: 'clay', layer: ch.layer, c };
    if (mh) return { to: 'mesh', hit: mh, c };
    return { to: c.mode === 'clay' || c.mode === 'dots' && c.op !== 'paint' ? 'air' : 'none', c };
  }

  /* ---------- the clay side of a brush ---------- */
  function clayOpts(hand, prevTip, c) {
    c = c || cfg; return { mode: c.mode, op: c.op, radius: c.size / 100, strength: c.strength / 100, falloff: c.falloff, sym: c.sym, count: c.count, color: CLAY_COLORS[c.tint % CLAY_COLORS.length], blend: c.blend, profile: c.clayProfile, dot: c.dot, press: hand.press != null ? 0.25 + 0.75 * Math.max(0, Math.min(1, hand.press)) : 1, dirW: hand.dir || null, deltaW: prevTip ? hand.tip.clone().sub(prevTip) : null };
  }
  function clayFrame(hand, rt, dt) {
    const cfg = rt.c || cfgRoot, r = cfg.size / 100;   /* this stroke's own settings */
    if (!rt.st) {
      let L = rt.layer;
      if (!L && clay.active && clay.live(clay.active) && clay.active.group.visible) L = clay.active;   /* a stroke that starts in the air works on the picked layer (a subtract or intersect stroke drawn in from outside) */
      if (!L) { if (cfg.op === 'subtract' || cfg.op === 'paint' || cfg.op === 'intersect') { once(cfg.op === 'paint' ? 'Paint needs clay or a figure under the brush.' : 'There is no clay here to ' + cfg.op + ': switch the mode to add to build some.'); return; } L = clay.ensureLayer(hand.tip, figure); if (!L) return; }
      if (L.locked) { once(L.name + ' is locked: unlock it on the Layers page.'); return; }
      strokeStart(); rt.st = clay.strokeBegin(L, { mode: cfg.mode, op: cfg.op }); rt.last = hand.tip.clone(); rt.prevTip = hand.tip.clone(); rt.t = 1; rt.travel = 0;
      if (!HOLD_BRUSHES.has(cfg.mode)) { clay.strokeStep(rt.st, hand.tip, hand.tip, clayOpts(hand, null, cfg)); rt.pulse = 0.3 + 0.4 * cfg.strength / 100;; }
      return;
    }
    rt.t += dt; const moved = hand.tip.distanceTo(rt.last), spacing = cfg.mode === 'dots' ? r * 1.4 : Math.max(clay.S.active ? clay.S.active.field.h * 0.8 : 0.004, r * 0.25);
    if (clay.backlog() > 12) return;   /* earlier dabs are still being sliced in (a big brush on fine clay, many symmetry copies): wait. Nothing is lost: the next dab joins the last point to this one. */
    const cost = () => {};
    if (HOLD_BRUSHES.has(cfg.mode)) { if (hand.tip.distanceTo(rt.prevTip) > 1e-4) { clay.strokeStep(rt.st, hand.tip, rt.prevTip, clayOpts(hand, rt.prevTip, cfg)); rt.prevTip = hand.tip.clone(); cost(); rt.pulse = 0.15 + 0.25 * cfg.strength / 100; } return; }
    if (moved >= spacing || (cfg.mode !== 'dots' && cfg.mode !== 'clay' && rt.t > 0.05)) { clay.strokeStep(rt.st, hand.tip, cfg.mode === 'clay' ? rt.last : hand.tip, clayOpts(hand, rt.last, cfg)); rt.last = hand.tip.clone(); rt.t = 0; cost(); rt.pulse = 0.2 + 0.4 * cfg.strength / 100; }
  }
  function clayEnd(rt) { const m = (rt.c || cfg).mode; if (rt.st) clay.strokeEnd(rt.st, ({ clay: 'clay', dots: 'dots' })[m] || m); rt.st = null; }

  /* ---------- clay versions of the mesh tools: saw, plane cut, carve, erase, stamp ---------- */
  function clayCut(hand, rt) {
    if (!hand.dir) { once('The cut needs the direction your hand points.'); return; }
    const L = rt.layer; if (!rt.st) { strokeStart(); rt.st = clay.strokeBegin(L, { mode: 'cut', op: 'subtract' }); rt.n = 0; }
    if (cfg.cutBlade === 'plane') {   /* the whole side the hand points to goes (or the other side): queued, applied as the pinch ends */
      if (rt.done) return; rt.done = true; const q = new Q().setFromUnitVectors(new V3(0, 1, 0), hand.dir.clone().normalize()), Mi = new M4().compose(hand.tip, q, new V3(1, 1, 1)).invert(), toL = new M4().copy(Mi).multiply(L.group.matrixWorld), e = toL.elements, sc = clay.scaleOf(L.group), sign = cfg.cutGoes === 'front' ? 1 : -1;
      clay.halfStep(rt.st, (x, y, z) => sign * (e[1] * x + e[5] * y + e[9] * z + e[13]) / sc); rt.n = 1; return;   /* height above the plane (world metres) in the layer's own units */
    }
    const R = Math.max(0.005, cfg.size / 100), kerf = Math.max(0.004, Math.min(0.012, R * 0.2));   /* the saw: a slab as wide as the Size ring and a few mm thick, swept with the hand; one undo for the sweep */
    if (rt.last && hand.tip.distanceTo(rt.last) < Math.max(0.004, R * 0.25)) return; if (clay.backlog() > 12) return;
    const qs = new Q().setFromUnitVectors(new V3(0, 0, 1), hand.dir.clone().normalize()), M = new M4().compose(hand.tip, qs, new V3(R, R, kerf / 2));
    clay.shapeStep(rt.st, 'cube', M, 'subtract', 0, cfg.sym, cfg.count, false); rt.last = hand.tip.clone(); rt.n++;
  }
  function clayBall(hand, rt, dt) {   /* Carve and Erase on clay: a ball that takes clay away as it sweeps; Carve set to keep inside keeps only what the sweep covered */
    const L = rt.layer, R = cfg.size / 100; rt.t = (rt.t || 1) + dt; if (rt.last && hand.tip.distanceTo(rt.last) < R * 0.3 && rt.t < 0.12) return; if (clay.backlog() > 12) return; rt.t = 0;
    if (!rt.st) { strokeStart(); rt.st = clay.strokeBegin(L, { mode: cfg.mode, op: 'subtract' }); rt.n = 0; }
    const M = new M4().compose(hand.tip, new Q(), new V3(R, R, R)), keep = cfg.mode === 'carve' && cfg.carveKeep === 'inside';
    clay.shapeStep(rt.st, 'sphere', M, 'subtract', keep ? 0 : cfg.blend * R * 0.3, cfg.sym, cfg.count, keep); rt.last = hand.tip.clone(); rt.n++;
  }
  function clayToolEnd(rt, label) {
    if (!rt.st) return; const L = rt.layer, n = rt.n || 1; clay.strokeEnd(rt.st, label); rt.st = null; dirty(L.work.group);
    say((label === 'saw clay' ? 'Sawed through ' : label === 'erase clay' ? 'Erased from ' : label === 'cut clay' ? 'Cut ' : 'Carved ') + L.name + (label === 'cut clay' ? ' along the plane' : ' (' + n + ' pass' + (n === 1 ? '' : 'es') + ')') + '. Undo puts it back.');
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
    if (!cfg.on) return; dt = dt || 0.016; cursor.hands = {}; fig.frameStart(); tick++; motion.tick(dt);   /* expressions play while you sculpt */
    if (tick % 45 === 0 && !fig.strokes.size && !route.size) targets();   /* pick up objects pulled into the room while the bench is on */
    const sh = steady(hands || []); if (sh[0]) lastTip.copy(sh[0].tip);
    clay.tick(4);   /* clay chunks that changed: to the worker (or meshed here within 4 ms) */
    if (cfg.mode === 'prim') { shapes.frame(sh, dt, cursor); return; }
    if (cfg.mode === 'rod') { sh.forEach(h => { rodFrame(h); cursor.hands[h.id] = { tip: h.tip, hit: false, radius: cfg.size / 100, mode: 'rod' }; }); for (const [id, st] of [...rods.entries()]) if (!sh.some(h => h.id === id)) { rods.delete(id); rodEnd(st); } return; }
    shapes.hide();
    if (cfg.mode === 'hold' || (sh.length === 2 && sh.every(h => h.grip))) { hold.frame(sh, dt, cursor); return; }
    if (CURRENT_MODES.has(cfg.mode)) { currentFrame(sh, dt); return; }
    for (const hand of sh) {
      let rt = route.get(hand.id);
      if (hand.pinch && !rt) { rt = decide(hand); route.set(hand.id, rt); if (rt.c.support) once('Your other hand smooths while this one sculpts.', 6000); if (rt.to === 'mesh') { if (rt.c.op === 'intersect') { once('Intersect works on clay and shapes, not on a figure\'s skin (use Carve set to keep inside).'); rt.to = 'none'; } else fig.begin(hand, rt.hit, rt.c); } }
      if (!hand.pinch && rt) { if (rt.to === 'mesh') { const s = fig.strokes.get(hand.id); if (s) fig.end(s); } else if (rt.to === 'clay' || rt.to === 'air') clayEnd(rt); route.delete(hand.id); rt = null; }
      let hitNow = false;
      if (rt && rt.to === 'mesh') { const s = fig.strokes.get(hand.id), h = HOLD_BRUSHES.has(s && s.mode) ? null : fig.hitAt(hand.tip, rt.c.size); if (s && fig.step(s, hand, h, dt, rt.c)) rt.pulse = 0.2 + 0.4 * rt.c.strength / 100; hitNow = !!h || HOLD_BRUSHES.has(s && s.mode); }
      else if (rt && (rt.to === 'clay' || rt.to === 'air')) { clayFrame(hand, rt, dt); hitNow = true; }
      else if (!rt) { const ch = clay.hit(hand.tip, cfg.size / 100 * 1.3, true); hitNow = !!ch || (tick % 3 === 0 ? !!fig.hitAt(hand.tip, cfg.size) : false); }
      const rc = rt && rt.c || cfg; cursor.hands[hand.id] = { tip: hand.tip, hit: hitNow, radius: rc.size / 100, mode: rc.mode, op: rc.op, pulse: cfg.haptics && rt && rt.pulse ? rt.pulse : 0 }; if (rt) rt.pulse = 0;
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

  /* ---------- the story-asset bench (Ruth 2026-10-13: "create assets for the story also, separate from the bodies"): the figure steps aside, the next clay starts a NEW work of its own,
     and Save clay puts it in the library as its own object, ready for any scene. ---------- */
  function newAsset() {
    endAll(); if (!asset) { asset = { figVisible: figure ? figure.visible : true }; if (figure) figure.visible = false; targets(); }
    clay.S.forceNew = true; if (cfg.mode !== 'clay' && cfg.mode !== 'prim') cfg.mode = 'clay';
    say('New asset: the figure steps aside. Pinch in the air to start it; Save clay keeps it as its own object in the library.'); return true;
  }
  function endAsset(quiet) { if (!asset) return false; if (figure) figure.visible = asset.figVisible; asset = null; clay.S.forceNew = false; targets(); if (!quiet) say('Back to the figure.'); return true; }

  /* ---------- Ruth's emblem (sculpt_next_emblem.js): built as clay, a layer per part, a few ms a frame; it spins slowly when it is done. One undo takes it away. ---------- */
  function makeEmblem(opts) {
    opts = opts || {}; let at = opts.at;
    if (!at) { at = lastTip.clone(); if (figure) { const b = new THREE.Box3().setFromObject(figure); if (!b.isEmpty()) { const c = b.getCenter(new V3()); at = new V3(c.x + (b.max.x - b.min.x) / 2 + 0.45, c.y + 0.25, c.z); } } }
    const g = buildEmblem(THREE, { height: opts.height || 0.42 }); g.position.copy(at); g.userData.noMerge = true; g.updateMatrixWorld(true);
    const ent = { id: 'emblem' + (assets.length + 1), name: 'Emblem', object: g, kind: 'emblem' };
    const put = () => { try { host.addObject ? host.addObject(g) : null; } catch (e) { /* the host's */ } if (!assets.includes(ent)) assets.push(ent); if (opts.spin !== false) motion.spin(g, opts.turn || 10); targets(); };
    const take = () => { motion.stopSpin(g); try { host.removeObject ? host.removeObject(g) : (g.parent && g.parent.remove(g)); } catch (e) { /* gone */ } const i = assets.indexOf(ent); if (i >= 0) assets.splice(i, 1); targets(); };
    put(); pushUndo({ label: 'emblem', undo: take, redo: put }); dirty(g);
    say('Your emblem is here: two rods, each twisted, bent and tapered, and two heads, turning slowly. Brush it, Hold it, pick it as a stamp, or Save object to keep it.');
    return { object: g, entry: ent, ready: () => true };
  }

  /* ---------- Rod (Ruth 2026-10-14: "take a rectangular rod, twist it, and then bend it, and then stretch the end of it and taper it off"): pinch and draw; a solid rectangular rod follows the path,
     twisted by the Twist setting, its end drawn out and tapered (or blunt). Size sets its width (it is 0.55 as thick), the colour runs from the Colour tile's colour into the next one. One undo per rod. ---------- */
  const rods = new Map();
  const rodOpts = (len, c) => { const w = c.size / 100 * 2, A = CLAY_COLORS[c.tint % CLAY_COLORS.length], Bc = CLAY_COLORS[(c.tint + 1) % CLAY_COLORS.length], hx = v => '#' + v.map(x => Math.round(x).toString(16).padStart(2, '0')).join(''), dark = v => v.map(x => x * 0.55);
    return { width: w, thick: w * 0.55, twist: [[0, 0], [1, c.rodTwist]], taper: c.rodEnd === 'taper' ? [[0, 0.35], [0.12, 1], [0.6, 1], [1, 0.02]] : [[0, 1], [1, 1]], taperThick: c.rodEnd === 'taper' ? [[0, 0.5], [0.15, 1], [0.7, 1], [1, 0.1]] : [[0, 1], [1, 1]], stretch: c.rodEnd === 'taper' ? 0.15 : 0,
      front: [[0, hx(A)], [1, hx(Bc)]], back: [[0, hx(dark(A))], [1, hx(dark(Bc))]], slices: Math.max(24, Math.min(320, Math.round(len * 400))), around: 32 }; };
  function rodFrame(hand) {
    let st = rods.get(hand.id);
    if (hand.pinch) {
      if (!st) { const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.04 })); mesh.name = 'Rod ' + (assets.filter(a => a.kind === 'rod').length + 1); mesh.userData.noMerge = true; try { host.addObject ? host.addObject(mesh) : null; } catch (e) { /* host */ } st = { pts: [hand.tip.clone()], mesh, c: Object.assign({}, cfg), n: 0 }; rods.set(hand.id, st); strokeStart(); }
      const last = st.pts[st.pts.length - 1]; if (hand.tip.distanceTo(last) >= 0.008) { st.pts.push(hand.tip.clone()); if (++st.n % 2 === 0) rodBuild(st, false); }
    } else if (st) { rods.delete(hand.id); rodEnd(st); }
  }
  function rodBuild(st, final) {
    if (st.pts.length < 2) return; let len = 0; for (let i = 1; i < st.pts.length; i++) len += st.pts[i].distanceTo(st.pts[i - 1]);
    const o = rodOpts(len, st.c); if (!final) { o.slices = Math.min(o.slices, 120); o.around = 20; }
    const pts = st.pts.length > 40 ? st.pts.filter((_, i) => i % Math.ceil(st.pts.length / 40) === 0 || i === st.pts.length - 1) : st.pts;
    const g = rodGeometry(THREE, pts.map(p => [p.x, p.y, p.z]), o); if (st.mesh.geometry) st.mesh.geometry.dispose(); st.mesh.geometry = g;
  }
  function rodEnd(st) {
    if (st.pts.length < 3) { try { host.removeObject ? host.removeObject(st.mesh) : (st.mesh.parent && st.mesh.parent.remove(st.mesh)); } catch (e) { /* gone */ } once('Draw a longer line for a rod.'); return; }
    rodBuild(st, true); const ent = { id: 'rod' + Date.now(), name: st.mesh.name, object: st.mesh, kind: 'rod' }; assets.push(ent); targets();
    const take = () => { try { host.removeObject ? host.removeObject(st.mesh) : (st.mesh.parent && st.mesh.parent.remove(st.mesh)); } catch (e) { /* gone */ } const i = assets.indexOf(ent); if (i >= 0) assets.splice(i, 1); targets(); };
    const put = () => { try { host.addObject ? host.addObject(st.mesh) : null; } catch (e) { /* host */ } if (!assets.includes(ent)) assets.push(ent); targets(); };
    pushUndo({ label: 'rod', undo: take, redo: put }); dirty(st.mesh); say(st.mesh.name + ': twisted ' + st.c.rodTwist + ' degrees, ' + (st.c.rodEnd === 'taper' ? 'tapered to a point' : 'blunt') + '. Brush it, Hold it, or pick it as a stamp.');
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
    holdWhat: v => { cfg.holdWhat = v === 'layer' ? 'layer' : 'work'; }, rodTwist: v => { cfg.rodTwist = clampN(+v || 0, -720, 720); }, rodEnd: v => { cfg.rodEnd = v === 'blunt' ? 'blunt' : 'taper'; }, supportSmooth: v => { cfg.supportSmooth = !!v; }, haptics: v => { cfg.haptics = !!v; },
    finish: v => { cfg.finish = ['matte', 'satin', 'gloss', 'metal', 'glow'].includes(v) ? v : 'satin'; if (clay.active) clay.setFinish(clay.active, cfg.finish); }, pulseDur: v => { cfg.pulseDur = clampN(+v || 0.6, 0.2, 4); }, pulseRepeat: v => { cfg.pulseRepeat = clampN(v | 0, 1, 10); }, clayOnFigure: v => { cfg.clayOnFigure = v === 'clay' ? 'clay' : 'skin'; }, budget: v => { cfg.budget = Math.max(0, v | 0); },
  };
  function endAll() {
    for (const [id, rt] of [...route.entries()]) { if (rt.to === 'mesh') { const s = fig.strokes.get(id); if (s) fig.end(s); } else if (rt.to === 'clay' && CURRENT_MODES.has(cfg.mode)) clayToolEnd(rt, 'clay tool'); else if (rt.st) clayEnd(rt); route.delete(id); }
    for (const [id, st] of [...rods.entries()]) { rods.delete(id); rodEnd(st); }
    fig.endAll(); hold.end(); if (current) viaCurrent(c => c.endAll());
  }
  function undo() { if (route.size || fig.strokes.size) return false; clay.drainQueue(); const c = undoS.pop(); if (!c) return false; c.undo(); redoS.push(c); dirty(); say('Undid ' + c.label + '.'); return true; }
  function redo() { if (route.size || fig.strokes.size) return false; clay.drainQueue(); const c = redoS.pop(); if (!c) return false; c.redo(); undoS.push(c); dirty(); say('Redid ' + c.label + '.'); return true; }
  function cutAt(hand) { if (clay.works.length) { const ch = clay.hit(hand.tip, 0.25, true); if (ch) { const rt = { to: 'clay', layer: ch.layer }; const was = cfg.cutBlade; clayCut(hand, rt); clayToolEnd(rt, was === 'plane' ? 'cut clay' : 'saw clay'); clay.drainQueue(); return true; } } syncCurrent(); if (!currentOn) { try { currentOn = currentEngine().enter(figure); } catch (e) { return false; } } return viaCurrent(c => c.cutAt(hand)); }
  const squeezed = () => (current ? current.squeezed() : []).concat(assets.filter(a => a.object.parent)).concat(clay.works.filter(w => w.group.parent && w.layers.length).map(w => ({ id: w.id, name: w.name, object: w.group, kind: 'clay' })));
  async function save(name, opts) { return motion.atRest(() => saveNow(name, opts)); }   /* a turning work is saved as it rests */
  async function saveNow(name, opts) {
    opts = opts || {}; clay.flush();
    if (!figure && !(opts.roots && opts.roots.length)) { const w = clay.works.filter(x => x.group.parent); if (!w.length) throw new Error('Nothing to save.'); opts = Object.assign({}, opts, { roots: w.map(x => x.group) }); }
    return exporter.save(name, Object.assign({ figure, budget: cfg.budget, sources: host.sources, exportGlb: host.exportGlb }, opts));
  }
  async function exportGlb(roots, opts) { clay.flush(); return motion.atRest(() => exporter.glb(roots && roots.length ? roots : clay.works.filter(w => w.group.parent).map(w => w.group), Object.assign({ budget: cfg.budget }, opts || {}))); }

  const vs = {
    cfg, set, enter, leave, frame, undo, redo, strokes: () => undoS.length, canUndo: () => undoS.length > 0, canRedo: () => redoS.length > 0,
    newKey: () => { targets(); return fig.newKey(); }, keys: () => { targets(); return fig.keys(); }, setKey: (n, v) => { targets(); fig.setKey(n, v); if (current) current.repose(); }, save, cursor,
    entryOf: m => fig.entryOf(m), nearest: (en, p, r) => fig.nearest(en, p, r), endAll, cutAt, stampAt,
    repose: () => { fig.clear(); targets(); if (current) current.repose(); }, setFilter: f => { meshFilter = f || null; fig.clear(); targets(); if (current) current.setFilter(f); }, filtered: () => !!meshFilter,
    targetNames: () => targets().map(m => m.name), hasEntry: m => fig.hasEntry(m) || !!(current && current.hasEntry && current.hasEntry(m)), squeezed, get colors() { return current ? current.colors : [0xe8c9a0]; },
    /* new in the next engine */
    engine: ENGINE, version: ENGINE_VERSION, clay, shapes, hold, exportGlb, flush: () => clay.flush(), stats: () => Object.assign(clay.stats(), { undo: undoS.length, redo: redoS.length, targets: targetsCache.length }),
    makeClay: mesh => clay.fromMesh(mesh),   /* a layer, or a Promise of one when the worker voxelizes */ decimate: (g, n) => exporter.decimate(g, n),
    motion, pulse: (name, o) => { targets(); return motion.pulse(name, Object.assign({ dur: cfg.pulseDur, repeat: cfg.pulseRepeat }, o || {})); },
    recordMotion: () => { targets(); motion.record(); }, stopMotion: name => { const clip = motion.stop(figure, name); if (clip && figure) { const list = figure.animations; pushUndo({ label: 'expression move', undo: () => { const i = list.indexOf(clip); if (i >= 0) list.splice(i, 1); }, redo: () => { if (!list.includes(clip)) list.push(clip); } }); dirty(figure); } return clip; },
    idle: dt => { if (!cfg.on) motion.tick(dt || 0.016); },   /* the page calls this every frame while Sculpt is closed, so a work keeps spinning in the room */
    assets: () => assets.filter(a => a.object.parent), makeEmblem, spin: (obj, T) => { obj = obj || (clay.active && clay.active.work.group); if (!obj) return false; if (T) motion.spin(obj, T); else motion.stopSpin(obj); dirty(obj); return true; },
    playMotion: clip => motion.play(figure, clip || (figure && figure.animations && figure.animations[figure.animations.length - 1])), newAsset, endAsset, get assetBench() { return !!asset; },
    icons: ICONS, lessons: LESSONS, tiles: TILES, colors3: CLAY_COLORS, pickedObject: () => { const s = stampSources(); return s ? s.roots[0] : null; },
  };
  vs.menu = makeMenu(vs, { say });
  vs.menuTitle = pg => vs.menu.title(pg);
  return vs;
}
