/* sculpt_next_surface.js: the brushes for things that are already triangles (figures, clothes, props, squeezed tubes). A figure keeps its skeleton, skin weights and shape keys because these brushes only
   move points, and on a figure they move them inside a SHAPE KEY (a slider from 0 to 1 that saves in the .glb), never the rest shape the bones were bound to.
   makeSculpt(THREE) is a drop-in for bst_sculpt_core.js (same prepare / near / stroke / finish / swap / grabBegin / grabMove / volume / dabs), so the desktop BST could use it too, with these changes:
   - the grid uses number keys, not strings (the old one built a string per cell per lookup);
   - a brush reads the shape AS YOU SEE IT (rest + every key at its strength, st.eff), so Smooth really smooths a bump you just inflated (the old core read the rest shape only);
   - new brushes, matching Substance 3D Modeler: clay (build up to a flat top), flatten, scrape, fill, pinch (crease), smear, dots (a stamp repeated along the stroke), paint (vertex colour);
   - every brush has a sign (+1 add, -1 subtract) and a falloff (smooth, linear, sharp, flat). */
const FALL = {
  smooth: t => { if (t >= 1) return 0; const u = 1 - t * t; return u * u; },
  linear: t => (t >= 1 ? 0 : 1 - t),
  sharp: t => { if (t >= 1) return 0; const u = 1 - t; return u * u * u; },
  flat: t => (t >= 1 ? 0 : t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4),
};
export const DOTS = ['ball', 'ring', 'cube', 'spike'];
export function makeSculpt(THREE) {
  const V3 = THREE.Vector3;
  const OFS = 1 << 10, SP = 1 << 11, ck = (i, j, k) => ((i + OFS) * SP + (j + OFS)) * SP + (k + OFS);

  /* ---------- prepare: welded groups (points at one place, e.g. uv seams, move together), neighbours, triangles per group, the shape as seen, a grid ---------- */
  function prepare(geometry, influences) {
    const pos = geometry.attributes.position, n = pos.count, A = pos.array;
    geometry.computeBoundingBox(); const bb = geometry.boundingBox, size = bb.getSize(new V3());
    /* points at the same place (to 0.01 mm) are one group: a number hash with an exact check (text keys were most of this function's time) */
    const q = 1e-5, weld = new Map(), group = new Int32Array(n), first = [], QX = new Int32Array(n), QY = new Int32Array(n), QZ = new Int32Array(n), chain = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      const x = QX[i] = Math.round(A[i * 3] / q), y = QY[i] = Math.round(A[i * 3 + 1] / q), z = QZ[i] = Math.round(A[i * 3 + 2] / q), h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) | 0;
      let g = -1, c = weld.get(h); const head = c === undefined ? -1 : c; for (let j = head; j >= 0; j = chain[j]) { const f = first[j]; if (QX[f] === x && QY[f] === y && QZ[f] === z) { g = j; break; } }
      if (g < 0) { g = first.length; first.push(i); chain[g] = head; weld.set(h, g); } group[i] = g;
    }
    const G = first.length, mcount = new Int32Array(G + 1); for (let i = 0; i < n; i++) mcount[group[i] + 1]++; for (let g = 0; g < G; g++) mcount[g + 1] += mcount[g];
    const mitems = new Int32Array(n), fill = mcount.slice(0, G); for (let i = 0; i < n; i++) mitems[fill[group[i]]++] = i;
    const members = []; for (let g = 0; g < G; g++) members.push(mitems.subarray(mcount[g], mcount[g + 1]));
    const idx = geometry.index ? geometry.index.array : null, triN = (idx ? idx.length : n) / 3, TG = new Int32Array(triN * 3);
    for (let t = 0; t < triN * 3; t++) TG[t] = group[idx ? idx[t] : t];
    /* neighbours: every triangle's six directed edges, counted, filled and de-duplicated per group into one packed array (no Set per group) */
    const tcount = new Int32Array(G + 1), ecount = new Int32Array(G + 1);
    for (let t = 0; t < triN; t++) { const a = TG[t * 3], b = TG[t * 3 + 1], c = TG[t * 3 + 2]; ecount[a + 1] += 2; ecount[b + 1] += 2; ecount[c + 1] += 2; tcount[a + 1]++; tcount[b + 1]++; tcount[c + 1]++; }
    for (let g = 0; g < G; g++) ecount[g + 1] += ecount[g]; const eitems = new Uint32Array(ecount[G]), ef = ecount.slice(0, G);
    for (let t = 0; t < triN; t++) { const a = TG[t * 3], b = TG[t * 3 + 1], c = TG[t * 3 + 2]; eitems[ef[a]++] = b; eitems[ef[a]++] = c; eitems[ef[b]++] = a; eitems[ef[b]++] = c; eitems[ef[c]++] = a; eitems[ef[c]++] = b; }
    const nbAll = new Uint32Array(ecount[G]), nb = new Array(G); let w = 0;
    for (let g = 0; g < G; g++) { const s0 = w, seg = eitems.subarray(ecount[g], ecount[g + 1]); seg.sort(); for (let k = 0; k < seg.length; k++) if ((k === 0 || seg[k] !== seg[k - 1]) && seg[k] !== g) nbAll[w++] = seg[k]; nb[g] = nbAll.subarray(s0, w); }
    for (let g = 0; g < G; g++) tcount[g + 1] += tcount[g]; const titems = new Int32Array(tcount[G]), tf = tcount.slice(0, G);
    for (let t = 0; t < triN; t++) for (let k = 0; k < 3; k++) titems[tf[TG[t * 3 + k]]++] = t;
    const st = { geometry, n, G, group, members, first: Int32Array.from(first), nb, TG, tcount, titems, cell: Math.max(size.x, size.y, size.z) / 48 || 1, origin: bb.min.clone(), grid: null, eff: new Float32Array(G * 3), nrm: new Float32Array(G * 3), influences: influences || null, kind: 'next' };
    computeEff(st); computeNormals(st, null); rebuildGrid(st); return st;
  }
  /* the shape as seen: rest plus each key times its strength (per welded group, read at its first point) */
  function computeEff(st, groups) {
    const g0 = st.geometry, A = g0.attributes.position.array, mp = g0.morphAttributes && g0.morphAttributes.position, inf = st.influences, E = st.eff;
    const one = g => { const i = st.first[g]; let x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2]; if (mp && inf) for (let k = 0; k < mp.length; k++) { const w = inf[k]; if (w) { const a = mp[k].array; x += a[i * 3] * w; y += a[i * 3 + 1] * w; z += a[i * 3 + 2] * w; } } E[g * 3] = x; E[g * 3 + 1] = y; E[g * 3 + 2] = z; };
    if (groups) groups.forEach(one); else for (let g = 0; g < st.G; g++) one(g);
  }
  /* normals of the shape as seen, area weighted, for some groups (and nothing else) or all */
  function computeNormals(st, groups) {
    const E = st.eff, Nn = st.nrm, TG = st.TG;
    const one = g => { let x = 0, y = 0, z = 0; for (let q = st.tcount[g]; q < st.tcount[g + 1]; q++) { const t = st.titems[q], a = TG[t * 3] * 3, b = TG[t * 3 + 1] * 3, c = TG[t * 3 + 2] * 3; const ux = E[b] - E[a], uy = E[b + 1] - E[a + 1], uz = E[b + 2] - E[a + 2], vx = E[c] - E[a], vy = E[c + 1] - E[a + 1], vz = E[c + 2] - E[a + 2]; x += uy * vz - uz * vy; y += uz * vx - ux * vz; z += ux * vy - uy * vx; }
      const L = Math.hypot(x, y, z); if (L > 0) { Nn[g * 3] = x / L; Nn[g * 3 + 1] = y / L; Nn[g * 3 + 2] = z / L; } else { Nn[g * 3] = 0; Nn[g * 3 + 1] = 1; Nn[g * 3 + 2] = 0; } };
    if (groups) groups.forEach(one); else for (let g = 0; g < st.G; g++) one(g);
  }
  function rebuildGrid(st) {   /* one entry per welded group at its place as seen; lo/hi clamp every search to cells that hold points (the 2026-10-11 freeze) */
    const E = st.eff, g = new Map(), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], c = st.cell, o = st.origin;
    for (let k = 0; k < st.G; k++) { const x = Math.floor((E[k * 3] - o.x) / c), y = Math.floor((E[k * 3 + 1] - o.y) / c), z = Math.floor((E[k * 3 + 2] - o.z) / c), kk = ck(x, y, z); let a = g.get(kk); if (!a) { a = []; g.set(kk, a); } a.push(k);
      if (x < lo[0]) lo[0] = x; if (y < lo[1]) lo[1] = y; if (z < lo[2]) lo[2] = z; if (x > hi[0]) hi[0] = x; if (y > hi[1]) hi[1] = y; if (z > hi[2]) hi[2] = z; }
    st.grid = g; st.lo = lo; st.hi = hi;
  }
  function near(st, c, r) {   /* welded groups within r of c (as seen): [[group, distance], ...] */
    const E = st.eff, out = [], r2 = r * r, cl = st.cell, o = st.origin;
    const i0 = Math.max(Math.floor((c.x - r - o.x) / cl), st.lo[0]), i1 = Math.min(Math.floor((c.x + r - o.x) / cl), st.hi[0]), j0 = Math.max(Math.floor((c.y - r - o.y) / cl), st.lo[1]), j1 = Math.min(Math.floor((c.y + r - o.y) / cl), st.hi[1]), k0 = Math.max(Math.floor((c.z - r - o.z) / cl), st.lo[2]), k1 = Math.min(Math.floor((c.z + r - o.z) / cl), st.hi[2]);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) { const a = st.grid.get(ck(i, j, k)); if (!a) continue; for (const g of a) { const dx = E[g * 3] - c.x, dy = E[g * 3 + 1] - c.y, dz = E[g * 3 + 2] - c.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 <= r2) out.push([g, Math.sqrt(d2)]); } }
    return out;
  }

  /* ---------- symmetry: the list of dabs one stroke step makes (mirror across x = 0 of the mesh's own space, radial copies round an axis) ---------- */
  function dabs(c, nrm, sym, dir) {
    let list = [{ c: c.clone(), n: nrm.clone(), dir: dir ? dir.clone() : null, sign: 1 }];
    if (sym && sym.mirror) list = list.concat(list.map(d => ({ c: new V3(-d.c.x, d.c.y, d.c.z), n: new V3(-d.n.x, d.n.y, d.n.z), dir: d.dir ? new V3(-d.dir.x, d.dir.y, d.dir.z) : null, sign: -1 })));
    if (sym && sym.radial && sym.radial.count > 1) {
      const ax = sym.radial.axisVec ? sym.radial.axisVec.clone().normalize() : new V3(...(sym.radial.axis === 'x' ? [1, 0, 0] : sym.radial.axis === 'z' ? [0, 0, 1] : [0, 1, 0])), o = sym.radial.origin ? sym.radial.origin.clone() : new V3(), out = [];
      for (const d of list) for (let k = 0; k < sym.radial.count; k++) { const a = (Math.PI * 2 * k) / sym.radial.count; out.push({ c: d.c.clone().sub(o).applyAxisAngle(ax, a).add(o), n: d.n.clone().applyAxisAngle(ax, a), dir: d.dir ? d.dir.clone().applyAxisAngle(ax, a) : null, sign: d.sign }); }
      list = out;
    }
    return list;
  }

  /* ---------- a dab ----------
     opts: mode, radius, strength (0..1), sign (+1 add, -1 subtract), falloff, sym, down (melt), dir (the stroke's way, for pinch and dots), delta (smear: the hand's move this frame),
           target (null = the rest shape, or a key's Float32Array of deltas), tw (that key's strength, so a change of dl shows as dl), dot (dots: 'ball' | 'ring' | 'cube' | 'spike'), color ([r, g, b] 0..1, paint).
     rec: a Map the dab fills with each point's first value (target or rest) for undo; recC the same for colours. Returns how many welded points moved. */
  function dab(st, c, nrm, opts, rec, recC) {
    const geo = st.geometry, A = geo.attributes.position.array, T = opts.target || null, tw = opts.tw || 1, E = st.eff, Nn = st.nrm, r = opts.radius, s = opts.strength, sg = opts.sign == null ? 1 : opts.sign, fall = FALL[opts.falloff] || FALL.smooth, mode = opts.mode;
    const hits = near(st, c, r); if (!hits.length) return 0;
    const touched = [], dl = new V3();
    /* the plane the area sits on (flatten, scrape, fill, clay): the weighted mean place and the weighted mean normal */
    let pc = null, pn = null;
    if (mode === 'flatten' || mode === 'scrape' || mode === 'fill' || mode === 'clay') {
      pc = new V3(); pn = new V3(); let W = 0; for (const [g, d] of hits) { const w = fall(d / r); W += w; pc.x += E[g * 3] * w; pc.y += E[g * 3 + 1] * w; pc.z += E[g * 3 + 2] * w; pn.x += Nn[g * 3] * w; pn.y += Nn[g * 3 + 1] * w; pn.z += Nn[g * 3 + 2] * w; }
      if (W <= 0) return 0; pc.multiplyScalar(1 / W); if (pn.lengthSq() < 1e-12) pn.copy(nrm); pn.normalize();
      if (mode === 'clay') pc.addScaledVector(pn, sg * r * 0.12);   /* clay builds up to a flat top a little above the surface (or digs to a flat floor below it) */
    }
    let t = null; if (opts.dir && (mode === 'pinch' || mode === 'dots')) { t = opts.dir.clone(); t.addScaledVector(nrm, -t.dot(nrm)); if (t.lengthSq() < 1e-12) t = null; else t.normalize(); }
    const color = opts.color, Cattr = mode === 'paint' ? geo.attributes.color : null;
    for (const [g, d] of hits) {
      const w = fall(d / r); if (w <= 0) continue; const ex = E[g * 3], ey = E[g * 3 + 1], ez = E[g * 3 + 2], nx = Nn[g * 3], ny = Nn[g * 3 + 1], nz = Nn[g * 3 + 2];
      dl.set(0, 0, 0);
      if (mode === 'inflate') dl.set(nx, ny, nz).multiplyScalar(sg * s * r * 0.35 * w);
      else if (mode === 'deflate') dl.set(nx, ny, nz).multiplyScalar(-sg * s * r * 0.35 * w);
      else if (mode === 'melt') { const dn = opts.down || new V3(0, -1, 0); dl.copy(dn).normalize().multiplyScalar(s * r * 0.5 * w).addScaledVector(new V3(nx, ny, nz), -s * r * 0.15 * w); }
      else if (mode === 'smooth') { const ns = st.nb[g]; if (!ns.length) continue; let ax = 0, ay = 0, az = 0; for (let q = 0; q < ns.length; q++) { const m = ns[q]; ax += E[m * 3]; ay += E[m * 3 + 1]; az += E[m * 3 + 2]; } const k = Math.min(1, s * w * 0.6); dl.set((ax / ns.length - ex) * k, (ay / ns.length - ey) * k, (az / ns.length - ez) * k); }
      else if (pc) {   /* flatten, scrape, fill, clay: move along the plane's normal toward the plane */
        const h = (ex - pc.x) * pn.x + (ey - pc.y) * pn.y + (ez - pc.z) * pn.z;
        if (mode === 'scrape' && h <= 0) continue; if (mode === 'fill' && h >= 0) continue; if (mode === 'clay' && (sg > 0 ? h >= 0 : h <= 0)) continue;
        dl.copy(pn).multiplyScalar(-h * Math.min(1, s * w * (mode === 'clay' ? 0.5 : 0.6)));
      }
      else if (mode === 'pinch') {   /* pull toward the stroke's line (in the surface), and press a crease in (subtract) or raise a ridge (add) */
        let px = c.x - ex, py = c.y - ey, pz = c.z - ez; const kn = px * nx + py * ny + pz * nz; px -= nx * kn; py -= ny * kn; pz -= nz * kn;
        if (t) { const kt = px * t.x + py * t.y + pz * t.z; px -= t.x * kt; py -= t.y * kt; pz -= t.z * kt; }
        dl.set(px, py, pz).multiplyScalar(s * w * 0.25).addScaledVector(new V3(nx, ny, nz), sg * s * r * 0.08 * w * w);
      }
      else if (mode === 'smear') { if (!opts.delta) continue; dl.copy(opts.delta).multiplyScalar(Math.min(1, s * w * 1.2)); }
      else if (mode === 'dots') { const u = d / r, prof = opts.dot === 'ring' ? Math.max(0, 1 - Math.abs(u - 0.65) / 0.25) : opts.dot === 'cube' ? (u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.1)) : opts.dot === 'spike' ? (1 - u) * (1 - u) : Math.sqrt(Math.max(0, 1 - u * u)); dl.set(nx, ny, nz).multiplyScalar(sg * s * r * 0.4 * prof); }
      else if (mode === 'paint') {
        if (!Cattr || !color) continue; const k = Math.min(1, s * w * 1.5), CA = Cattr.array, sz = Cattr.itemSize;
        for (const m of st.members[g]) { if (recC && !recC.has(m)) recC.set(m, [CA[m * sz], CA[m * sz + 1], CA[m * sz + 2]]); for (let q = 0; q < 3; q++) CA[m * sz + q] += (color[q] - CA[m * sz + q]) * k; }
        touched.push(g); continue;
      }
      else continue;
      if (dl.lengthSq() < 1e-18) continue;
      const kx = dl.x / tw, ky = dl.y / tw, kz = dl.z / tw;
      for (const m of st.members[g]) {
        if (rec && !rec.has(m)) rec.set(m, T ? [T[m * 3], T[m * 3 + 1], T[m * 3 + 2]] : [A[m * 3], A[m * 3 + 1], A[m * 3 + 2]]);
        if (T) { T[m * 3] += kx; T[m * 3 + 1] += ky; T[m * 3 + 2] += kz; } else { A[m * 3] += dl.x; A[m * 3 + 1] += dl.y; A[m * 3 + 2] += dl.z; }
      }
      E[g * 3] += dl.x; E[g * 3 + 1] += dl.y; E[g * 3 + 2] += dl.z; touched.push(g);
    }
    if (Cattr && touched.length) Cattr.needsUpdate = true;
    if (touched.length && mode !== 'paint') { const ring = new Set(touched); touched.forEach(g => st.nb[g].forEach(x => ring.add(x))); computeNormals(st, [...ring]); }
    return touched.length;
  }
  function stroke(st, c, nrm, opts, rec, recC) { let n = 0; for (const d of dabs(c, nrm, opts.sym, opts.dir || null)) { const o = d.sign < 0 && opts.delta ? { ...opts, dir: d.dir, delta: new V3(-opts.delta.x, opts.delta.y, opts.delta.z) } : { ...opts, dir: d.dir }; n += dab(st, d.c, d.n, o, rec, recC); } return n; }
  function finish(st, opts) {   /* a stroke's last step: the rest shape needs fresh normals; a key leaves the rest alone. The grid always follows the shape as seen. */
    const geo = st.geometry; if (!opts || !opts.target) { geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox(); }
    rebuildGrid(st);
  }
  /* undo and redo of one stroke: rec maps point -> [x, y, z] before; swap puts those back and returns what it replaced, so calling it again redoes. The shape as seen follows. */
  function swap(st, rec, target, colorAttr) {
    const A = colorAttr ? colorAttr.array : (target || st.geometry.attributes.position.array), sz = colorAttr ? colorAttr.itemSize : 3, out = new Map();
    rec.forEach((v, m) => { out.set(m, [A[m * sz], A[m * sz + 1], A[m * sz + 2]]); A[m * sz] = v[0]; A[m * sz + 1] = v[1]; A[m * sz + 2] = v[2]; });
    if (colorAttr) { colorAttr.needsUpdate = true; return out; }
    if (!target) { st.geometry.attributes.position.needsUpdate = true; st.geometry.computeVertexNormals(); }
    const gs = new Set(); rec.forEach((_, m) => gs.add(st.group[m])); computeEff(st, [...gs]); const ring = new Set(gs); gs.forEach(g => st.nb[g].forEach(x => ring.add(x))); computeNormals(st, [...ring]); rebuildGrid(st);
    return out;
  }
  /* grab: pick the points once (with their falloff), then move them with the hand */
  function grabBegin(st, c, radius, sym, fallName) {
    const fall = FALL[fallName] || FALL.smooth, items = [];
    for (const d of dabs(c, new V3(0, 1, 0), sym)) { const h = near(st, d.c, radius); items.push({ sign: d.sign, pts: h.map(([g, dist]) => [g, fall(dist / radius)]).filter(x => x[1] > 0) }); }
    return { items, rec: new Map(), radius };
  }
  function grabMove(st, grab, delta, opts) {
    const A = st.geometry.attributes.position.array, T = opts && opts.target || null, tw = (opts && opts.tw) || 1, E = st.eff, moved = new Set();
    for (const it of grab.items) { const dx = (it.sign < 0 && opts && opts.sym && opts.sym.mirror ? -delta.x : delta.x); for (const [g, w] of it.pts) {
      for (const m of st.members[g]) { if (!grab.rec.has(m)) grab.rec.set(m, T ? [T[m * 3], T[m * 3 + 1], T[m * 3 + 2]] : [A[m * 3], A[m * 3 + 1], A[m * 3 + 2]]); const X = T || A, k = T ? 1 / tw : 1; X[m * 3] += dx * w * k; X[m * 3 + 1] += delta.y * w * k; X[m * 3 + 2] += delta.z * w * k; }
      E[g * 3] += dx * w; E[g * 3 + 1] += delta.y * w; E[g * 3 + 2] += delta.z * w; moved.add(g); } }
    if (!T) st.geometry.attributes.position.needsUpdate = true;
    return moved.size;
  }
  function settle(st, groups) { const ring = new Set(groups); groups.forEach(g => st.nb[g].forEach(x => ring.add(x))); computeNormals(st, [...ring]); }
  /* volume of a closed indexed mesh (signed), for checks */
  function volume(geometry) {
    const A = geometry.attributes.position.array, idx = geometry.index.array; let v = 0;
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3; v += (A[a] * (A[b + 1] * A[c + 2] - A[b + 2] * A[c + 1]) - A[a + 1] * (A[b] * A[c + 2] - A[b + 2] * A[c]) + A[a + 2] * (A[b] * A[c + 1] - A[b + 1] * A[c])) / 6; }
    return v;
  }
  return { prepare, rebuildGrid, near, dabs, dab, stroke, finish, swap, grabBegin, grabMove, settle, computeEff, computeNormals, volume, FALL, kind: 'next' };
}
