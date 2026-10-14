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
    const vs = fresh(); const t0 = now(), e = vs.makeEmblem({ at: new V3(0, 1.3, -0.6) }), g = e.object; res.em_buildMs = Math.round(now() - t0);
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

  /* ---------- the menu pages, icons and lessons ---------- */
  await section('menu', async () => {
    const vs = fresh(), host = ['inflateIc', 'smoothIc', 'grabIc', 'brushSize', 'strengthBars', 'symOff', 'symMirror', 'symRound', 'undoStroke', 'redoStroke', 'undo', 'floppy', 'eye', 'lock', 'cutIc', 'carveIc'], has = ic => ic in vs.icons || host.includes(ic);
    let rows = 0, bad = []; const ui = { draw() {}, page() {}, say() {} };
    [10, 11, 12, 13].forEach(pg => vs.menu(pg, ui).forEach(r => { rows++; if (!r.label || !has(r.ic)) bad.push(r.label + ':' + r.ic); }));
    res.u_rows = rows; res.u_iconsOk = b(!bad.length); if (bad.length) res.u_badIcons = bad.join(' | '); res.u_titles = [10, 11, 12, 13].map(p => vs.menuTitle(p)).join(',');
    res.u_lessons = vs.lessons.length; res.u_lessonsOneStep = b(vs.lessons.every(l => l.steps.length === 1 && l.steps[0].text && has(l.steps[0].tile.ic)));
    let ran = 0; try { vs.menu(10, ui).filter(r => /^(Mode|Colour|Size|Strength|Symmetry|Steady|Edge)/.test(r.label)).forEach(r => { r.act(); ran++; }); vs.menu(11, ui).filter(r => /^(Shape:|Blend|Hold:|Clay on)/.test(r.label)).forEach(r => { r.act(); ran++; }); } catch (e) { res.u_actError = String(e.message); }
    res.u_actsRun = ran; res.u_tiles = vs.tiles.length; res.u_svgParse = b(Object.values(vs.icons).every(s => { try { return new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + s + '</svg>', 'image/svg+xml').getElementsByTagName('parsererror').length === 0; } catch (e) { return false; } }));
    cleanup(vs);
  });
  res.n_sayLines = sayLog.length;
  return res;
}
