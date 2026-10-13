/* bst_sculpt_core.js: the sculpt brushes (Ruth, 2026-10-10: "a tool that baloons sections with a mirror and 360 degrees function ... it also doesn't have to have the mirror function on,
   I could add a beauty mark or a lump, or melt down a leg into a stump"). Pure: makeSculpt(THREE) takes three as a parameter and works on a plain BufferGeometry, so BST (r186) and the
   Atelier headset menu (r128) can both load it. No page globals, no r186-only API. Brushes: inflate (add volume), deflate (take it away), melt (sag a whole region down and in, for a stump),
   smooth, grab. Symmetry: off, MIRROR (across the x = 0 plane of the mesh's own space) and RADIAL (N copies around an axis: a plain x, y or z, or any direction passed as axisVec, such as a limb's own bone). A stroke can write into the base shape or into a SHAPE KEY
   (a morph target, stored as per-vertex deltas) so a sculpted behaviour is a named slider. Seams: vertices at the same place (UV seams) move together, so nothing tears.
   Strokes are recorded as per-vertex changes, so one stroke is one undo step. */
export function makeSculpt(THREE) {
  const V3 = THREE.Vector3;

  /* ---------- prepare a geometry: welded groups, neighbours, a grid for radius queries ---------- */
  function prepare(geometry) {
    const pos = geometry.attributes.position, n = pos.count, A = pos.array;
    geometry.computeBoundingBox(); const bb = geometry.boundingBox, size = bb.getSize(new V3()), cell = Math.max(size.x, size.y, size.z) / 48 || 1;
    const q = 1e-5, weld = new Map(), group = new Int32Array(n), members = [];
    for (let i = 0; i < n; i++) {
      const k = Math.round(A[i * 3] / q) + '_' + Math.round(A[i * 3 + 1] / q) + '_' + Math.round(A[i * 3 + 2] / q);
      let g = weld.get(k); if (g === undefined) { g = members.length; weld.set(k, g); members.push([]); }
      group[i] = g; members[g].push(i);
    }
    const G = members.length, nb = Array.from({ length: G }, () => new Set()), idx = geometry.index ? geometry.index.array : null, tri = (idx ? idx.length : n) / 3;
    for (let t = 0; t < tri; t++) { const a = group[idx ? idx[t * 3] : t * 3], b = group[idx ? idx[t * 3 + 1] : t * 3 + 1], c = group[idx ? idx[t * 3 + 2] : t * 3 + 2]; nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b); }
    const st = { geometry, n, group, members, nb: nb.map(s => Uint32Array.from(s)), cell, origin: bb.min.clone(), grid: null, G };
    rebuildGrid(st); return st;
  }
  const key = (st, x, y, z) => Math.floor((x - st.origin.x) / st.cell) + ',' + Math.floor((y - st.origin.y) / st.cell) + ',' + Math.floor((z - st.origin.z) / st.cell);
  function rebuildGrid(st) {   /* one entry per welded group, at its first member's place; call again after a stroke ends */
    const A = st.geometry.attributes.position.array, g = new Map();
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];   /* the cells that really hold points (a stroke can push the skin past the box it started in): near() never walks outside them */
    for (let k = 0; k < st.G; k++) { const i = st.members[k][0]; const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2], kk = key(st, x, y, z); let a = g.get(kk); if (!a) { a = []; g.set(kk, a); } a.push(k);
      const cx = Math.floor((x - st.origin.x) / st.cell), cy = Math.floor((y - st.origin.y) / st.cell), cz = Math.floor((z - st.origin.z) / st.cell); if (cx < lo[0]) lo[0] = cx; if (cy < lo[1]) lo[1] = cy; if (cz < lo[2]) lo[2] = cz; if (cx > hi[0]) hi[0] = cx; if (cy > hi[1]) hi[1] = cy; if (cz > hi[2]) hi[2] = cz; }
    st.grid = g; st.lo = lo; st.hi = hi;
  }
  function near(st, c, r) {   /* welded groups within r of c */
    const A = st.geometry.attributes.position.array, out = [], r2 = r * r, ci = Math.floor((c.x - r - st.origin.x) / st.cell), cj = Math.floor((c.y - r - st.origin.y) / st.cell), ck = Math.floor((c.z - r - st.origin.z) / st.cell);
    const ni = Math.floor((c.x + r - st.origin.x) / st.cell), nj = Math.floor((c.y + r - st.origin.y) / st.cell), nk = Math.floor((c.z + r - st.origin.z) / st.cell);
    for (let i = Math.max(ci, st.lo[0]); i <= Math.min(ni, st.hi[0]); i++) for (let j = Math.max(cj, st.lo[1]); j <= Math.min(nj, st.hi[1]); j++) for (let k = Math.max(ck, st.lo[2]); k <= Math.min(nk, st.hi[2]); k++) {
      const a = st.grid.get(i + ',' + j + ',' + k); if (!a) continue;
      for (const g of a) { const m = st.members[g][0], dx = A[m * 3] - c.x, dy = A[m * 3 + 1] - c.y, dz = A[m * 3 + 2] - c.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 <= r2) out.push([g, Math.sqrt(d2)]); }
    }
    return out;
  }
  const fall = (d, r) => { const t = d / r; return t >= 1 ? 0 : (1 - t * t) * (1 - t * t); };   /* soft edge: full at the middle, nothing at the rim */

  /* ---------- symmetry: the list of dabs one click makes ---------- */
  function dabs(c, nrm, sym) {
    let list = [{ c: c.clone(), n: nrm.clone() }];
    if (sym && sym.mirror) list = list.concat(list.map(d => ({ c: new V3(-d.c.x, d.c.y, d.c.z), n: new V3(-d.n.x, d.n.y, d.n.z) })));
    if (sym && sym.radial && sym.radial.count > 1) {
      const ax = sym.radial.axisVec ? sym.radial.axisVec.clone().normalize() : new V3(...(sym.radial.axis === 'x' ? [1, 0, 0] : sym.radial.axis === 'z' ? [0, 0, 1] : [0, 1, 0])), o = sym.radial.origin ? sym.radial.origin.clone() : new V3(), out = [];
      for (const d of list) for (let k = 0; k < sym.radial.count; k++) { const a = (Math.PI * 2 * k) / sym.radial.count; out.push({ c: d.c.clone().sub(o).applyAxisAngle(ax, a).add(o), n: d.n.clone().applyAxisAngle(ax, a) }); }
      list = out;
    }
    return list;
  }

  /* ---------- a stroke ---------- */
  /* opts: mode 'inflate'|'deflate'|'melt'|'smooth', radius, strength (0 to 1), sym, down (a V3, the way melt sags), target (null for the base shape, or a Float32Array of per-vertex deltas = a shape key)
     rec: a Map the stroke fills with each vertex's first value (for undo). Returns how many welded points moved. */
  function dab(st, c, nrm, opts, rec) {
    const geo = st.geometry, A = geo.attributes.position.array, N = geo.attributes.normal ? geo.attributes.normal.array : null, T = opts.target || null, moved = [];
    const hits = near(st, c, opts.radius); const s = opts.strength, r = opts.radius, down = opts.down || new V3(0, -1, 0);
    const vn = new V3(), p = new V3(), avg = new V3(), dl = new V3();
    for (const [g, d] of hits) {
      const w = fall(d, r); if (w <= 0) continue; const mem = st.members[g], i0 = mem[0];
      vn.set(0, 0, 0); if (N) { for (const m of mem) { vn.x += N[m * 3]; vn.y += N[m * 3 + 1]; vn.z += N[m * 3 + 2]; } vn.normalize(); } else vn.copy(nrm);
      p.set(A[i0 * 3], A[i0 * 3 + 1], A[i0 * 3 + 2]);
      if (opts.mode === 'inflate') dl.copy(vn).multiplyScalar(s * r * 0.35 * w);
      else if (opts.mode === 'deflate') dl.copy(vn).multiplyScalar(-s * r * 0.35 * w);
      else if (opts.mode === 'melt') dl.copy(down).normalize().multiplyScalar(s * r * 0.5 * w).addScaledVector(vn, -s * r * 0.15 * w);
      else if (opts.mode === 'smooth') { const ns = st.nb[g]; if (!ns.length) continue; avg.set(0, 0, 0); for (const q of ns) { const m = st.members[q][0]; avg.x += A[m * 3]; avg.y += A[m * 3 + 1]; avg.z += A[m * 3 + 2]; } avg.multiplyScalar(1 / ns.length); dl.copy(avg).sub(p).multiplyScalar(Math.min(1, s * w * 0.6)); }
      else continue;
      if (dl.lengthSq() < 1e-16) continue;
      for (const m of mem) {
        if (rec && !rec.has(m)) rec.set(m, T ? [T[m * 3], T[m * 3 + 1], T[m * 3 + 2]] : [A[m * 3], A[m * 3 + 1], A[m * 3 + 2]]);
        if (T) { T[m * 3] += dl.x; T[m * 3 + 1] += dl.y; T[m * 3 + 2] += dl.z; } else { A[m * 3] += dl.x; A[m * 3 + 1] += dl.y; A[m * 3 + 2] += dl.z; }
      }
      moved.push(g);
    }
    return moved.length;
  }
  function stroke(st, c, nrm, opts, rec) { let n = 0; for (const d of dabs(c, nrm, opts.sym)) n += dab(st, d.c, d.n, opts, rec); return n; }
  function finish(st, opts) {   /* a stroke's last step: the base shape needs fresh normals and a fresh grid; a shape key leaves the base alone */
    const geo = st.geometry; if (!opts || !opts.target) { geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox(); }
    rebuildGrid(st);
  }
  /* undo and redo of one stroke: rec maps vertex -> [x, y, z] before; swap puts those back and returns the values it replaced, so calling it again redoes */
  function swap(st, rec, target) {
    const A = target || st.geometry.attributes.position.array, out = new Map();
    rec.forEach((v, m) => { out.set(m, [A[m * 3], A[m * 3 + 1], A[m * 3 + 2]]); A[m * 3] = v[0]; A[m * 3 + 1] = v[1]; A[m * 3 + 2] = v[2]; });
    if (!target) { st.geometry.attributes.position.needsUpdate = true; st.geometry.computeVertexNormals(); }
    return out;
  }
  /* grab: pick the points once, then move them with the pointer */
  function grabBegin(st, c, radius, sym) {
    const items = []; for (const d of dabs(c, new V3(0, 1, 0), sym)) { const h = near(st, d.c, radius); items.push({ sign: d.c.x * c.x < 0 ? -1 : 1, pts: h.map(([g, dist]) => [g, fall(dist, radius)]) }); }
    return { items, rec: new Map(), radius };
  }
  function grabMove(st, grab, delta, opts) {
    const A = st.geometry.attributes.position.array, T = opts && opts.target || null;
    for (const it of grab.items) for (const [g, w] of it.pts) for (const m of st.members[g]) {
      if (!grab.rec.has(m)) grab.rec.set(m, T ? [T[m * 3], T[m * 3 + 1], T[m * 3 + 2]] : [A[m * 3], A[m * 3 + 1], A[m * 3 + 2]]);
      const X = T || A; X[m * 3] += (it.sign < 0 && opts && opts.sym && opts.sym.mirror ? -delta.x : delta.x) * w; X[m * 3 + 1] += delta.y * w; X[m * 3 + 2] += delta.z * w;
    }
    if (!T) st.geometry.attributes.position.needsUpdate = true;
  }
  /* volume of a closed indexed mesh (signed), for checks */
  function volume(geometry) {
    const A = geometry.attributes.position.array, idx = geometry.index.array; let v = 0;
    for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3; v += (A[a] * (A[b + 1] * A[c + 2] - A[b + 2] * A[c + 1]) - A[a + 1] * (A[b] * A[c + 2] - A[b + 2] * A[c]) + A[a + 2] * (A[b] * A[c + 1] - A[b + 1] * A[c])) / 6; }
    return v;
  }
  return { prepare, rebuildGrid, near, dabs, stroke, finish, swap, grabBegin, grabMove, volume };
}
