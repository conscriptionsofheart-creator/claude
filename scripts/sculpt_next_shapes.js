/* sculpt_next_shapes.js: primitive SHAPES with a gizmo you work with your hands, and HOLD (Substance's two-hand grab) (Ruth 2026-10-13).
   Shapes: pick a shape (sphere, cube, cylinder, cone, torus, capsule), pinch in the air and a see-through shape sits at your fingertip. Then:
     pinch inside it and move: it follows your hand (place and turn);  pinch one of its six knobs: that side stretches;  pinch it with both hands: pull apart or together to resize, turn the pair to turn it.
     Apply shape (or pick another tool) puts it in: ADD makes clay, SUBTRACT carves it out of the clay or the piece under it, INTERSECT keeps only what is inside it, PAINT colours what it covers.
     A shape pressed into a figure or object with Subtract or Intersect cuts that piece (bst_cut.js), skin and keys carried. Mirror and 360 make the copies.
   Hold: one hand pinched moves and turns the work; two hands move, turn and resize it about the middle of your hands. Figures are moved with Pose > Move, not here. */
import { PRIMS } from './sculpt_next_sdf.js';

const OP_TINT = { add: 0xe8c9a0, subtract: 0xd9776a, intersect: 0x8fb8d9, paint: 0xf2d56b };

export function makeShapes(THREE, env) {
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion, say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } };
  const S = { live: null, kind: 'sphere', ghost: null, knobs: [], preview: null, grab: null, two: null, hands: new Map(), helperOn: false };

  /* unit shapes that match sculpt_next_sdf.js sdPrim (each fills about a unit ball) */
  function unitGeometry(kind) {
    if (kind === 'cube') return new THREE.BoxGeometry(2, 2, 2, 2, 2, 2);
    if (kind === 'cylinder') return new THREE.CylinderGeometry(1, 1, 2, 32, 1);
    if (kind === 'cone') return new THREE.ConeGeometry(1, 2, 32, 1);
    if (kind === 'torus') { const g = new THREE.TorusGeometry(0.7, 0.3, 16, 40); g.rotateX(Math.PI / 2); return g; }
    if (kind === 'capsule') { const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * 0.5, -0.5 + Math.sin(a) * 0.5)); } for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5)); } pts[0].x = 0; pts[pts.length - 1].x = 0; return new THREE.LatheGeometry(pts, 32); }
    return new THREE.SphereGeometry(1, 32, 16);
  }
  function material(op) { return new THREE.MeshBasicMaterial({ color: OP_TINT[op] || OP_TINT.add, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }); }
  function makeGhost(kind, op) {
    const g = new THREE.Group(); g.name = 'vrSculptShape'; g.userData.noMerge = true; const m = new THREE.Mesh(unitGeometry(kind), material(op)); m.name = 'vrSculptShapeBody'; m.renderOrder = 44; g.add(m);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: 0.8 })); edges.name = 'vrSculptShapeEdges'; edges.renderOrder = 45; g.add(edges);
    return g;
  }
  function knobs(group) {   /* six small balls on the faces: pinch one to stretch that side. They stay the same size in the room whatever the shape's size. */
    const out = []; const geo = new THREE.SphereGeometry(1, 12, 8), mat = new THREE.MeshBasicMaterial({ color: 0xffb35a, transparent: true, opacity: 0.85, depthTest: false });
    [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(a => { const k = new THREE.Mesh(geo, mat); k.name = 'vrSculptKnob'; k.renderOrder = 46; k.userData.axis = new V3(...a); group.add(k); out.push(k); });
    return out;
  }
  function placeKnobs() { if (!S.live) return; const g = S.live.group; g.updateMatrixWorld(true); const s = new V3(); g.matrixWorld.decompose(new V3(), new Q(), s); S.knobs.forEach(k => { const a = k.userData.axis; k.position.set(a.x * 1.08, a.y * 1.08, a.z * 1.08); k.scale.set(0.012 / Math.abs(s.x || 1), 0.012 / Math.abs(s.y || 1), 0.012 / Math.abs(s.z || 1)); }); }
  function hide() { if (S.preview) S.preview.visible = false; }
  function setKind(kind) { S.kind = PRIMS.includes(kind) ? kind : 'sphere'; if (S.preview) { env.removeHelper(S.preview); S.preview = null; } if (S.live) { const g = S.live.group, body = g.children[0], ed = g.children[1]; body.geometry.dispose(); body.geometry = unitGeometry(S.kind); ed.geometry.dispose(); ed.geometry = new THREE.EdgesGeometry(body.geometry, 30); S.live.kind = S.kind; } }
  function tint() { const op = env.cfg.op; if (S.live) S.live.group.children[0].material.color.setHex(OP_TINT[op] || OP_TINT.add); if (S.preview) S.preview.children[0].material.color.setHex(OP_TINT[op] || OP_TINT.add); }
  function create(at, r, quiet) {
    const g = makeGhost(S.kind, env.cfg.op); g.position.copy(at); g.scale.setScalar(r); env.addHelper(g); S.knobs = knobs(g); S.live = { kind: S.kind, group: g }; placeKnobs();
    if (!quiet) say('A ' + S.kind + ' at your fingertip. Pinch inside it to move it, a knob to stretch a side, both hands to resize and turn. Apply shape puts it in.');
  }
  function drop() { if (!S.live) return; env.removeHelper(S.live.group); S.live = null; S.knobs = []; S.grab = null; S.two = null; }
  /* put the live shape in (or throw it away when ok is false) */
  function applyPending(ok) {
    if (!S.live) return false; if (!ok) { drop(); return false; }
    const g = S.live.group; g.updateMatrixWorld(true); const M = g.matrixWorld.clone(), op = env.cfg.op, kind = S.live.kind, sz = new V3(); M.decompose(new V3(), new Q(), sz); const r = Math.max(sz.x, sz.y, sz.z), centre = new V3().setFromMatrixPosition(M);
    let done = false;
    /* a figure or object under it, with no clay nearer: Subtract and Intersect cut that piece */
    const ch = env.clay.hit(centre, r * 1.2, true), mh = (op === 'subtract' || op === 'intersect') ? env.meshNear(centre, r * 1.2) : null;
    if (mh && (!ch || mh.dWorld < ch.d)) {
      const body = g.children[0], solidM = new M4().copy(mh.mesh.matrixWorld).invert().multiply(body.matrixWorld);
      done = env.stampMesh(mh.mesh, shapeSolid(body.geometry, solidM), op === 'intersect' ? 'inside' : 'outside', 'the ' + kind);
    } else {
      if (op !== 'add' && !ch && !env.clay.active) { say('There is no clay here to ' + op + '. Set the mode to add to make clay with this shape.'); return false; }
      const L = ch ? ch.layer : env.clay.ensureLayer(centre, env.figure()); if (!L) return false; if (L.locked) { say(L.name + ' is locked.'); return false; }
      env.strokeStart && env.strokeStart();
      done = env.clay.applyShapeWorld(L, kind, M, op, op === 'add' || op === 'subtract' ? env.cfg.blend * r * 0.3 : 0, env.color(), env.cfg.sym, env.cfg.count, op + ' ' + kind, kind === 'cube' || kind === 'cylinder' ? 0.04 : 0);
      if (done) say(({ add: 'Added the ', subtract: 'Carved out the ', intersect: 'Kept only what is inside the ', paint: 'Painted with the ' })[op] + kind + (env.cfg.sym !== 'off' ? ' (with its symmetry copies)' : '') + '. Undo takes it back.');
    }
    drop(); return done;
  }
  /* the shape's triangles as the closed solid bst_cut.js wants, in a mesh's space */
  function shapeSolid(geo, M) {
    const P = geo.attributes.position, I = geo.index ? geo.index.array : null, nT = (I ? I.length : P.count) / 3, tris = [], q = 1e-5, at = i => new V3().fromBufferAttribute(P, i).applyMatrix4(M);
    for (let t = 0; t < nT; t++) { const a = at(I ? I[t * 3] : t * 3), b = at(I ? I[t * 3 + 1] : t * 3 + 1), c = at(I ? I[t * 3 + 2] : t * 3 + 2); if (a.distanceTo(b) < q || b.distanceTo(c) < q || a.distanceTo(c) < q) continue; tris.push([a, b, c]); }
    let vol = 0; tris.forEach(([a, b, c]) => { vol += a.dot(new V3().crossVectors(b, c)) / 6; }); if (vol < 0) tris.forEach(t => { const x = t[1]; t[1] = t[2]; t[2] = x; });
    return { tris, closed: true, volume: Math.abs(vol) };
  }
  /* ---------- every frame while Shapes is the tool ---------- */
  function frame(hands, dt, cursor) {
    tint();
    const pinched = hands.filter(h => h.pinch);
    if (!S.live) {   /* a faint preview rides at the fingertip until you pinch */
      const h0 = hands[0]; if (!S.preview) { S.preview = makeGhost(S.kind, env.cfg.op); S.preview.children[0].material.opacity = 0.15; env.addHelper(S.preview); }
      if (h0) { S.preview.visible = true; S.preview.position.copy(h0.tip); S.preview.scale.setScalar(env.cfg.size / 100); S.preview.quaternion.identity(); }
      hands.forEach(h => { cursor.hands[h.id] = { tip: h.tip, hit: false, radius: env.cfg.size / 100, mode: 'prim' }; });
      const p = pinched[0]; if (p && !S.hands.get(p.id)) { S.preview.visible = false; create(p.tip, env.cfg.size / 100); S.hands.set(p.id, true); S.grab = startGrab(p); }
      hands.forEach(h => { if (!h.pinch) S.hands.delete(h.id); }); return;
    }
    if (S.preview) S.preview.visible = false;
    const g = S.live.group; g.updateMatrixWorld(true); placeKnobs();
    hands.forEach(h => { cursor.hands[h.id] = { tip: h.tip, hit: true, radius: 0.01, mode: 'prim' }; });
    if (pinched.length >= 2) {   /* both hands: resize about the middle, turn with the pair */
      const a = pinched[0].tip, b = pinched[1].tip, mid = a.clone().add(b).multiplyScalar(0.5), v = b.clone().sub(a);
      if (!S.two) { S.two = { d0: Math.max(1e-3, v.length()), v0: v.clone().normalize(), mid0: mid.clone(), pos0: g.position.clone(), q0: g.quaternion.clone(), s0: g.scale.clone() }; S.grab = null; }
      const T = S.two, k = Math.max(0.05, Math.min(40, v.length() / T.d0)), dq = new Q().setFromUnitVectors(T.v0, v.clone().normalize());
      g.scale.copy(T.s0).multiplyScalar(k); g.quaternion.copy(dq).multiply(T.q0); g.position.copy(T.pos0.clone().sub(T.mid0).applyQuaternion(dq).multiplyScalar(k).add(mid)); g.updateMatrixWorld(true); return;
    }
    S.two = null;
    const p = pinched[0];
    if (!p) { S.grab = null; S.hands.clear(); return; }
    if (!S.grab) S.grab = startGrab(p);
    if (!S.grab) return;
    if (S.grab.kind === 'move') { const hq = p.quat || new Q(), M = new M4().compose(p.tip, hq, new V3(1, 1, 1)).multiply(S.grab.rel); M.decompose(g.position, g.quaternion, new V3()); g.updateMatrixWorld(true); }
    else if (S.grab.kind === 'stretch') {   /* that side follows the hand along its own axis; the opposite side stays where it was */
      const a = S.grab.axis, aw = a.clone().applyQuaternion(g.quaternion).normalize(), along = p.tip.clone().sub(S.grab.anchor).dot(aw), comp = Math.abs(a.x) ? 'x' : Math.abs(a.y) ? 'y' : 'z', half = Math.max(0.004, Math.abs(along) / 2);
      g.scale[comp] = half; g.position.copy(S.grab.anchor).addScaledVector(aw, along / 2); g.updateMatrixWorld(true);
    }
  }
  function startGrab(p) {
    const g = S.live.group; g.updateMatrixWorld(true);
    let best = null, bd = 0.035; S.knobs.forEach(k => { const w = new V3().setFromMatrixPosition(k.matrixWorld), d = w.distanceTo(p.tip); if (d < bd) { bd = d; best = k; } });
    if (best) { const a = best.userData.axis, comp = Math.abs(a.x) ? 'x' : Math.abs(a.y) ? 'y' : 'z', aw = a.clone().applyQuaternion(g.quaternion).normalize(), anchor = g.position.clone().addScaledVector(aw, -g.scale[comp]); return { kind: 'stretch', axis: a, anchor }; }
    const local = g.worldToLocal(p.tip.clone()); if (local.length() > 1.6) { g.position.copy(p.tip); g.updateMatrixWorld(true); }   /* far from it: the shape comes to your hand */
    const hq = p.quat || new Q(), H = new M4().compose(p.tip, hq, new V3(1, 1, 1)), rel = new M4().copy(H).invert().multiply(new M4().compose(g.position, g.quaternion, new V3(1, 1, 1)));
    return { kind: 'move', rel };
  }
    /* sculpting together: a newcomer's snapshot carries a placed shape as its kind and matrix; any grab in progress starts again from the next pinch */
  function reset() { S.grab = null; S.two = null; S.hands.clear(); }
  function state() { if (!S.live) return null; const g = S.live.group; g.updateMatrixWorld(true); return { kind: S.live.kind, m: g.matrix.toArray() }; }
  function setState(st) { drop(); if (!st) return; const k = S.kind; S.kind = st.kind; create(new V3(), 1, true); S.kind = k; const g = S.live.group; g.matrix.fromArray(st.m); g.matrix.decompose(g.position, g.quaternion, g.scale); g.updateMatrixWorld(true); placeKnobs(); }
  return { frame, applyPending, drop, hide: () => { hide(); }, setKind, reset, state, setState, get live() { return S.live; }, S };
}

/* ---------- HOLD: move, turn and resize the work with your hands ---------- */
export function makeHold(THREE, env) {
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, Q = THREE.Quaternion, say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } };
  let G = null;   /* the grab in progress: { objs: [{ o, m0 (world matrix at the start) }], one: {...} | two: {...} } */
  function targetsOf(hands) {
    const clay = env.clay, L = clay.active, tip = hands[0] && hands[0].tip;
    /* what the hand is on comes first (Ruth's emblem: a rod, a head, the clay beside it): the nearest work, rod, emblem or room object within 25 cm */
    if (tip) {
      let best = null, bd = 0.25; const box = new THREE.Box3(), see = (o, what) => { if (!o || !o.parent || !o.visible) return; box.setFromObject(o); if (box.isEmpty()) return; const d = box.distanceToPoint(tip); if (d < bd) { bd = d; best = what; } };
      clay.works.forEach(w => { if (w.layers.length) see(w.group, { work: w }); }); ((env.assets && env.assets()) || []).forEach(o => see(o, { obj: o })); (env.props() || []).forEach(o => see(o, { obj: o }));
      if (best && best.obj) return [best.obj];
      if (best && best.work) { const Lw = L && L.work === best.work ? L : null; if (env.cfg.holdWhat === 'layer' && Lw) return Lw.work.layers.filter(x => x === Lw || (Lw.groupId && x.groupId === Lw.groupId)).map(x => x.group); return [best.work.group]; }
    }
    if (L && clay.live(L)) { if (env.cfg.holdWhat === 'layer') return L.work.layers.filter(x => x === L || (L.groupId && x.groupId === L.groupId)).map(x => x.group); return [L.work.group]; }
    const w = clay.works.find(x => x.group.parent); if (w) return [w.group];
    let best = null, bd = 0.25; if (!tip) return []; (env.props() || []).forEach(o => { if (!o || !o.parent) return; const b = new THREE.Box3().setFromObject(o); const d = b.distanceToPoint(tip); if (d < bd) { bd = d; best = o; } });   /* the room's objects as the host lists them (whole objects, not their parts) */
    return best ? [best] : [];
  }
  const worldOf = o => { o.updateMatrixWorld(true); return o.matrixWorld.clone(); };
  function setWorld(o, M) { const pInv = o.parent ? new M4().copy(o.parent.matrixWorld).invert() : new M4(); const L = pInv.multiply(M); L.decompose(o.position, o.quaternion, o.scale); o.updateMatrixWorld(true); }
  function frame(hands, dt, cursor) {
    const p = hands.filter(h => h.pinch || h.grip);
    hands.forEach(h => { cursor.hands[h.id] = { tip: h.tip, hit: true, radius: 0.015, mode: 'hold' }; });
    if (!p.length) { end(); return; }
    if (!G) { const objs = targetsOf(p); if (!objs.length) { say('Nothing to hold here: Hold moves clay and objects (move a figure with Pose > Move).'); G = { objs: [], none: true }; return; } G = { objs: objs.map(o => ({ o, m0: worldOf(o) })) }; }
    if (G.none) return;
    if (p.length >= 2) {
      const a = p[0].tip, b = p[1].tip, mid = a.clone().add(b).multiplyScalar(0.5), v = b.clone().sub(a);
      if (!G.two) { G.objs.forEach(x => { x.m0 = worldOf(x.o); }); G.two = { d0: Math.max(1e-3, v.length()), v0: v.clone().setY(0).normalize(), vy0: v.clone().normalize(), mid0: mid.clone() }; G.one = null; }
      const T = G.two, k = Math.max(0.05, Math.min(20, v.length() / T.d0)), h = v.clone().setY(0); const dq = h.lengthSq() > 1e-8 && T.v0.lengthSq() > 0.5 ? new Q().setFromUnitVectors(T.v0, h.normalize()) : new Q();   /* turns round the upright only, so the work never tips over by accident */
      const D = new M4().makeTranslation(mid.x, mid.y, mid.z).multiply(new M4().makeRotationFromQuaternion(dq)).multiply(new M4().makeScale(k, k, k)).multiply(new M4().makeTranslation(-T.mid0.x, -T.mid0.y, -T.mid0.z));
      G.objs.forEach(x => setWorld(x.o, new M4().multiplyMatrices(D, x.m0))); G.k = k; return;
    }
    G.two = null; const h = p[0], hq = h.quat || new Q();
    if (!G.one || G.one.id !== h.id) { G.objs.forEach(x => { x.m0 = worldOf(x.o); }); G.one = { id: h.id, H0: new M4().compose(h.tip, hq, new V3(1, 1, 1)) }; }
    const H = new M4().compose(h.tip, hq, new V3(1, 1, 1)), D = H.multiply(new M4().copy(G.one.H0).invert());
    G.objs.forEach(x => setWorld(x.o, new M4().multiplyMatrices(D, x.m0)));
  }
  function end() { G = null; }
  /* the undo for a hold is taken from where things were when the pinch started */
  const startMats = new Map();
  function frameWithUndo(hands, dt, cursor) {
    const anyPinch = hands.some(h => h.pinch || h.grip);
    if (anyPinch && !G) { const objs = targetsOf(hands.filter(h => h.pinch || h.grip)); objs.forEach(o => startMats.set(o, worldOf(o))); }
    frame(hands, dt, cursor);
    if (!anyPinch && startMats.size) {
      const list = [...startMats.entries()].map(([o, m0]) => ({ o, m0, m1: worldOf(o) })); startMats.clear();
      if (list.some(x => !x.m0.equals(x.m1))) { env.pushUndo({ label: 'hold', undo: () => list.forEach(x => setWorld(x.o, x.m0)), redo: () => list.forEach(x => setWorld(x.o, x.m1)), touch: list.map(x => 'O:' + (x.o.name || x.o.id)) }); list.forEach(x => env.dirty(x.o)); say('Moved. Undo puts it back.'); }
    }
  }
  return { frame: frameWithUndo, end: () => { if (startMats.size) frameWithUndo([], 0, { hands: {} }); end(); } };
}
