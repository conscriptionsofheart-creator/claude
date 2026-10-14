/* sculpt_next_selftest.js: the next engine's own checks, run by bst_vr_sculpt_selftest.html?engine=next (no headset: fake hand frames). One section per slice of the work:
   clay (a) · brushes (a) · shapes, booleans, cutter (b) · layers, undo, hold, steady (c) · figures keep skeleton, weights and keys (d) · remesh, decimate, export (e) · worker · timing · menu.
   Each number is a measurement or 1 = pass / 0 = fail; a section that throws reports <section>_error. ?only=clay,shapes runs some sections. */
export async function runNextTests(T, ctx) {
  const V3 = T.Vector3, Q = T.Quaternion, scene = ctx.scene, res = {}, sayLog = [], now = () => performance.now(), only = (ctx.only || '').split(',').filter(Boolean), want = s => !only.length || only.includes(s);
  const mkHost = extra => Object.assign({ setBench() {}, say: t => sayLog.push(t), figure: () => null, props: () => [], addObject: o => { if (!o.parent) scene.add(o); }, removeObject: o => { if (o.parent) o.parent.remove(o); }, noWorker: true }, extra || {});
  const hand = (id, tip, pinch, extra) => Object.assign({ id, tip: tip.clone(), dir: new V3(0, 0, -1), quat: new Q(), pinch }, extra || {});
  const run = (vs, pts, extra, id) => { const ms = []; id = id || 'r'; for (const p of pts) { const t = now(); vs.frame([hand(id, p, true, extra)], 0.016); ms.push(now() - t); } vs.frame([hand(id, pts[pts.length - 1], false, extra)], 0.016); vs.flush(); return ms; };
  const line = (a, b, n) => Array.from({ length: n }, (_, i) => a.clone().lerp(b, i / (n - 1))), still = (p, n) => Array.from({ length: n }, () => p.clone());
  const vol = L => { let n = 0; L.field.bricks.forEach(v => { if (v.inside) n += 512; else for (let i = 0; i < 512; i++) if (v.d[i] < 0) n++; }); return n * L.field.h ** 3; };
  const at = (L, pw) => { const p = L.group.worldToLocal(pw.clone()); return L.field.sample(p.x, p.y, p.z); };
  const surfY = (L, x, z, y0, y1) => { for (let y = y0; y > y1; y -= 0.0005) if (at(L, new V3(x, y, z)) < 0) return y; return null; };
  const st = a => ({ avg: +(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)).toFixed(2), max: +Math.max(0, ...a).toFixed(2) });
  const r2 = x => Math.round(x * 100) / 100, b = c => (c ? 1 : 0);
  const openEdges = g => { const P = g.attributes.position.array, I = g.index ? g.index.array : null, n = I ? I.length : P.length / 3, ids = new Map(), id = i => { const k = Math.round(P[i * 3] * 1e5) + ',' + Math.round(P[i * 3 + 1] * 1e5) + ',' + Math.round(P[i * 3 + 2] * 1e5); let v = ids.get(k); if (v === undefined) { v = ids.size; ids.set(k, v); } return v; }, E = new Map();
    for (let t = 0; t < n; t += 3) { const a = id(I ? I[t] : t), bb = id(I ? I[t + 1] : t + 1), c = id(I ? I[t + 2] : t + 2); for (const [u, v] of [[a, bb], [bb, c], [c, a]]) { if (u === v) continue; const k = u < v ? u + '_' + v : v + '_' + u; E.set(k, (E.get(k) || 0) + 1); } } let o = 0; E.forEach(c => { if (c === 1) o++; }); return o; };
  const ballLayer = (vs, C, r) => { const L = vs.clay.ensureLayer(C, null); vs.clay.applyShapeWorld(L, 'sphere', new T.Matrix4().compose(C, new Q(), new V3(r, r, r)), 'add', 0, [214, 196, 170], 'off', 6, 'ball'); vs.flush(); return L; };
  const section = async (name, fn) => { if (!want(name)) return; try { await fn(); } catch (e) { res[name + '_error'] = String(e && e.stack || e).slice(0, 400); } };
  const fresh = (extra) => { const vs = ctx.createVrSculpt(T, null, mkHost(extra)); vs.enter((extra && extra.figure && extra.figure()) || null); vs.set.stabilize(0); return vs; };
  const cleanup = vs => { try { vs.leave(); vs.clay.works.forEach(w => { if (w.group.parent) w.group.parent.remove(w.group); }); } catch (e) { /* fine */ } };

  /* ---------- (a) clay from nothing, undo, symmetry ---------- */
  await section('clay', async () => {
    const vs = fresh(); vs.set.mode('clay'); vs.set.size(2);
    const ms = run(vs, line(new V3(-0.1, 1.2, -0.5), new V3(0.1, 1.2, -0.5), 25)); const L = vs.clay.active;
    res.clayLayers = vs.clay.allLayers().length; res.clayTris = vs.clay.stats().tris; const exp = Math.PI * 0.02 ** 2 * 0.2 + 4 / 3 * Math.PI * 0.02 ** 3; res.clayVolRatio = r2(vol(L) / exp);
    res.clayOpenEdges = openEdges(vs.clay.bakeGeometry(L)); res.clayFrameMs = st(ms); res.clayDabMs = r2(vs.clay.stats().dabMsAvg);
    const v1 = vol(L); res.clayUndo = b(vs.undo() && vol(L) === 0); vs.flush(); res.clayUndoTris = vs.clay.stats().tris; res.clayRedo = b(vs.redo() && Math.abs(vol(L) - v1) < 1e-12);
    const o = L.work.group.position.clone();   /* the work sits where the first stroke began; mirror is its middle plane, 360 turns round its upright */
    vs.set.sym('mirror'); run(vs, still(o.clone().add(new V3(0.1, 0.1, 0)), 6)); res.clayMirror = b(at(L, o.clone().add(new V3(0.1, 0.1, 0))) < 0 && at(L, o.clone().add(new V3(-0.1, 0.1, 0))) < 0);
    vs.set.sym('radial'); vs.set.count(4); run(vs, still(o.clone().add(new V3(0.08, 0.2, 0)), 6)); res.clayRadial4 = b([[0.08, 0], [0, -0.08], [-0.08, 0], [0, 0.08]].every(([x, z]) => at(L, o.clone().add(new V3(x, 0.2, z))) < 0));
    vs.set.sym('both'); vs.set.count(3); run(vs, still(o.clone().add(new V3(0.05, 0.3, 0.05)), 6)); const a3 = (k, m) => { const v = new V3(0.05 * m, 0.3, 0.05).applyAxisAngle(new V3(0, 1, 0), Math.PI * 2 * k / 3); return at(L, o.clone().add(v)) < 0; }; res.clayBoth6 = b([0, 1, 2].every(k => a3(k, 1) && a3(k, -1)));
    cleanup(vs);
  });

  /* ---------- (a) the brushes on clay: each changes what it should, and undo puts the ball back exactly ---------- */
  await section('brushes', async () => {
    const vs = fresh(), C = new V3(0, 1.2, -0.5), R = 0.06, L = ballLayer(vs, C, R), V0 = vol(L), top = C.clone().add(new V3(0, R, 0)); let exact = 0, tried = 0; const ms = {};
    let mark = vs.strokes(); const notExact = []; const back = () => { if (vs.strokes() > mark) { tried++; const lab = vs.cfg.mode + '/' + vs.cfg.op; if (vs.undo() && Math.abs(vol(L) - V0) < 1e-12) exact++; else notExact.push(lab + ':' + r2((vol(L) / V0 - 1) * 1000) + 'permil'); } vs.flush(); vs.set.op('add'); mark = vs.strokes(); };   /* only a stroke that changed something has an undo step */
    const timed = (name, f) => { vs.clay.resetStats(); const fm = f(); ms[name] = { dab: r2(vs.clay.stats().dabMsAvg), frame: st(fm).avg }; };
    vs.set.size(3); vs.set.strength(50);
    vs.set.mode('inflate'); timed('inflate', () => run(vs, still(top, 15))); res.b_inflate = b(vol(L) > V0 * 1.01); back();
    vs.set.op('subtract'); timed('deflate', () => run(vs, still(top, 15))); res.b_inflateSubtract = b(vol(L) < V0 * 0.995); back();
    vs.set.mode('clay'); vs.set.size(0.6); run(vs, line(top.clone().add(new V3(-0.02, 0.002, 0)), top.clone().add(new V3(0.02, 0.002, 0)), 10)); const h1 = surfY(L, 0, -0.5, 1.3, 1.2);
    vs.set.mode('smooth'); vs.set.size(3); vs.set.strength(100); timed('smooth', () => run(vs, line(top.clone().add(new V3(-0.01, 0.005, 0)), top.clone().add(new V3(0.01, 0.005, 0)), 30))); const h2 = surfY(L, 0, -0.5, 1.3, 1.2); res.b_smoothLowersRidgeMm = r2((h1 - h2) * 1000); res.b_smooth = b(h2 < h1 - 0.0005); vs.undo(); mark = vs.strokes() - 1; back();   /* smooth undone here; back() undoes the ridge under it */
    const ht0 = surfY(L, 0, -0.5, 1.3, 1.2); vs.set.mode('flatten'); vs.set.size(4); vs.set.strength(100); timed('flatten', () => run(vs, line(top.clone().add(new V3(-0.005, 0, 0)), top.clone().add(new V3(0.005, 0, 0)), 25))); res.b_flattenTopMm = r2((ht0 - surfY(L, 0, -0.5, 1.3, 1.2)) * 1000); res.b_flatten = b(res.b_flattenTopMm > 1); back();
    vs.set.mode('scrape'); timed('scrape', () => run(vs, line(top.clone().add(new V3(-0.01, 0, 0)), top.clone().add(new V3(0.01, 0, 0)), 25))); res.b_scrape = b(vol(L) < V0 * 0.995); back();
    vs.set.mode('pinch'); vs.set.op('subtract'); vs.set.size(2); timed('pinch', () => run(vs, line(top.clone().add(new V3(-0.03, 0, 0)), top.clone().add(new V3(0.03, 0, 0)), 20))); res.b_pinchGrooveMm = r2((ht0 - surfY(L, 0, -0.5, 1.3, 1.2)) * 1000); res.b_pinch = b(res.b_pinchGrooveMm > 1); back();
    vs.set.mode('grab'); vs.set.size(3); timed('grab', () => run(vs, line(top, top.clone().add(new V3(0, 0.03, 0)), 12))); res.b_grabRaiseMm = r2((surfY(L, 0, -0.5, 1.35, 1.2) - ht0) * 1000); res.b_grab = b(res.b_grabRaiseMm > 10); back();
    const side = C.clone().add(new V3(R, 0, 0)); vs.set.mode('smear'); vs.set.size(2); const before = at(L, side.clone().add(new V3(0.004, 0, 0.02))); timed('smear', () => run(vs, line(side, side.clone().add(new V3(0, 0, 0.03)), 15))); res.b_smear = b(Math.abs(at(L, side.clone().add(new V3(0.004, 0, 0.02))) - before) > 1e-4); back();
    vs.set.mode('dots'); vs.set.size(2); timed('dots', () => run(vs, line(top.clone().add(new V3(-0.04, -0.01, 0)), top.clone().add(new V3(0.04, -0.01, 0)), 20))); res.b_dots = b(vol(L) > V0 * 1.005); back();
    vs.set.mode('clay'); vs.set.op('paint'); vs.set.tint(2); vs.set.size(2); timed('paint', () => run(vs, line(top.clone().add(new V3(-0.02, 0, 0)), top.clone().add(new V3(0.02, 0, 0)), 12))); const c = L.field.colorAt(...L.group.worldToLocal(top.clone()).toArray()); res.b_paintVolSame = b(Math.abs(vol(L) - V0) < V0 * 0.001); res.b_paintColour = c.join(','); res.b_paint = b(c[2] > c[0]); back(); vs.set.tint(0);
    vs.set.mode('clay'); vs.set.op('intersect'); vs.set.size(3); run(vs, line(C.clone().add(new V3(-0.1, 0, 0)), C.clone().add(new V3(0.1, 0, 0)), 20)); res.b_intersectKeeps = r2(vol(L) / V0); res.b_intersect = b(vol(L) < V0 * 0.8 && vol(L) > V0 * 0.1); back();
    vs.set.mode('melt'); vs.set.size(4); vs.set.strength(100); run(vs, still(top.clone().add(new V3(0, -0.01, 0)), 15)); res.b_melt = b(surfY(L, 0, -0.5, 1.3, 1.2) < ht0 - 0.001); back();
    res.b_undoExact = exact + '/' + tried; res.b_notExact = notExact.join(' '); res.b_ms = ms; cleanup(vs);
  });

  /* ---------- (b) shapes with the hand gizmo, booleans, Apply on a mesh ---------- */
  await section('shapes', async () => {
    const box = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2, 6, 6, 6), new T.MeshStandardMaterial()); box.position.set(0.6, 1.2, -0.5); scene.add(box); box.updateMatrixWorld(true);
    const vs = fresh({ props: () => [box] }); vs.set.mode('prim'); vs.set.prim('cube'); vs.set.size(5); const P = new V3(0, 1.2, -0.5);
    vs.frame([hand('r', P, true)], 0.016); res.s_created = b(!!vs.shapes.live);
    for (let i = 1; i <= 5; i++) vs.frame([hand('r', P.clone().add(new V3(0.01 * i, 0, 0)), true)], 0.016); vs.frame([hand('r', P.clone().add(new V3(0.05, 0, 0)), false)], 0.016);
    const g = vs.shapes.live.group; res.s_movedCm = r2(g.position.x * 100); res.s_moved = b(Math.abs(g.position.x - 0.05) < 0.002);
    const c0 = g.position.clone(), s0 = g.scale.x; vs.frame([hand('a', c0.clone().add(new V3(-0.05, 0, 0)), true), hand('b', c0.clone().add(new V3(0.05, 0, 0)), true)], 0.016);
    vs.frame([hand('a', c0.clone().add(new V3(-0.1, 0, 0)), true), hand('b', c0.clone().add(new V3(0.1, 0, 0)), true)], 0.016); vs.frame([hand('a', c0, false), hand('b', c0, false)], 0.016); res.s_twoHandScale = r2(g.scale.x / s0); res.s_twoHand = b(Math.abs(g.scale.x / s0 - 2) < 0.02);
    g.updateMatrixWorld(true); const knob = g.children.find(k => k.name === 'vrSculptKnob' && k.userData.axis.x === 1), kp = new V3().setFromMatrixPosition(knob.matrixWorld), sx0 = g.scale.x;
    vs.frame([hand('r', kp, true)], 0.016); vs.frame([hand('r', kp.clone().add(new V3(0.03, 0, 0)), true)], 0.016); vs.frame([hand('r', kp, false)], 0.016); res.s_stretchCm = r2((g.scale.x - sx0) * 2 * 100); res.s_stretch = b(g.scale.x > sx0 + 0.01 && Math.abs(g.scale.y - g.scale.z) < 1e-6);
    g.updateMatrixWorld(true); const sz = g.scale.clone(), cubeV = 8 * sz.x * sz.y * sz.z; vs.set.op('add'); vs.shapes.applyPending(true); vs.flush(); const L = vs.clay.active; res.s_applyAddVolRatio = r2(vol(L) / cubeV); res.s_applyAdd = b(Math.abs(vol(L) / cubeV - 1) < 0.15); const V1 = vol(L);
    const corner = g.position.clone().add(new V3(sz.x, sz.y, sz.z)); vs.set.prim('sphere'); vs.set.size(6); vs.set.op('subtract'); vs.frame([hand('r', corner, true)], 0.016); vs.frame([hand('r', corner, false)], 0.016); vs.shapes.applyPending(true); vs.flush(); res.s_subtractKeeps = r2(vol(L) / V1); res.s_subtract = b(vol(L) < V1 * 0.995); const V2 = vol(L);
    vs.set.op('intersect'); vs.set.size(6); vs.frame([hand('r', g.position, true)], 0.016); vs.frame([hand('r', g.position, false)], 0.016); vs.shapes.applyPending(true); vs.flush(); res.s_intersect = b(vol(L) < V2 * 0.95 && vol(L) > 0); vs.undo(); vs.flush();
    vs.set.op('paint'); vs.set.tint(3); vs.set.size(3); const face = g.position.clone().add(new V3(0, sz.y, 0)); vs.frame([hand('r', face, true)], 0.016); vs.frame([hand('r', face, false)], 0.016); vs.shapes.applyPending(true); const pc = L.field.colorAt(...L.group.worldToLocal(face.clone()).toArray()); res.s_paint = b(pc[1] > pc[2] && Math.abs(vol(L) - V2) < V2 * 0.001); vs.set.tint(0);
    vs.set.op('add'); vs.set.sym('mirror'); const off = L.work.group.position.clone().add(new V3(0.2, 0, 0)); vs.set.size(2); vs.frame([hand('r', off, true)], 0.016); vs.frame([hand('r', off, false)], 0.016); vs.shapes.applyPending(true); vs.flush(); res.s_mirror = b(at(L, L.work.group.position.clone().add(new V3(-0.2, 0, 0))) < 0); vs.set.sym('off');
    vs.entryOf(box); const g0 = box.geometry, n0 = g0.index.count; vs.set.op('subtract');   /* a coarse box gets its extra points the first time a tool reaches it; that is not part of the undo */ vs.set.size(4); const fz = box.position.clone().add(new V3(0, 0, 0.1)); vs.frame([hand('r', fz, true)], 0.016); vs.frame([hand('r', fz, false)], 0.016); vs.shapes.applyPending(true);
    res.s_meshStamp = b(box.geometry !== g0 && box.geometry.index.count !== n0); res.s_meshStampUndo = b(vs.undo() && box.geometry === g0);
    vs.set.mode('prim'); vs.frame([hand('r', P, true)], 0.016); vs.frame([hand('r', P, false)], 0.016); vs.shapes.drop(); res.s_drop = b(!vs.shapes.live);
    cleanup(vs); scene.remove(box);
  });

  /* ---------- (b) the cutter on clay (saw sweep = one undo, whole plane), carve, erase, stamp; clay as a stamp into a mesh; mixed undo with the current engine's saw ---------- */
  await section('cutter', async () => {
    const box = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 0.2, 6, 6, 6), new T.MeshStandardMaterial()); box.position.set(0.6, 1.2, -0.5); scene.add(box); box.updateMatrixWorld(true);
    const cutter = new T.Mesh(new T.BoxGeometry(0.04, 0.04, 0.04), new T.MeshStandardMaterial()); cutter.position.set(5, 5, 5); scene.add(cutter); cutter.updateMatrixWorld(true);
    let stampRoots = [cutter]; const vs = fresh({ props: () => [box], stampSource: () => ({ roots: stampRoots, name: 'stamp' }) }); const C = new V3(0, 1.2, -0.5), L = ballLayer(vs, C, 0.06), V0 = vol(L);
    vs.set.mode('cut'); vs.set.cutBlade('saw'); vs.set.size(4); const sweep = line(C.clone().add(new V3(0, 0.08, 0)), C.clone().add(new V3(0, -0.08, 0)), 30); const sm = run(vs, sweep, { dir: new V3(1, 0, 0) });
    res.c_sawDrop = r2(1 - vol(L) / V0); res.c_saw = b(vol(L) < V0 * 0.99 && vol(L) > V0 * 0.7); res.c_sawFrameMs = st(sm); res.c_sawUndoOne = b(vs.undo() && Math.abs(vol(L) - V0) < 1e-12); vs.flush();
    vs.set.cutBlade('plane'); vs.set.cutGoes('front'); run(vs, still(C, 2), { dir: new V3(0, 1, 0) }); res.c_planeKeeps = r2(vol(L) / V0); res.c_plane = b(Math.abs(vol(L) / V0 - 0.5) < 0.08); vs.undo(); vs.flush();
    vs.set.mode('carve'); vs.set.carveKeep('outside'); vs.set.size(1.5); run(vs, line(C.clone().add(new V3(-0.03, 0.06, 0)), C.clone().add(new V3(0.03, 0.06, 0)), 15)); res.c_carve = b(vol(L) < V0 * 0.995); vs.undo(); vs.flush();
    vs.set.mode('erase'); run(vs, line(C.clone().add(new V3(-0.03, 0.06, 0)), C.clone().add(new V3(0.03, 0.06, 0)), 15)); res.c_erase = b(vol(L) < V0 * 0.995); vs.undo(); vs.flush();
    vs.set.mode('stamp'); const T0 = C.clone().add(new V3(0, 0.06, 0)); vs.frame([hand('r', T0, false)], 0.016); vs.frame([hand('r', T0, true)], 0.016); vs.frame([hand('r', T0, false)], 0.016); vs.flush(); res.c_stampIntoClay = b(vol(L) < V0 * 0.99); vs.undo(); vs.flush();
    stampRoots = [L.work.group]; vs.entryOf(box); const fz = box.position.clone().add(new V3(0, 0, 0.1)), g0 = box.geometry; vs.set.stampScale(0.5); vs.frame([hand('r', fz, false)], 0.016); vs.frame([hand('r', fz, true)], 0.016); vs.frame([hand('r', fz, false)], 0.016); res.c_clayAsStamp = b(box.geometry !== g0); vs.undo(); res.c_clayAsStampUndo = b(box.geometry === g0); vs.set.stampScale(1);
    vs.set.mode('cut'); vs.set.cutBlade('saw'); vs.set.size(3); const bs = line(box.position.clone().add(new V3(0, 0.12, 0.1)), box.position.clone().add(new V3(0, -0.12, 0.1)), 25); run(vs, bs, { dir: new V3(1, 0, 0) }); res.c_meshSaw = b(box.geometry !== g0);
    vs.set.mode('clay'); vs.set.size(1); run(vs, line(C.clone().add(new V3(0, 0.08, 0)), C.clone().add(new V3(0.02, 0.08, 0)), 8)); const V1 = vol(L);
    res.c_mixedUndo = b(V1 > V0 && vs.undo() && Math.abs(vol(L) - V0) < 1e-12 && vs.undo() && box.geometry === g0); res.c_mixedRedo = b(vs.redo() && box.geometry !== g0 && vs.redo() && Math.abs(vol(L) - V1) < 1e-12);
    cleanup(vs); scene.remove(box, cutter);
  });

  /* ---------- (c) layers, groups, merge, remesh, Make clay ---------- */
  await section('layers', async () => {
    const box = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.1), new T.MeshStandardMaterial()); box.position.set(0.5, 1.2, -0.5); scene.add(box); box.updateMatrixWorld(true);
    const vs = fresh({ props: () => [box] }), C = new V3(0, 1.2, -0.5), L1 = ballLayer(vs, C, 0.06), V1 = vol(L1), CL = vs.clay;
    const L2 = CL.addLayer(); vs.set.mode('clay'); vs.set.size(1.5); const spot = C.clone().add(new V3(0.15, 0, 0)); run(vs, still(spot, 5)); res.l_newLayer = b(CL.active === L2 && vol(L2) > 0 && vol(L1) === V1);
    CL.toggleHide(L2); res.l_hideNoHit = b(!CL.hit(spot, 0.02, true)); CL.toggleHide(L2);
    CL.toggleLock(L2); const v2 = vol(L2); vs.set.mode('inflate'); run(vs, still(spot, 8)); res.l_lockRefuse = b(vol(L2) === v2); CL.toggleLock(L2);
    const L3 = CL.duplicate(L2); res.l_duplicate = b(L3 && vol(L3) === vol(L2) && CL.allLayers().length === 3);
    CL.mergeDown('add'); res.l_mergeAdd = b(CL.allLayers().length === 2 && Math.abs(vol(L2) - v2) < v2 * 0.05);
    vs.set.mode('clay'); vs.set.size(2); run(vs, line(C.clone().add(new V3(-0.1, 0, 0)), C.clone().add(new V3(0.1, 0, 0)), 15)); CL.pickLayer(L2); CL.mergeDown('subtract'); vs.flush(); const vSub = vol(L1); res.l_mergeSubtract = b(vSub < V1 * 0.95 && CL.allLayers().length === 1);
    res.l_mergeUndo = b(vs.undo() && Math.abs(vol(L1) - V1) < 1e-12 && CL.allLayers().length === 2);
    CL.pickLayer(L2); CL.groupWithBelow(); res.l_grouped = b(L1.groupId && L1.groupId === L2.groupId); CL.mergeGroup(); res.l_mergeGroup = b(CL.allLayers().length === 1); vs.undo(); vs.undo(); CL.pickLayer(L2); CL.ungroup(); res.l_ungroup = b(!L2.groupId);
    const n0 = CL.allLayers().length; CL.removeLayer(L2); res.l_delete = b(CL.allLayers().length === n0 - 1); res.l_deleteUndo = b(vs.undo() && CL.allLayers().length === n0);
    CL.pickLayer(L1); vs.flush(); const t0 = CL.stats().tris; CL.remesh(0.01); vs.flush(); const t1 = CL.stats().tris; res.l_remeshCoarse = b(t1 < t0 * 0.6); res.l_remeshCoarseMs = Math.round(CL.S.lastRemeshMs); res.l_remeshTris = t0 + ' -> ' + t1; vs.undo(); vs.flush();
    CL.remesh(0.003); const rf = []; for (let i = 0; i < 400 && CL.pending(); i++) { const t = now(); vs.frame([], 0.016); rf.push(now() - t); } vs.flush(); res.l_remeshFine = b(CL.stats().tris > t0); res.l_remeshFineMs = Math.round(CL.S.lastRemeshMs); res.l_remeshFineFrames = rf.length; res.l_remeshFineFrameMs = st(rf); res.l_remeshVolKept = r2(vol(L1) / V1); vs.undo(); vs.flush();
    const t2 = now(), LB = vs.makeClay(box); res.l_makeClayMs = Math.round(now() - t2); res.l_makeClayVolRatio = LB ? r2(vol(LB) / 0.001) : 0; res.l_makeClay = b(LB && Math.abs(vol(LB) / 0.001 - 1) < 0.15 && !box.visible); res.l_makeClayUndo = b(vs.undo() && box.visible);
    cleanup(vs); scene.remove(box);
  });

  /* ---------- (c) Hold (one hand moves, two hands resize), undo; the stabiliser ---------- */
  await section('hold', async () => {
    const vs = fresh(), C = new V3(0, 1.2, -0.5), L = ballLayer(vs, C, 0.06), W = L.work.group, p0 = W.position.clone();
    vs.set.mode('hold'); run(vs, line(C, C.clone().add(new V3(0.1, 0, 0)), 6)); res.h_moveCm = r2((W.position.x - p0.x) * 100); res.h_move = b(Math.abs(W.position.x - p0.x - 0.1) < 0.002);
    res.h_undo = b(vs.undo() && W.position.distanceTo(p0) < 1e-6);
    const s0 = W.scale.x; vs.frame([hand('a', C.clone().add(new V3(-0.05, 0, 0)), true), hand('b', C.clone().add(new V3(0.05, 0, 0)), true)], 0.016); vs.frame([hand('a', C.clone().add(new V3(-0.1, 0, 0)), true), hand('b', C.clone().add(new V3(0.1, 0, 0)), true)], 0.016); vs.frame([hand('a', C, false), hand('b', C, false)], 0.016);
    res.h_twoHandScale = r2(W.scale.x / s0); res.h_scale = b(Math.abs(W.scale.x / s0 - 2) < 0.02); res.h_scaledStillSculpts = b(!!vs.clay.hit(C.clone().add(new V3(0.12, 0, 0)), 0.01, true)); vs.undo();
    vs.set.mode('clay'); vs.set.stabilize(1); const A = new V3(0.3, 1.5, -0.5); vs.frame([hand('s', A, true)], 0.016); vs.frame([hand('s', A.clone().add(new V3(0.01, 0, 0)), true)], 0.016); const lag = vs.cursor.hands.s.tip.distanceTo(A);
    vs.frame([hand('s', A.clone().add(new V3(0.05, 0, 0)), true)], 0.016); const fol = vs.cursor.hands.s.tip.distanceTo(A); vs.frame([hand('s', A, false)], 0.016);
    res.st_lagMm = r2(lag * 1000); res.st_followMm = r2(fol * 1000); res.st_steady = b(lag < 0.001 && Math.abs(fol - 0.02) < 0.002);
    cleanup(vs);
  });

  /* ---------- (d) a figure keeps its skeleton, skin weights, rest shape and keys through every brush, the saw, a shape and a save ---------- */
  await section('figure', async () => {
    const { makeTestFigure } = await import('/pe_lib/sculpt_next_testkit.js'); const F = makeTestFigure(T), root = F.root, body = F.body, shirt = F.shirt; root.position.set(-1.5, 0, 0); scene.add(root); root.updateMatrixWorld(true); F.skeleton.update();
    const g0 = body.geometry, si0 = Array.from(g0.attributes.skinIndex.array), sw0 = Array.from(g0.attributes.skinWeight.array), p0 = Array.from(g0.attributes.position.array), sm0 = Array.from(g0.morphAttributes.position[0].array), bones0 = F.skeleton.bones.length, inv0 = F.skeleton.boneInverses.map(m => m.elements.join(',')).join(';'), bind0 = body.bindMatrix.elements.join(',');
    const vs = ctx.createVrSculpt(T, null, mkHost({ figure: () => root })); vs.enter(root); vs.set.stabilize(0);
    const en = vs.entryOf(body), P = en.posed; let fi = -1, fz = -1e9; for (let i = 0; i < P.length / 3; i++) if (P[i * 3 + 1] > 1.0 && P[i * 3 + 1] < 1.05 && Math.abs(P[i * 3]) < 0.04 && P[i * 3 + 2] > fz) { fz = P[i * 3 + 2]; fi = i; }
    const front = new V3(P[fi * 3], P[fi * 3 + 1], P[fi * 3 + 2] + 0.005).applyMatrix4(body.matrixWorld), fms = [];
    vs.set.sym('mirror'); vs.set.size(4); vs.set.strength(60);
    for (const m of ['clay', 'flatten', 'pinch', 'smear', 'dots', 'scrape', 'inflate', 'smooth', 'grab']) { vs.set.mode(m); vs.set.op(m === 'pinch' ? 'subtract' : 'add'); vs.cfg.key = 'Next ' + m; fms.push(...run(vs, line(front, front.clone().add(new V3(0.03, m === 'grab' ? 0.02 : 0, 0)), 10))); }
    vs.set.mode('inflate'); vs.set.op('paint'); vs.set.tint(1); fms.push(...run(vs, line(front, front.clone().add(new V3(0.03, 0, 0)), 8))); vs.set.op('add');
    const g1 = body.geometry, ca = g1.attributes.color;
    res.f_skinIndexSame = b(Array.from(g1.attributes.skinIndex.array).every((x, i) => x === si0[i])); res.f_skinWeightSame = b(Array.from(g1.attributes.skinWeight.array).every((x, i) => x === sw0[i]));
    res.f_restShapeSame = b(Array.from(g1.attributes.position.array).every((x, i) => x === p0[i])); res.f_smileSame = b(Array.from(g1.morphAttributes.position[body.morphTargetDictionary.Smile].array).every((x, i) => x === sm0[i]));
    res.f_bonesSame = b(F.skeleton.bones.length === bones0 && F.skeleton.boneInverses.map(m => m.elements.join(',')).join(';') === inv0 && body.bindMatrix.elements.join(',') === bind0);
    const keys = Object.keys(body.morphTargetDictionary); res.f_keys = keys.length; res.f_mirrorKeys = b(keys.includes('Next clay (left)') && keys.includes('Next clay (right)'));
    res.f_paint = b(ca && Array.from(ca.array).some(x => x < 0.99)); res.f_paintOwnMaterial = b(body.material.vertexColors === true);
    res.f_brushFrameMs = st(fms);
    vs.set.sym('off'); const sg0 = shirt.geometry; const sp = new V3().fromBufferAttribute(shirt.geometry.attributes.position, 0); shirt.updateMatrixWorld(true); const shirtP = vs.entryOf(shirt).posed, sw = new V3(shirtP[0], shirtP[1], shirtP[2]).applyMatrix4(shirt.matrixWorld); void sp;
    vs.set.mode('inflate'); vs.cfg.key = 'Shirt'; run(vs, still(sw, 8)); res.f_clothesNewGeometry = b(shirt.geometry !== sg0 && shirt.geometry.attributes.position === sg0.attributes.position);
    const kN = Object.keys(body.morphTargetDictionary).sort().join(','), mN = body.geometry.morphAttributes.position.length;
    vs.set.mode('cut'); vs.set.cutBlade('saw'); vs.set.size(3); const side = new V3(P[fi * 3] + 0.12, 1.2, 0).applyMatrix4(body.matrixWorld); run(vs, line(side.clone().add(new V3(0, 0.05, 0)), side.clone().add(new V3(0, -0.05, 0)), 15), { dir: new V3(0, 0, 1) });
    const g2 = body.geometry; res.f_sawChanged = b(g2 !== g1); res.f_sawKeepsSkin = b(!!g2.attributes.skinIndex && !!g2.attributes.skinWeight && g2.attributes.skinWeight.itemSize === 4); res.f_sawKeepsKeys = b(g2.morphAttributes.position.length === mN && Object.keys(body.morphTargetDictionary).sort().join(',') === kN);
    vs.set.mode('prim'); vs.set.prim('sphere'); vs.set.op('subtract'); vs.set.size(2); vs.frame([hand('r', front.clone().add(new V3(0, 0.1, 0)), true)], 0.016); vs.frame([hand('r', front, false)], 0.016); const g3 = body.geometry; vs.shapes.applyPending(true);
    res.f_shapeCutsFigure = b(body.geometry !== g3); res.f_shapeKeepsSkin = b(!!body.geometry.attributes.skinIndex && body.geometry.morphAttributes.position.length === mN); vs.set.op('add');
    let rz = 'ok'; try { ctx.renderer.render(scene, ctx.cam); } catch (e) { rz = e.message; } res.f_renders = b(rz === 'ok');
    const out = await vs.exportGlb([root], {}); const gl = await new Promise((ok, no) => new ctx.Loader().parse(out.buffer, '', ok, no)); let sk = null; gl.scene.traverse(o => { if (o.isSkinnedMesh && o.name === 'body') sk = o; });
    res.f_glbBytes = out.buffer.byteLength; res.f_glbSkinned = b(!!sk); res.f_glbBones = sk ? sk.skeleton.bones.length + '/' + bones0 : 0; res.f_glbKeys = b(sk && sk.morphTargetDictionary && 'Smile' in sk.morphTargetDictionary && 'Next clay (left)' in sk.morphTargetDictionary); res.f_glbWeights = b(sk && !!sk.geometry.attributes.skinWeight);
    cleanup(vs); scene.remove(root);
  });

  /* ---------- (e) decimate a copy, export clay with a budget, save to the (pretend) library ---------- */
  await section('export', async () => {
    const vs = fresh(); const sph = new T.SphereGeometry(0.1, 256, 200), before = sph.index.count / 3, d = vs.decimate(sph, 20000), P = d.geometry.attributes.position.array; let dev = 0; for (let i = 0; i < P.length; i += 3) dev = Math.max(dev, Math.abs(Math.hypot(P[i], P[i + 1], P[i + 2]) - 0.1));
    res.d_before = before; res.d_after = d.after; res.d_ms = Math.round(d.ms); res.d_maxDevMm = r2(dev * 1000); res.d_open = openEdges(d.geometry); res.d_ok = b(d.after <= 20000 && d.after > 19000 && dev < 0.002);
    const C = new V3(0, 1.2, -0.5), L = ballLayer(vs, C, 0.08); vs.set.mode('dots'); vs.set.size(2); run(vs, line(C.clone().add(new V3(-0.06, 0.07, 0)), C.clone().add(new V3(0.06, 0.07, 0)), 20)); const full = vs.clay.stats().tris;
    const t0 = now(), ex = await vs.exportGlb([L.work.group], { budget: 3000 }); res.e_exportMs = Math.round(now() - t0); res.e_trisFull = full; res.e_trisCopy = ex.tris; res.e_budget = b(ex.tris <= 3000 && ex.tris > 2000); res.e_roomKeepsAll = b(vs.clay.stats().tris === full);
    const gl = await new Promise((ok, no) => new ctx.Loader().parse(ex.buffer, '', ok, no)); let meshes = 0, colours = 0; gl.scene.traverse(o => { if (o.isMesh) { meshes++; if (o.geometry.attributes.color) colours++; } }); res.e_parse = b(meshes >= 1); res.e_colours = b(colours === meshes && meshes > 0);
    try { const j = await vs.save('next selftest clay', { roots: [L.work.group] }); res.e_save = b(j && j.ok); res.e_saveBytes = j.bytes; } catch (e) { res.e_save = 0; res.e_saveError = String(e.message || e); }
    cleanup(vs);
  });

  /* ---------- the worker: clay meshed off the page's thread ---------- */
  await section('worker', async () => {
    const vs = ctx.createVrSculpt(T, null, mkHost({ noWorker: false })); vs.enter(null); vs.set.stabilize(0); vs.set.mode('clay'); vs.set.size(2); const ms = [];
    for (const p of line(new V3(-0.1, 1.5, -0.5), new V3(0.1, 1.5, -0.5), 30)) { const t = now(); vs.frame([hand('w', p, true)], 0.016); ms.push(now() - t); await new Promise(r => setTimeout(r, 0)); }
    vs.frame([hand('w', new V3(0.1, 1.5, -0.5), false)], 0.016); const t0 = now(); while (vs.clay.pending() && now() - t0 < 5000) { vs.frame([], 0.016); await new Promise(r => setTimeout(r, 5)); }
    const s = vs.clay.stats(); res.w_used = b(s.worker && s.workerOk); res.w_settleMs = Math.round(now() - t0); res.w_tris = s.tris; res.w_frameMs = st(ms); res.w_ok = b(s.workerOk && s.tris > 0 && !vs.clay.pending());
    cleanup(vs);
  });

  /* ---------- timing on this machine (the runner can slow the CPU to stand in for a Quest) ---------- */
  await section('timing', async () => {
    const vs = fresh(); vs.set.mode('clay'); vs.set.size(2); vs.set.sym('radial'); vs.set.count(6); const a = run(vs, line(new V3(0.1, 1.2, -0.5), new V3(0.1, 1.5, -0.5), 60)); res.p_clayRadial6FrameMs = st(a); res.p_clayRadial6DabMs = r2(vs.clay.stats().dabMsAvg); res.p_meshMsPerChunk = r2(vs.clay.stats().meshMsPerChunk);
    vs.set.sym('off'); vs.set.size(8); vs.clay.resetStats(); const bA = run(vs, line(new V3(-0.2, 1.6, -0.5), new V3(0.2, 1.6, -0.5), 40)); res.p_clayBig8FrameMs = st(bA); res.p_clayBig8DabMs = r2(vs.clay.stats().dabMsAvg);
    vs.set.mode('smooth'); vs.set.size(8); vs.clay.resetStats(); const c = run(vs, line(new V3(-0.1, 1.6, -0.5), new V3(0.1, 1.6, -0.5), 40)); res.p_smooth8FrameMs = st(c); res.p_trisInRoom = vs.clay.stats().tris; res.p_kB = vs.clay.stats().kB;
    cleanup(vs);
  });

  /* ---------- the flow: the other hand smooths, quick swap, haptic ticks, finish, the story-asset bench, expressions that move and save ---------- */
  await section('flow', async () => {
    const vs = fresh(), C = new V3(0, 1.2, -0.5), L = ballLayer(vs, C, 0.06), V0 = vol(L), top = C.clone().add(new V3(0, 0.06, 0)), side = C.clone().add(new V3(0.06, 0, 0));
    vs.set.mode('inflate'); vs.set.size(3); let pulses = 0, supportMode = null;
    for (let i = 0; i < 12; i++) { const hs = [hand('a', top, true)]; if (i >= 4) hs.push(hand('b', side, true)); vs.frame(hs, 0.016); if (vs.cursor.hands.a && vs.cursor.hands.a.pulse > 0) pulses++; if (vs.cursor.hands.b) supportMode = vs.cursor.hands.b.mode; }
    vs.frame([hand('a', top, false), hand('b', side, false)], 0.016); vs.flush(); res.fl_supportSmooths = b(supportMode === 'smooth'); res.fl_hapticTicks = pulses; res.fl_haptic = b(pulses > 0); vs.undo(); vs.undo(); vs.flush();
    const v1 = vol(L); run(vs, still(top, 15), { alt: true }); res.fl_quickSwap = b(vol(L) < v1); vs.undo(); vs.flush();
    vs.clay.pickLayer(L); vs.set.finish('metal'); res.fl_finish = b(L.material.metalness > 0.8); res.fl_finishUndo = b(vs.undo() && L.material.metalness < 0.1);
    const { makeTestFigure } = await import('/pe_lib/sculpt_next_testkit.js'); const F = makeTestFigure(T); F.root.position.set(-1.5, 0, 0); scene.add(F.root); F.root.updateMatrixWorld(true);
    const vf = ctx.createVrSculpt(T, null, mkHost({ figure: () => F.root })); vf.enter(F.root); vf.set.stabilize(0);
    const w0 = vf.clay.works.length; vf.newAsset(); res.fl_assetHidesFigure = b(!F.root.visible); vf.set.mode('clay'); vf.set.size(2); run(vf, line(new V3(-1.0, 1.4, -0.5), new V3(-0.9, 1.4, -0.5), 10));
    res.fl_assetNewWork = b(vf.clay.works.length === w0 + 1 && vf.clay.active.work.layers.length === 1); res.fl_assetNotOnFigure = b(!Object.keys(F.body.morphTargetDictionary).some(k => /^Shape/.test(k))); vf.endAsset(); res.fl_assetBack = b(F.root.visible);
    const k = F.body.morphTargetDictionary.Smile, base = F.body.morphTargetInfluences[k]; vf.set.pulseDur(0.3); vf.pulse('Smile'); let peak = 0; for (let i = 0; i < 12; i++) { vf.frame([], 0.016); peak = Math.max(peak, F.body.morphTargetInfluences[k]); } for (let i = 0; i < 20; i++) vf.frame([], 0.016);
    res.fl_pulsePeak = r2(peak); res.fl_pulse = b(peak > base + 0.3 && Math.abs(F.body.morphTargetInfluences[k] - base) < 1e-6);
    vf.set.pulseDur(0.1); res.fl_pulseNeverUnder200ms = b(vf.cfg.pulseDur >= 0.2);
    vf.recordMotion(); vf.set.pulseDur(0.6); vf.pulse('Smile'); for (let i = 0; i < 45; i++) vf.frame([], 0.016); const clip = vf.stopMotion('Test smile'); res.fl_clip = b(clip && clip.tracks.length >= 1 && clip.duration > 0.5); res.fl_clipName = clip ? clip.name : '';
    res.fl_playMove = b(vf.playMotion()); const out = await vf.exportGlb([F.root], {}), gl = await new Promise((ok, no) => new ctx.Loader().parse(out.buffer, '', ok, no)); res.fl_glbAnimations = gl.animations.length; res.fl_glbAnimationName = gl.animations[0] ? gl.animations[0].name : '';
    cleanup(vf); cleanup(vs); scene.remove(F.root);
  });

  /* ---------- Ruth's emblem in clay, sliced (no frame over budget), six coloured layers, a spin that eases, a Spin clip in the .glb; one undo removes it ---------- */
  await section('emblem', async () => {
    const vs = fresh(); const t0 = now(), e = vs.makeEmblem({ at: new V3(0, 1.3, -0.6) }), g = e.object; let slices = 0, sliceMax = 0; while (!e.ready() && slices < 500) { const t1 = now(); vs.clay.pump(0); sliceMax = Math.max(sliceMax, now() - t1); slices++; } res.em_buildMs = Math.round(now() - t0); res.em_slices = slices; res.em_sliceMaxMs = r2(sliceMax); res.em_ready = b(e.ready());
    const parts = g.children.filter(o => o.isMesh); res.em_parts = parts.map(o => o.name).join(', '); res.em_tris = parts.reduce((a, o) => a + o.geometry.index.count / 3, 0);
    const avg = name => { const m = parts.find(o => o.name === name), C = m.geometry.attributes.color.array; let r = 0, gg = 0, bb = 0; for (let i = 0; i < C.length; i += 3) { r += C[i]; gg += C[i + 1]; bb += C[i + 2]; } const n = C.length / 3; return [r / n, gg / n, bb / n]; };
    const bl = avg('Blue figure'), or = avg('Orange figure'); res.em_blueIsBlue = b(bl[2] > bl[0] * 1.5); res.em_orangeIsWarm = b(or[0] > or[2] * 1.5);
    const bf = parts.find(o => o.name === 'Blue figure'); bf.geometry.computeBoundingBox(); const bs = bf.geometry.boundingBox.getSize(new V3()); res.em_rodDepthCm = r2(bs.z * 100); res.em_is3D = b(bs.z > 0.04);
    res.em_inAssets = b(vs.assets().some(a => a.object === g)); res.em_pickable = b(vs.squeezed().some(a => a.object === g));
    res.em_spinning = b(vs.motion.spinning(g)); const q0 = g.quaternion.clone(); for (let i = 0; i < 60; i++) vs.frame([], 0.016); res.em_turned = b(g.quaternion.angleTo(q0) > 0.05); res.em_spinClip = b((g.animations || []).some(c => c.name === 'Spin'));
    const ex = await vs.exportGlb([g], {}), gl = await new Promise((ok, no) => new ctx.Loader().parse(ex.buffer, '', ok, no)); let meshes = 0; gl.scene.traverse(o => { if (o.isMesh) meshes++; }); res.em_glbMeshes = meshes; res.em_glbSpin = b(gl.animations.some(c => c.name === 'Spin'));
    vs.set.mode('inflate'); vs.set.size(3); const tip = new V3().setFromMatrixPosition(g.matrixWorld); const hb = new T.Box3().setFromObject(parts.find(o => o.name === 'Orange head')), hc = hb.getCenter(new V3()), top = new V3(hc.x, hb.max.y, hc.z); run(vs, still(top, 12)); res.em_brushable = b(vs.keys().some(k => k.mesh.name === 'Orange head')); void tip;
    vs.spin(g, 0); for (let i = 0; i < 120; i++) vs.frame([], 0.016); res.em_spinStops = b(!vs.motion.spinning(g));
    while (vs.canUndo() && g.parent) vs.undo(); res.em_undo = b(!g.parent && !vs.assets().includes(e.entry)); cleanup(vs);
  });
  await section('rod', async () => {
    const vs = fresh(); vs.set.mode('rod'); vs.set.size(2); vs.set.rodTwist(180); const pts = []; for (let i = 0; i < 40; i++) { const a = i / 39 * Math.PI; pts.push(new V3(Math.cos(a) * 0.15, 1.3 + Math.sin(a) * 0.15, -0.6 + i * 0.002)); }
    const fm = run(vs, pts); const A = vs.assets(), rod = A.find(a => a.kind === 'rod'); res.rod_made = b(!!rod); res.rod_frameMs = st(fm);
    if (rod) { const g = rod.object.geometry; res.rod_tris = g.index.count / 3; g.computeBoundingBox(); const sz = g.boundingBox.getSize(new V3()); res.rod_followsPath = b(sz.x > 0.25 && sz.y > 0.12); }
    res.rod_undo = b(vs.undo() && !vs.assets().length); res.rod_redo = b(vs.redo() && vs.assets().length === 1); cleanup(vs);
  });

  /* ---------- colour wheel, gradients, transparency, skins, looks (Ruth 2026-10-14: "all kinds of color gradients ... skins and shaders on the objects", "a color wheel ... gradients ... transparencies") ---------- */
  await section('looks', async () => {
    const { makeTestFigure } = await import('/pe_lib/sculpt_next_testkit.js'), F = makeTestFigure(T); scene.add(F.root); F.root.updateMatrixWorld(true);
    const vs = fresh({ figure: () => F.root }), W = new V3(0, 1.3, -0.5), tap = (p, n) => { for (let i = 0; i < (n || 2); i++) vs.frame([hand('w', p, true)], 0.016); vs.frame([hand('w', p, false)], 0.016); };
    const at = (x, y) => W.clone().add(new V3(x, y, 0)), R = 0.075, hexOf = () => vs.cfg.rgb, rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    vs.wheel.open(W.clone(), new V3(0, 1.3, 0.5)); res.lk_wheelOpen = b(vs.wheel.isOpen && !!vs.wheel.root.parent);
    tap(at(R * 0.8, 0)); const red = rgb(hexOf()); res.lk_wheelRed = b(red[0] > red[1] + 60 && red[0] > red[2] + 60);
    tap(at(Math.cos(Math.PI * 2 / 3) * R * 0.9, Math.sin(Math.PI * 2 / 3) * R * 0.9)); const green = rgb(hexOf()); res.lk_wheelGreen = b(green[1] > green[0] + 60 && green[1] > green[2] + 60);
    tap(at(R + 0.025, -0.06)); const dark = rgb(hexOf()); res.lk_lightBarDarker = b(Math.max(...dark) < Math.max(...green) - 40);
    tap(at(R + 0.025, 0.07)); tap(at(-R - 0.025, -0.0375)); res.lk_clearBar = r2(vs.cfg.alpha); res.lk_clearOk = b(Math.abs(vs.cfg.alpha - 0.25) < 0.03);
    tap(at(R * 1.2 + 0.03, -R - 0.05)); res.lk_plusStarts = b(vs.cfg.gradient === 'custom' && vs.cfg.gradCustom.split(',').length === 2);
    tap(at(-R - 0.025, 0.07)); tap(at(Math.cos(Math.PI * 4 / 3) * R * 0.9, Math.sin(Math.PI * 4 / 3) * R * 0.9)); tap(at(R * 1.2 + 0.03, -R - 0.05)); res.lk_gradStops = vs.cfg.gradCustom.split(',').length;
    tap(at(-R * 1.2, -R - 0.04)); tap(at(-R * 1.2 - 0.03, -R - 0.05)); res.lk_minusRemoves = b(vs.cfg.gradCustom.split(',').length === res.lk_gradStops - 1);
    const pinchedAway = (() => { const n0 = vs.strokes(); vs.set.mode('clay'); run(vs, line(new V3(0.3, 1.3, -0.5), new V3(0.35, 1.3, -0.5), 8)); return vs.strokes() > n0; })(); res.lk_sculptBesideWheel = b(pinchedAway);
    tap(at(R + 0.03, R + 0.02)); res.lk_wheelCloses = b(!vs.wheel.isOpen && !vs.wheel.root.parent);
    /* a see-through gradient on a rod: colour with a fourth value, a material that lets light through */
    vs.set.gradCustom('#ff2a6d@0,#05d9e8@0.5,#ffffff00@1'); vs.set.gradient('custom'); vs.set.mode('rod'); vs.set.size(2); const rp = []; for (let i = 0; i < 30; i++) rp.push(new V3(-0.4 + i * 0.01, 1.1 + Math.sin(i / 5) * 0.03, -0.5)); run(vs, rp);
    const rod = vs.assets().filter(a => a.kind === 'rod').pop(); res.lk_rodSeeThrough = b(rod && rod.object.geometry.attributes.color.itemSize === 4 && rod.object.material.transparent);
    if (rod) { const C = rod.object.geometry.attributes.color.array; res.lk_rodFadesOut = b(C[C.length - 4 * 40 + 3] < 0.2 && C[3] > 0.9); }
    /* the Gradient tool along a line, and a skin, then undo */
    vs.set.gradient('sunset'); vs.set.mode('rod'); const rp2 = []; for (let i = 0; i < 30; i++) rp2.push(new V3(-0.4 + i * 0.01, 1.45, -0.5)); run(vs, rp2); const rod2 = vs.assets().filter(a => a.kind === 'rod').pop(), g2 = rod2.object.geometry, col0 = g2.attributes.color.array.slice();
    vs.set.gradient('ocean'); vs.set.mode('gradient'); vs.set.size(3); const a0 = new V3(-0.4, 1.45, -0.5), a1 = new V3(-0.11, 1.45, -0.5); const drag = []; for (let i = 0; i < 12; i++) drag.push(a0.clone().lerp(a1, i / 11)); run(vs, drag);
    const c1 = g2.attributes.color.array, ends = [c1.slice(0, 3), c1.slice(c1.length - 3 * 40, c1.length - 3 * 40 + 3)]; res.lk_gradientApplied = b(c1 !== col0 && Math.abs(ends[0][2] - ends[1][2]) + Math.abs(ends[0][0] - ends[1][0]) > 0.15);
    res.lk_gradientUndo = b(vs.undo() && g2.attributes.color.array === col0 || (g2.attributes.color.array.length === col0.length && g2.attributes.color.array.every((v, i) => v === col0[i])));
    vs.set.skin('marble'); tap(a0.clone().lerp(a1, 0.5)); vs.flush(); const cm = g2.attributes.color.array; let mn = 9, mx = -9; for (let i = 0; i < cm.length; i += 3) { const l = cm[i] + cm[i + 1] + cm[i + 2]; mn = Math.min(mn, l); mx = Math.max(mx, l); } res.lk_skinMarbleVaries = b(mx - mn > 0.3);
    /* on clay: the field's colours follow the line */
    const L = ballLayer(vs, new V3(0.5, 1.3, -0.5), 0.05); vs.set.skin('smooth'); vs.set.gradient('fire'); const d2 = []; for (let i = 0; i < 12; i++) d2.push(new V3(0.45 + i * 0.1 / 11, 1.3, -0.45)); run(vs, d2);
    const cl = p => { const q = L.group.worldToLocal(p.clone()); return L.field.colorAt(q.x, q.y, q.z); }, cA = cl(new V3(0.452, 1.3, -0.48)), cB = cl(new V3(0.548, 1.3, -0.48)); res.lk_clayGradient = b(Math.abs(cA[1] - cB[1]) > 40); res.lk_clayColours = [cA.map(Math.round).join('/'), cB.map(Math.round).join('/')].join(' -> ');
    /* the Look tool: chrome on the rod, glass (see-through) on the clay; undo */
    vs.set.finish('chrome'); vs.set.alpha(1); vs.set.mode('look'); tap(new V3(-0.25, 1.45, -0.5)); res.lk_lookOnRod = b(rod2.object.material.userData.look === 'chrome' && rod2.object.material.metalness === 1);
    vs.set.finish('glass'); vs.set.alpha(0.5); tap(new V3(0.5, 1.352, -0.5)); res.lk_lookGlassClay = b(L.finish === 'glass' && L.material.transparent && L.material.opacity <= 0.5);
    vs.set.finish('pearl'); vs.set.alpha(1); tap(new V3(-0.25, 1.45, -0.5)); res.lk_pearl = rod2.object.material.type;
    res.lk_lookUndo = b(vs.undo() && rod2.object.material.userData.look === 'chrome');
    /* people keep their own skin */
    const body = F.body, keep = body.material; vs.set.mode('gradient'); const bp = new V3(); { const P = body.geometry.attributes.position; let bi = 0, bz = -1; for (let i = 0; i < P.count; i++) if (Math.abs(P.getY(i) - 1.25) < 0.04 && P.getZ(i) > bz) { bz = P.getZ(i); bi = i; } bp.fromBufferAttribute(P, bi).applyMatrix4(body.matrixWorld); }
    const nSay = sayLog.length; tap(bp); vs.flush(); res.lk_peopleKept = b(body.material === keep && sayLog.slice(nSay).some(t => /People keep their own skin/.test(t)));
    /* the dressed rod saves with its look */
    const ex = await vs.exportGlb([rod2.object], {}), gl = await new Promise((ok, no) => new ctx.Loader().parse(ex.buffer, '', ok, no)); let mm = null; gl.scene.traverse(o => { if (o.isMesh) mm = o; }); res.lk_glbMetal = mm ? r2(mm.material.metalness) : -1;
    res.lk_gradients = vs.gradients.length; res.lk_skins = vs.skins.length; res.lk_looks = vs.looks.length;
    cleanup(vs); vs.assets().forEach(a => a.object.parent && a.object.parent.remove(a.object)); scene.remove(F.root);
  });

  /* ---------- sculpt together: 2 engines, then 4, over an in-page relay (same numbering and echo as the real one); every headset must hold the same work ---------- */
  await section('together', async () => {
    const { makeLocalRelay } = await import('/pe_lib/sculpt_next_collab.js'), { makeTestFigure } = await import('/pe_lib/sculpt_next_testkit.js'), relay = makeLocalRelay(), peers = [];
    const mk = name => { const world = new T.Group(); world.name = '_world_' + name; scene.add(world); const F = makeTestFigure(T); world.add(F.root); const says = [];
      const vs = ctx.createVrSculpt(T, null, mkHost({ figure: () => F.root, say: t => says.push(t), addObject: o => { if (!o.parent) world.add(o); } })); vs.enter(F.root); vs.set.stabilize(0); const p = { name, vs, F, world, says }; peers.push(p); return p; };
    const tick = () => new Promise(r => setTimeout(r, 0));
    const settle = async () => { for (let k = 0; k < 2000; k++) { await tick(); peers.forEach(p => { if (p.vs.together.on) p.vs.flush(); }); if (relay.idle() && peers.every(p => !p.vs.together.on || p.vs.together.waiting === 0)) { await tick(); if (relay.idle()) return k; } } return -1; };
    const sums = list => list.map(p => p.vs.together.checksum());
    const same = list => { const v = sums(list); return b(v.every(x => x === v[0])); };
    /* hands of several people in the same frames: each step every engine gets its own hand, then the messages travel */
    const together = async (moves, n) => { const fm = []; for (let i = 0; i < n; i++) { for (const [p, f] of moves) { const t = now(); p.vs.frame(f(i), 0.016); fm.push(now() - t); } await tick(); } for (const [p] of moves) p.vs.frame([], 0.016); await settle(); return fm; };
    const A = mk('A'), B = mk('B');
    A.vs.together.start({ transport: relay.connect(), name: 'Ruth' }); await settle(); res.tg_aloneOn = b(A.vs.together.state === 'synced' && A.vs.together.people().length === 1);
    A.vs.set.mode('clay'); A.vs.set.size(2); await together([[A, i => [hand('r', new V3(-0.12 + i * 0.01, 1.2, -0.5), i < 20)]]], 22);
    A.vs.set.mode('rod'); await together([[A, i => [hand('r', new V3(0.15 + Math.cos(i / 29 * Math.PI) * 0.1, 1.3 + Math.sin(i / 29 * Math.PI) * 0.1, -0.6), i < 30)]]], 32);
    res.tg_aloneMade = b(A.vs.clay.works.some(w => w.layers.length) && A.vs.assets().length === 1);
    /* B joins late: it gets A's clay and rod from the snapshot */
    B.vs.together.start({ transport: relay.connect(), name: 'Sam' }); await settle();
    res.tg_joined = b(B.vs.together.state === 'synced' && A.vs.together.people().length === 2 && B.vs.together.people().length === 2);
    res.tg_snapMs = A.vs.together.stats().snapMs; res.tg_restoreMs = B.vs.together.stats().restoreMs; res.tg_joinSameWork = b(B.vs.clay.works.filter(w => w.group.parent).length === 1 && B.vs.assets().length === 1); res.tg_joinChecksum = same([A, B]);
    /* both at once on the same clay: A draws a new lump beside it, B inflates A's first stroke */
    const L = A.vs.clay.allLayers()[0], top = new V3(-0.05, 1.2 + 0.018, -0.5); A.vs.set.mode('clay'); B.vs.set.mode('inflate'); B.vs.set.size(3); B.vs.set.strength(80);
    const vA0 = vol(L), fm = await together([[A, i => [hand('r', new V3(-0.12 + i * 0.01, 1.26, -0.5), i < 24)]], [B, i => [hand('r', top, i < 24)]]], 26);
    const LB = B.vs.clay.layerById(L.id); res.tg_bothChanged = b(vol(L) > vA0 * 1.5 && LB && Math.abs(vol(LB) - vol(L)) < 1e-12); res.tg_concurrentSame = same([A, B]); res.tg_frameMs = st(fm);
    /* a shape placed by B and applied from B's menu (the tap goes through the shared order) */
    B.vs.set.mode('prim'); B.vs.set.prim('cube'); B.vs.set.size(3); await together([[B, i => [hand('r', new V3(0.05, 1.2, -0.5), i < 3)]]], 4); B.vs.shapes.applyPending(true); await settle();
    res.tg_shapeOnBoth = b(!B.vs.shapes.live && A.vs.clay.allLayers().length === B.vs.clay.allLayers().length && Math.abs(vol(L) - vol(LB)) < 1e-12); res.tg_shapeSame = same([A, B]);
    /* undo is your own: A's last step was its clay stroke, but B has changed the same layer since (the cube), so A's undo is refused; B undoes the cube, then A can undo */
    const nA = A.says.length; A.vs.undo(); await settle(); res.tg_undoRefused = b(A.says.slice(nA).some(t => /would also undo/.test(t)));
    const v1 = vol(L); B.vs.undo(); await settle(); res.tg_undoOwn = b(vol(L) < v1 - 1e-9); A.vs.undo(); await settle(); res.tg_undoAfter = b(vol(L) < vol(B.vs.clay.layerById(L.id)) + 1e-12 && Math.abs(vol(L) - vol(B.vs.clay.layerById(L.id))) < 1e-12); res.tg_undoSame = same([A, B]);
    /* B makes the emblem, A sets it spinning: the turn is the same on both (A's frames are the room's clock) */
    B.vs.makeEmblem({ at: new V3(0.5, 1.3, -0.6) }); await settle(); const eA = A.vs.assets().find(a => a.kind === 'emblem'), eB = B.vs.assets().find(a => a.kind === 'emblem');
    res.tg_emblemBoth = b(!!eA && !!eB); if (eA) { A.vs.spin(eA.object, 6); await settle(); await together([[A, () => []], [B, () => []]], 40); res.tg_spinTurned = b(eA.object.quaternion.angleTo(new Q()) > 0.05); res.tg_spinSame = b(eA.object.quaternion.angleTo(eB.object.quaternion) < 1e-9); }
    /* B brushes the figure: a shape key on both figures, the skeleton untouched */
    const body = B.F.body, P = body.geometry.attributes.position; let bi = 0, bz = -1; for (let i = 0; i < P.count; i++) if (Math.abs(P.getY(i) - 1.25) < 0.04 && P.getZ(i) > bz) { bz = P.getZ(i); bi = i; } const onBody = new V3().fromBufferAttribute(P, bi).applyMatrix4(body.matrixWorld);
    B.vs.set.mode('inflate'); B.vs.set.size(4); await together([[B, () => [hand('r', onBody, true)]]], 14);
    const kA = A.F.body.morphTargetDictionary, kB = body.morphTargetDictionary; res.tg_figKeyBoth = b(Object.keys(kA).length === Object.keys(kB).length && Object.keys(kA).length > 1); res.tg_figSame = same([A, B]);
    if (!res.tg_figSame) { const ma = [], mb = []; A.F.root.traverse(o => { if (o.isMesh) ma.push(o); }); B.F.root.traverse(o => { if (o.isMesh) mb.push(o); }); res.tg_figDbg = ma.map((m, i) => { const n = mb[i], g = m.geometry, h = n.geometry, d = (x, y) => { if (!x || !y || x.length !== y.length) return 'len ' + (x && x.length) + '/' + (y && y.length); let mx = 0; for (let k = 0; k < x.length; k++) mx = Math.max(mx, Math.abs(x[k] - y[k])); return mx; }; return m.name + ' pos ' + d(g.attributes.position.array, h.attributes.position.array) + ' morph ' + (g.morphAttributes.position || []).map((t, k) => d(t.array, (h.morphAttributes.position || [])[k] && h.morphAttributes.position[k].array)).join('/') + ' col ' + d(g.attributes.color && g.attributes.color.array, h.attributes.color && h.attributes.color.array); }).join(' | '); }
    res.tg_msgBytes = Math.round(relay.bytes / Math.max(1, relay.sent));
    /* the emblem BY HAND, together (Ruth 2026-10-14: "if the tools can make that with me in headset with at least one collaborator"): A draws the blue figure's rod while B draws the orange one,
       each pulls out a head with Ball, A joins the four pieces into one and sets it spinning */
    { const { EMBLEM } = await import('/pe_lib/sculpt_next_emblem.js'), sc = 0.42 / 1180, O = new V3(-0.6, 1.3, -0.7), toW = p => new V3((p[0] - 625) * sc, (640 - p[1]) * sc, p[2] * sc).add(O);
      const along = (pts, n) => { const w = pts.map(toW), L = [0]; for (let i = 1; i < w.length; i++) L.push(L[i - 1] + w[i].distanceTo(w[i - 1])); return Array.from({ length: n }, (_, k) => { const d = L[L.length - 1] * k / (n - 1); let i = 1; while (i < L.length - 1 && L[i] < d) i++; return w[i - 1].clone().lerp(w[i], (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1)); }); };
      const blue = EMBLEM.parts.find(p => p.name === 'Blue figure'), orange = EMBLEM.parts.find(p => p.name === 'Orange figure'), bh = EMBLEM.parts.find(p => p.name === 'Blue head'), oh = EMBLEM.parts.find(p => p.name === 'Orange head');
      const pa = along(blue.pts, 70), pb = along(orange.pts, 70), n0 = A.vs.assets().length;
      A.vs.set.mode('rod'); A.vs.set.gradient('emblem blue'); A.vs.set.size(blue.wide * sc * 50); A.vs.set.rodTwist(180); B.vs.set.mode('rod'); B.vs.set.gradient('emblem orange'); B.vs.set.size(orange.wide * sc * 50); B.vs.set.rodTwist(180);
      const fmE = await together([[A, i => (i < 70 ? [hand('r', pa[i], true)] : [])], [B, i => (i < 70 ? [hand('r', pb[i], true)] : [])]], 72);
      const head = (p, part, i) => { const c = toW(part.c), r = part.r * sc; return [hand('r', i < 8 ? c.clone().add(new V3(r * i / 7, 0, 0)) : c.clone().add(new V3(r, 0, 0)), i < 8)]; };
      A.vs.set.mode('ball'); B.vs.set.mode('ball'); await together([[A, i => head(A, bh, i)], [B, i => head(B, oh, i)]], 10);
      res.tg_handPieces = A.vs.assets().length - n0; res.tg_handPiecesBoth = b(B.vs.assets().length === A.vs.assets().length); res.tg_handFrameMs = st(fmE);
      const rodsA = A.vs.assets().filter(x => x.kind === 'rod').slice(-2); res.tg_handRodTris = rodsA.map(x => x.object.geometry.index.count / 3).join('+');
      const cA = rodsA[0] && rodsA[0].object.geometry.attributes.color.array; if (cA) { let r = 0, g = 0, bb = 0; for (let i = 0; i < cA.length; i += 3) { r += cA[i]; g += cA[i + 1]; bb += cA[i + 2]; } res.tg_handBlueIsBlue = b(bb > r * 1.3); }
      const emb = A.vs.assets().find(x => x.kind === 'emblem'); if (emb) { A.vs.spin(emb.object, 0); await together([[A, () => []]], 90); emb.object.parent.remove(emb.object); B.vs.assets().filter(x => x.kind === 'emblem').forEach(x => x.object.parent && x.object.parent.remove(x.object)); }   /* the button-made emblem out of the way: only the hand-made pieces are joined */
      A.vs.joinPieces(); await settle(); const pcA = A.vs.assets().find(x => x.kind === 'piece'), pcB = B.vs.assets().find(x => x.kind === 'piece');
      let meshes = 0; if (pcA) pcA.object.traverse(o => { if (o.isMesh) meshes++; }); res.tg_handJoined = b(!!pcA && !!pcB); res.tg_handJoinedMeshes = meshes;
      if (pcA) { A.vs.spin(pcA.object, 8); await settle(); await together([[A, () => []], [B, () => []]], 60); res.tg_handSpinBoth = b(A.vs.motion.spinning(pcA.object) && B.vs.motion.spinning(pcB.object) && pcA.object.quaternion.angleTo(pcB.object.quaternion) < 1e-9 && pcA.object.quaternion.angleTo(new Q()) > 0.05);
        A.vs.spin(pcA.object, 0); await settle(); await together([[A, () => []], [B, () => []]], 100); }
      res.tg_handSame = same([A, B]);
      if (pcA) { const ex = await A.vs.exportGlb([pcA.object], {}), gl = await new Promise((ok, no) => new ctx.Loader().parse(ex.buffer, '', ok, no)); let m = 0; gl.scene.traverse(o => { if (o.isMesh) m++; }); res.tg_handGlbMeshes = m; }
      /* dressing it together: A lays its own gradient (built as the wheel would) as marble over the piece while B gives it the pearl look, 30% see-through */
      if (pcA) { const bb = new T.Box3().setFromObject(pcA.object), p0 = new V3(bb.min.x, (bb.min.y + bb.max.y) / 2, bb.max.z), p1 = new V3(bb.max.x, (bb.min.y + bb.max.y) / 2, bb.max.z), rodC = pcA.object.children.find(o => /^Rod/.test(o.name)), rc = new T.Box3().setFromObject(rodC).getCenter(new V3());
        A.vs.set.gradCustom('#ff2a6d@0,#ffd319@0.5,#05d9e8@1'); A.vs.set.gradient('custom'); A.vs.set.skin('marble'); A.vs.set.mode('gradient'); A.vs.set.size(3); B.vs.set.finish('pearl'); B.vs.set.alpha(0.7); B.vs.set.mode('look');
        const near = fig => { let best = null, bd = 1e9; pcA.object.traverse(o => { if (o.isMesh && /^Rod/.test(o.name)) { const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i += 37) { const w = new V3().fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld), d = w.distanceTo(fig); if (d < bd) { bd = d; best = w; } } } }); return best; };
        const s0 = near(rc); await together([[A, i => (i < 8 ? [hand('r', s0.clone().add(new V3(0.004 * i, 0, 0)), true)] : [])], [B, i => (i < 3 ? [hand('r', s0.clone(), true)] : [])]], 10); await settle(); void p0; void p1;
        const mats = x => { const out = []; x.object.traverse(o => { if (o.isMesh) out.push((o.material.userData.look || '-') + (o.material.transparent ? '~' : '')); }); return out.join(','); };
        res.tg_dressLooks = mats(pcA); res.tg_dressSameLooks = b(mats(pcA) === mats(pcB)); res.tg_dressPearl = b(/pearl~/.test(mats(pcA))); res.tg_dressSame = same([A, B]); } }
    /* four: C and D join and everyone draws at once */
    const Cp = mk('C'), D = mk('D'); Cp.vs.together.start({ transport: relay.connect() }); await settle(); D.vs.together.start({ transport: relay.connect() }); await settle();
    res.tg_people4 = b([A, B, Cp, D].every(p => p.vs.together.people().length === 4)); res.tg_join4Same = same([A, B, Cp, D]);
    [A, B, Cp, D].forEach(p => { p.vs.set.mode('clay'); p.vs.set.size(1.5); });
    const fm4 = await together([A, B, Cp, D].map((p, k) => [p, i => [hand('r', new V3(-0.1 + i * 0.008, 1.32 + k * 0.03, -0.5), i < 25)]]), 27);
    res.tg_four = same([A, B, Cp, D]); res.tg_frameMs4 = st(fm4); res.tg_names = Cp.vs.together.people().map(x => x.name).join(',');
    /* B leaves: the others carry on, three of them */
    B.vs.together.stop(); await settle(); res.tg_leave = b([A, Cp, D].every(p => p.vs.together.people().length === 3));
    /* a headset that drifted (here: a brick wiped by hand) is matched again by the checksum round */
    const LC = Cp.vs.clay.layerById(L.id); LC.field.bricks.delete([...LC.field.bricks.keys()][0]); res.tg_drifted = b(!same([A, Cp, D]));
    for (let r = 0; r < 4 && !same([A, Cp, D]); r++) await together([A, Cp, D].map(p => [p, () => []]), 180);
    res.tg_healed = same([A, Cp, D]);
    [A, Cp, D].forEach(p => p.vs.together.stop()); await settle(); peers.forEach(p => { cleanup(p.vs); scene.remove(p.world); });
  });

  /* ---------- two people as avatars, each in their own look, sculpting together (Ruth 2026-10-14: "two people in the make human avatars with a shader on each creating together") ---------- */
  await section('avatars', async () => {
    const { makeLocalRelay } = await import('/pe_lib/sculpt_next_collab.js'), { makeTestFigure, makeTestMakeHuman } = await import('/pe_lib/sculpt_next_testkit.js'), relay = makeLocalRelay(), people = [];
    const lookFrom = (eye, at) => new Q().setFromRotationMatrix(new T.Matrix4().lookAt(eye, at, new V3(0, 1, 0)));
    const mk = (name, head, loads) => { const world = new T.Group(); scene.add(world); const F = makeTestFigure(T); world.add(F.root); const pose = { p: head.clone(), q: lookFrom(head, new V3(0, 1.3, -0.5)) }, says = [];
      const vs = ctx.createVrSculpt(T, null, mkHost({ figure: () => F.root, say: t => says.push(t), addObject: o => { if (!o.parent) world.add(o); }, head: () => ({ p: pose.p.clone(), q: pose.q.clone() }), loadAvatar: loads }));
      vs.enter(F.root); vs.set.stabilize(0); const p = { name, vs, world, pose, says }; people.push(p); return p; };
    let loaded = 0; const A = mk('Ruth', new V3(0, 1.6, 0.05), url => { loaded++; return url === 'test:makehuman' ? makeTestMakeHuman(T).root : null; }), B = mk('Sam', new V3(0.4, 1.55, -0.78), () => null);
    const tick = () => new Promise(r => setTimeout(r, 0)), settle = async () => { for (let k = 0; k < 2000; k++) { await tick(); people.forEach(p => p.vs.flush()); if (relay.idle() && people.every(p => p.vs.together.waiting === 0)) { await tick(); if (relay.idle()) return; } } };
    A.vs.set.avatarLook('glow'); A.vs.set.avatarGradient('sunset'); B.vs.set.avatarLook('pearl'); B.vs.set.avatarUrl('test:makehuman');
    A.vs.together.start({ transport: relay.connect(), name: 'Ruth' }); await settle(); B.vs.together.start({ transport: relay.connect(), name: 'Sam' }); await settle();
    /* both sculpt the emblem's parts at once: Ruth a clay lump, Sam a rod; their heads bob a little as people's do */
    A.vs.set.mode('clay'); A.vs.set.size(2); B.vs.set.mode('rod'); B.vs.set.gradient('emblem orange'); B.vs.set.size(2);
    const handA = i => new V3(-0.08 + i * 0.004, 1.3, -0.42), handB = i => new V3(0.12 + Math.cos(i / 59 * Math.PI) * 0.08, 1.25 + Math.sin(i / 59 * Math.PI) * 0.12, -0.6), fm = [];
    for (let i = 0; i < 70; i++) {
      A.pose.p.y = 1.6 + Math.sin(i / 9) * 0.01; B.pose.p.y = 1.55 + Math.cos(i / 11) * 0.01;
      let t = now(); A.vs.frame(i < 60 ? [hand('r', handA(i), true), hand('l', new V3(-0.25, 1.15, -0.25), false)] : [hand('r', handA(59), false)], 0.016); fm.push(now() - t);
      t = now(); B.vs.frame(i < 60 ? [hand('r', handB(i), true)] : [hand('r', handB(59), false)], 0.016); fm.push(now() - t); await tick();
    }
    for (let i = 0; i < 40; i++) { A.vs.frame([hand('r', handA(59), false), hand('l', new V3(-0.25, 1.15, -0.25), false)], 0.016); B.vs.frame([hand('r', handB(59), false)], 0.016); await tick(); } await settle();
    res.av_frameMs = st(fm); res.av_same = b(A.vs.together.checksum() === B.vs.together.checksum()); res.av_made = b(A.vs.clay.works.some(w => w.layers.length) && A.vs.assets().some(a => a.kind === 'rod') && B.vs.assets().some(a => a.kind === 'rod'));
    /* on Ruth's headset: Sam is his MakeHuman figure, in pearl, head where his head is, right wrist at his hand */
    const onA = A.vs.together.avatars(), sam = onA[0]; res.av_onRuth = onA.map(a => a.kind + ':' + a.look).join(','); res.av_loads = loaded;
    if (sam && sam.av.ok) { const hb = new V3().setFromMatrixPosition(sam.av.bones.head.matrixWorld); res.av_samHeadCm = r2(hb.distanceTo(B.pose.p) * 100); const w = sam.av.wrist('R') || sam.av.wrist('L'); res.av_samWristCm = r2(w.distanceTo(handB(59)) * 100); res.av_samRigged = b(sam.kind === 'rigged' && res.av_samHeadCm < 8 && res.av_samWristCm < 4); }
    /* on Sam's headset: Ruth is the built-in figure, glowing in sunset, head and right hand where hers are */
    const onB = B.vs.together.avatars(), ruth = onB[0]; res.av_onSam = onB.map(a => a.kind + ':' + a.look).join(',');
    if (ruth) { const P = ruth.av.parts; res.av_ruthHeadCm = r2(P.head.position.distanceTo(A.pose.p) * 100); const hr = [P.handR.position, P.handL.position].map(p => p.distanceTo(handA(59))); res.av_ruthHandCm = r2(Math.min(...hr) * 100);
      const C = P.torso.geometry.attributes.color.array; let rr = 0, bb = 0; for (let i = 0; i < C.length; i += 3) { rr += C[i]; bb += C[i + 2]; } res.av_ruthSunset = b(rr > bb); res.av_ruthOk = b(res.av_ruthHeadCm < 3 && res.av_ruthHandCm < 3 && ruth.look === 'glow'); res.av_tris = ruth.av.tris(); }
    /* changing your look while together: the others see it change */
    A.vs.set.avatarLook('chrome'); for (let i = 0; i < 6; i++) { A.vs.frame([], 0.016); B.vs.frame([], 0.016); await tick(); } await settle(); B.vs.frame([], 0.016); res.av_lookChanges = b(B.vs.together.avatars()[0].look === 'chrome');
    B.vs.together.stop(); await settle(); for (let i = 0; i < 3; i++) { A.vs.frame([], 0.016); await tick(); } res.av_leaveRemoves = b(A.vs.together.avatars().length === 0);
    A.vs.together.stop(); await settle(); people.forEach(p => { cleanup(p.vs); scene.remove(p.world); });
  });

  /* ---------- Substance 3D Modeler's controller layout (Ruth 2026-10-14, with Adobe's controller map) ---------- */
  await section('controls', async () => {
    const vs = fresh(), sleep = ms => new Promise(r => setTimeout(r, ms)), none = { top: false, bottom: false, click: false, x: 0, y: 0 }, S = (role, o) => vs.controls(role, Object.assign({}, none, o), 0.016);
    const tapB = (role, k, o) => { S(role, Object.assign({ [k]: true }, o || {})); return S(role, o || {}); }, flick = (role, x, y) => { S(role, { x, y }); S(role, {}); };
    res.ct_default = vs.cfg.controls;
    vs.set.mode('clay'); vs.set.size(2); vs.set.tint(1); run(vs, line(new V3(-0.1, 1.2, -0.5), new V3(0.05, 1.2, -0.5), 16)); const L = vs.clay.active, v1 = vol(L);
    flick('support', -0.9, 0); res.ct_undo = b(vol(L) === 0); flick('support', 0.9, 0); res.ct_redo = b(Math.abs(vol(L) - v1) < 1e-12);
    const s0 = vs.cfg.size; for (let i = 0; i < 40; i++) S('tool', { y: -0.9 }); S('tool', {}); const s1 = vs.cfg.size; for (let i = 0; i < 40; i++) S('tool', { y: 0.9 }); S('tool', {}); res.ct_sizeUpDown = b(s1 > s0 * 1.3 && vs.cfg.size < s1 * 0.8); res.ct_sizes = [s0, r2(s1), r2(vs.cfg.size)].join(' -> ');
    vs.set.falloff('smooth'); flick('tool', 0.9, 0); const f1 = vs.cfg.falloff; flick('tool', 0.9, 0); res.ct_hardness = b(f1 === 'linear' && vs.cfg.falloff === 'sharp'); flick('tool', -0.9, 0);
    tapB('tool', 'bottom'); const op1 = vs.cfg.op; tapB('tool', 'bottom'); res.ct_partner = b(op1 === 'subtract' && vs.cfg.op === 'add');
    tapB('support', 'top'); const m1 = vs.cfg.mode; tapB('support', 'top'); res.ct_gizmoFree = b(m1 === 'prim' && vs.cfg.mode === 'clay');
    const pShow = S('support', { bottom: true }); await sleep(450); const pHide = S('support', {}); res.ct_paletteHold = b(pShow.palette === 'show' && pHide.palette === 'hide');
    S('support', { bottom: true }); const pin = S('support', {}); const tap2a = S('support', { bottom: true }), tap2b = S('support', {}); res.ct_paletteTapPins = b(!pin.palette && tap2b.palette === 'hide' && !tap2a.palette);
    S('support', { bottom: true }); await sleep(40); const pg = (() => { S('tool', { x: 0.9 }); const r = S('tool', { x: 0.9 }); S('tool', {}); return r; })(); const pgFirst = (() => { S('tool', {}); const r = S('tool', { x: 0.9 }); S('tool', {}); return r; })(); await sleep(400); S('support', {}); res.ct_palettePages = b(pgFirst.page === 'step:1' || pg.page === 'step:1');
    res.ct_freeze = b(tapB('tool', 'click') && S('tool', { click: true }).freeze === false || (() => { S('tool', {}); return S('tool', { click: true }).freeze; })());
    /* colour pick: the support stick click arms it; the next pinch on the clay takes its colour and does not sculpt */
    vs.set.rgb('#000000'); const n0 = vs.strokes(); tapB('support', 'click'); const onClay = new V3(-0.02, 1.2 + 0.0185, -0.5); vs.frame([hand('r', onClay, true)], 0.016); vs.frame([hand('r', onClay, true)], 0.016); vs.frame([hand('r', onClay, false)], 0.016); vs.flush();
    const want = '#' + L.field.colorAt(...L.group.worldToLocal(onClay.clone()).toArray()).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); res.ct_pickColour = b(vs.cfg.rgb === want && vs.strokes() === n0); res.ct_picked = vs.cfg.rgb + ' / ' + want;
    /* T1: a tap selects the layer under the tool hand; hold and move up = more strength */
    const L2 = vs.clay.addLayer(); vs.clay.pickLayer(L2); S('tool', { top: true, tip: onClay }); S('tool', { tip: onClay }); res.ct_selectLayer = b(vs.clay.active === L);
    vs.set.strength(30); S('tool', { top: true, tip: onClay }); for (let i = 1; i <= 10; i++) S('tool', { top: true, tip: onClay.clone().add(new V3(0, i * 0.006, 0)) }); S('tool', { tip: onClay }); res.ct_quicktune = b(vs.cfg.strength > 45); res.ct_strength = vs.cfg.strength;
    /* support stick up / down: scope into the layer under the hand, out to the whole work */
    S('support', { y: -0.9, tip: onClay }); S('support', {}); const inW = vs.cfg.holdWhat; S('support', { y: 0.9 }); S('support', {}); res.ct_scope = b(inW === 'layer' && vs.cfg.holdWhat === 'work');
    /* tooltips: a thumb resting on a button for half a second says what it does */
    const nSay = sayLog.length; S('tool', { touchTop: true }); await sleep(560); S('tool', { touchTop: true }); res.ct_tooltip = b(sayLog.slice(nSay).some(t => /Tool hand, top button/.test(t)));
    vs.set.controls('atelier'); res.ct_atelierOff = b(vs.controls('tool', Object.assign({}, none, { bottom: true }), 0.016) === null); vs.set.controls('substance');
    res.ct_mapLines = vs.controlMap.length; cleanup(vs);
  });

  /* ---------- from the Quest collaborative-creation report (Ruth 2026-10-14): Draw strokes, Keep work, your stroke at once, who made what, dropping out and rejoining ---------- */
  await section('report', async () => {
    const tick = () => new Promise(r => setTimeout(r, 0));
    { const vs = fresh(); vs.set.mode('rod'); vs.set.size(1.5); vs.set.rodEnd('blunt'); vs.set.rodTwist(0); const dims = {};
      for (const pf of ['tube', 'ribbon', 'ink']) { vs.set.rodProfile(pf); vs.set.mode('rod'); const z = -0.5 - Object.keys(dims).length * 0.1; run(vs, line(new V3(-0.15, 1.3, z), new V3(0.15, 1.3, z), 30)); const a = vs.assets().pop(), g = a.object.geometry; g.computeBoundingBox(); const sz = g.boundingBox.getSize(new V3()); dims[pf] = { name: a.name, y: r2(sz.y * 1000), z: r2(sz.z * 1000) }; }
      res.rp_draw = Object.entries(dims).map(([k, v]) => v.name + ' ' + v.y + 'x' + v.z + 'mm').join(', ');
      res.rp_tubeRound = b(Math.abs(dims.tube.y - dims.tube.z) < 2 && dims.tube.y > 25); res.rp_ribbonFlat = b(Math.min(dims.ribbon.y, dims.ribbon.z) < 4 && Math.max(dims.ribbon.y, dims.ribbon.z) > 25); res.rp_inkFine = b(Math.max(dims.ink.y, dims.ink.z) < 10);
      /* keep work: clay and rods kept, everything taken away, opened again identical */
      vs.set.mode('clay'); vs.set.size(2); run(vs, line(new V3(-0.1, 1.15, -0.5), new V3(0.1, 1.15, -0.5), 16)); vs.flush(); const parts0 = vs.together.checksum(true), nA = vs.assets().length;
      vs.keepWork('Test work'); for (let i = 0; i < 200 && !(vs.keptWorks().some(k => k.name === 'Test work')); i++) { vs.flush(); await new Promise(r => setTimeout(r, 20)); }
      const list = vs.keptWorks(); res.rp_kept = b(list.some(k => k.name === 'Test work')); res.rp_keptKB = list[0] ? Math.round(list[0].bytes / 1024) : -1;
      while (vs.canUndo()) vs.undo(); vs.flush(); res.rp_emptied = b(!vs.assets().length && !vs.clay.works.some(w => w.group.parent && w.layers.length));
      vs.openWork(list[0].id); for (let i = 0; i < 200 && vs.assets().length < nA; i++) { vs.flush(); await new Promise(r => setTimeout(r, 20)); } vs.flush();
      const parts1 = vs.together.checksum(true); res.rp_reopened = b(vs.assets().length === nA && parts1.clay === parts0.clay && parts1.assets === parts0.assets); res.rp_reopenClay = b(vs.clay.works.some(w => w.group.parent && w.layers.length));
      vs.forgetWork(list[0].id); cleanup(vs); vs.assets().forEach(a => a.object.parent && a.object.parent.remove(a.object)); }
    /* together over a relay with 60 ms each way: your stroke shows at once as a line, then the real rod; whose rod it is travels with it; Sam drops out mid-stroke and comes back */
    { const { makeLocalRelay } = await import('/pe_lib/sculpt_next_collab.js'), relay = makeLocalRelay({ delay: 60 }), worlds = [];
      const mk = name => { const world = new T.Group(); scene.add(world); worlds.push(world); const vs = ctx.createVrSculpt(T, null, mkHost({ say: () => {}, addObject: o => { if (!o.parent) world.add(o); } })); vs.enter(null); vs.set.stabilize(0); return vs; };
      const A = mk('Ruth'), B = mk('Sam'), both = [A, B], settle = async () => { for (let k = 0; k < 3000; k++) { await new Promise(r => setTimeout(r, 5)); both.forEach(v => { if (v.together.on) v.flush(); }); if (relay.idle() && both.every(v => !v.together.on || v.together.waiting === 0)) { await new Promise(r => setTimeout(r, 70)); if (relay.idle()) return; } } };
      A.together.start({ transport: relay.connect(), name: 'Ruth' }); await settle(); B.together.start({ transport: relay.connect(), name: 'Sam' }); await settle();
      A.set.mode('rod'); A.set.size(1.5); await settle(); let seenAtOnce = 0; for (let i = 0; i < 6; i++) { A.frame([hand('r', new V3(-0.1 + i * 0.02, 1.3, -0.5), true)], 0.016); if (i >= 1) seenAtOnce = Math.max(seenAtOnce, A.together.previewPoints()); }
      res.rp_previewAtOnce = b(seenAtOnce >= 2 && !A.assets().length); for (let i = 6; i < 24; i++) { A.frame([hand('r', new V3(-0.1 + i * 0.02, 1.3, -0.5), i < 22)], 0.016); await tick(); } await settle(); A.frame([], 0.016);
      res.rp_previewClears = b(A.together.previewPoints() === 0 && A.assets().length === 1); const ra = A.assets()[0], rb = B.assets()[0]; res.rp_author = b(ra && rb && ra.object.userData.author === 'Ruth' && rb.object.userData.author === 'Ruth');
      if (ra) { const ex = await A.exportGlb([ra.object], {}), gl = await new Promise((ok, no) => new ctx.Loader().parse(ex.buffer, '', ok, no)); let au = null; gl.scene.traverse(o => { if (o.userData && o.userData.author) au = o.userData.author; }); res.rp_authorInGlb = b(au === 'Ruth'); }
      /* Sam drops out in the middle of a clay stroke, then joins again */
      B.set.mode('clay'); B.set.size(2); await settle(); for (let i = 0; i < 10; i++) { B.frame([hand('r', new V3(-0.05 + i * 0.01, 1.15, -0.5), true)], 0.016); A.frame([], 0.016); await tick(); }
      B.together.stop(); await settle(); for (let i = 0; i < 4; i++) { A.frame([], 0.016); await tick(); } await settle(); const keptOnA = A.clay.works.some(w => w.group.parent && w.layers.length);
      B.together.start({ transport: relay.connect(), name: 'Sam' }); await settle(); for (let i = 0; i < 4; i++) { A.frame([], 0.016); B.frame([], 0.016); await tick(); } await settle();
      res.rp_rejoin = b(keptOnA && B.together.state === 'synced' && A.together.people().length === 2 && A.together.checksum() === B.together.checksum());
      both.forEach(v => v.together.stop()); await settle(); both.forEach(v => cleanup(v)); worlds.forEach(w => scene.remove(w)); }
  });

  /* ---------- the menu pages, icons and lessons ---------- */
  await section('menu', async () => {
    const vs = fresh(), host = ['inflateIc', 'smoothIc', 'grabIc', 'brushSize', 'strengthBars', 'symOff', 'symMirror', 'symRound', 'undoStroke', 'redoStroke', 'undo', 'floppy', 'eye', 'lock', 'cutIc', 'carveIc'], has = ic => ic in vs.icons || host.includes(ic);
    let rows = 0, bad = []; const ui = { draw() {}, page() {}, say() {} };
    vs.menu.pages.forEach(pg => vs.menu(pg, ui).forEach(r => { rows++; if (!r.label || !has(r.ic)) bad.push(r.label + ':' + r.ic); }));
    res.u_rows = rows; res.u_iconsOk = b(!bad.length); if (bad.length) res.u_badIcons = bad.join(' | '); res.u_titles = vs.menu.order.map(p => vs.menuTitle(p)).join(',');
    res.u_lessons = vs.lessons.length; res.u_lessonsOneStep = b(vs.lessons.every(l => l.steps.length === 1 && l.steps[0].text && has(l.steps[0].tile.ic)));
    let ran = 0; try { vs.menu(10, ui).filter(r => /^(Mode|Colour|Size|Strength|Symmetry|Steady|Edge)/.test(r.label)).forEach(r => { r.act(); ran++; }); vs.menu(11, ui).filter(r => /^(Shape:|Blend|Hold:|Clay on)/.test(r.label)).forEach(r => { r.act(); ran++; }); } catch (e) { res.u_actError = String(e.message); }
    res.u_actsRun = ran; res.u_tiles = vs.tiles.length; res.u_svgParse = b(Object.values(vs.icons).every(s => { try { return new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + s + '</svg>', 'image/svg+xml').getElementsByTagName('parsererror').length === 0; } catch (e) { return false; } }));
    cleanup(vs);
  });
  res.n_sayLines = sayLog.length;
  return res;
}
