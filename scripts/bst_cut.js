/* bst_cut.js: cut a mesh along a flat plane and keep one side (Ruth 2026-10-10: "all the sculpting things that are in Substance and Gravity Sketch, like the cutting tool").
   Pure: cutGeometry(THREE, geometry, plane, opts) takes three as a parameter and returns a NEW BufferGeometry (the old one is untouched, so undo is a swap). Works on a plain mesh or a skinned one:
   every attribute is carried (position, normal, uv, colour, skin indices and weights, and every shape key's per-vertex deltas), a triangle the plane crosses is clipped into one or two, a new point on a
   cut edge gets the blend of its two ends (its bone indices and weights come from the nearer end, because indices cannot be blended), and the open end is capped with a fan so the cut piece is not hollow.
   plane: { n: Vector3 (unit), d: number } meaning points p with n.p - d > 0 are on the FRONT side. opts.keep: 'back' (default, the front goes) or 'front'.
   opts.dist: optional Float32Array of signed distances per vertex (for a skinned mesh pass the POSED distances so the cut lands where the hand is; the new point's rest position is the blend at that same t).
   Returns { geometry, removed (triangles), added, capped (cap triangles) } or null when the plane misses the mesh, or leaves nothing. */
export function cutGeometry(THREE, geo, plane, opts) {
  opts = opts || {}; const keepFront = opts.keep === 'front', V3 = THREE.Vector3;
  const P = geo.attributes.position, n = P.count, idx = geo.index ? geo.index.array : null, triN = (idx ? idx.length : n) / 3;
  const dist = new Float32Array(n);
  if (opts.dist) for (let i = 0; i < n; i++) dist[i] = keepFront ? opts.dist[i] : -opts.dist[i];
  else for (let i = 0; i < n; i++) dist[i] = (keepFront ? 1 : -1) * (plane.n.x * P.getX(i) + plane.n.y * P.getY(i) + plane.n.z * P.getZ(i) - plane.d);   /* now d >= 0 is the side we keep */
  let any = false, all = true; for (let i = 0; i < n; i++) { if (dist[i] >= 0) any = true; else all = false; }
  if (!any || all) return null;

  const names = Object.keys(geo.attributes), attrs = names.map(k => geo.attributes[k]);
  const morphs = geo.morphAttributes && geo.morphAttributes.position ? geo.morphAttributes.position : [];
  const skinKey = a => a.name === 'skinIndex' || a.name === 'skinWeight';
  const outIdx = [], newOf = new Map(), remap = new Int32Array(n).fill(-1);
  const out = names.map(() => []), outM = morphs.map(() => []);   /* growing arrays of numbers */
  const push = (i, from) => {   /* copy vertex i of the source into the output; returns its new index */
    attrs.forEach((a, k) => { for (let c = 0; c < a.itemSize; c++) out[k].push(a.array[i * a.itemSize + c]); });
    morphs.forEach((m, k) => { for (let c = 0; c < 3; c++) outM[k].push(m.array[i * 3 + c]); });
    return out[0].length / attrs[0].itemSize - 1;
  };
  const keep = i => { if (remap[i] < 0) remap[i] = push(i); return remap[i]; };
  const edge = (a, b) => {   /* the new point where the plane crosses the edge a-b (a kept, b dropped or the reverse); the same edge always gives the same point */
    const key = a < b ? a + '_' + b : b + '_' + a; let r = newOf.get(key); if (r !== undefined) return r;
    const da = dist[a], db = dist[b], t = da / (da - db), near = t < 0.5 ? a : b;   /* t from a to b where the distance is zero */
    attrs.forEach((at, k) => { const sz = at.itemSize, A = at.array; for (let c = 0; c < sz; c++) { const va = A[a * sz + c], vb = A[b * sz + c]; out[k].push(skinKey(at) ? A[near * sz + c] : va + (vb - va) * t); } });
    morphs.forEach((m, k) => { for (let c = 0; c < 3; c++) { const va = m.array[a * 3 + c], vb = m.array[b * 3 + c]; outM[k].push(va + (vb - va) * t); } });
    r = out[0].length / attrs[0].itemSize - 1; newOf.set(key, r); return r;
  };
  const segs = [];   /* the cut edges: pairs of new point indices, oriented so the kept triangle is on their left */
  let removed = 0, added = 0;
  for (let t = 0; t < triN; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2, tri = [a, b, c], ins = tri.map(v => dist[v] >= 0), cnt = ins[0] + ins[1] + ins[2];
    if (cnt === 3) { outIdx.push(keep(a), keep(b), keep(c)); continue; }
    if (cnt === 0) { removed++; continue; }
    removed++;
    if (cnt === 1) {   /* one corner kept: one smaller triangle */
      const k = ins.indexOf(true), v0 = tri[k], v1 = tri[(k + 1) % 3], v2 = tri[(k + 2) % 3], e1 = edge(v0, v1), e2 = edge(v0, v2);
      outIdx.push(keep(v0), e1, e2); segs.push([e1, e2]); added++;
    } else {   /* two corners kept: a quad, two triangles */
      const k = ins.indexOf(false), v0 = tri[k], v1 = tri[(k + 1) % 3], v2 = tri[(k + 2) % 3], e1 = edge(v0, v1), e2 = edge(v0, v2);
      outIdx.push(keep(v1), keep(v2), e1, keep(v2), e2, e1); segs.push([e2, e1]); added += 2;
    }
  }
  if (!outIdx.length) return null;

  /* the cap: chain the cut edges into loops by where their points sit, fan each loop from its middle */
  let capped = 0; const pos = out[names.indexOf('position')], posAt = i => new V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  if (opts.cap !== false && segs.length) {
    const q = 1e-5, key = i => Math.round(pos[i * 3] / q) + '_' + Math.round(pos[i * 3 + 1] / q) + '_' + Math.round(pos[i * 3 + 2] / q), byStart = new Map();
    segs.forEach((s, i) => { const k = key(s[0]); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(i); });
    const used = new Uint8Array(segs.length), capN = plane.n.clone().multiplyScalar(keepFront ? -1 : 1), nIdx = names.indexOf('normal');   /* the cap faces away from what is kept */
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue; const loop = [segs[s0][0]]; let cur = s0, guard = 0; used[s0] = 1;
      while (guard++ < segs.length + 2) {
        const endK = key(segs[cur][1]); const nxt = (byStart.get(endK) || []).find(j => !used[j]); if (nxt === undefined) break; loop.push(segs[nxt][0]); used[nxt] = 1; cur = nxt;
      }
      for (let i = loop.length - 1; i > 0; i--) if (key(loop[i]) === key(loop[i - 1])) loop.splice(i, 1);   /* a seam gives two points in one place: one is enough on the rim */
      while (loop.length > 1 && key(loop[0]) === key(loop[loop.length - 1])) loop.pop();
      if (loop.length < 3) continue;
      const mid = new V3(); loop.forEach(i => mid.add(posAt(i))); mid.multiplyScalar(1 / loop.length);
      const near = loop.reduce((b, i) => (posAt(i).distanceToSquared(mid) < posAt(b).distanceToSquared(mid) ? i : b), loop[0]);
      attrs.forEach((a, k) => { const sz = a.itemSize; if (names[k] === 'position') { out[k].push(mid.x, mid.y, mid.z); } else if (k === nIdx) { out[k].push(capN.x, capN.y, capN.z); } else { for (let c = 0; c < sz; c++) out[k].push(out[k][near * sz + c]); } });
      morphs.forEach((m, k) => { const M = outM[k]; let ax = 0, ay = 0, az = 0; loop.forEach(i => { ax += M[i * 3]; ay += M[i * 3 + 1]; az += M[i * 3 + 2]; }); outM[k].push(ax / loop.length, ay / loop.length, az / loop.length); });
      const centre = out[0].length / attrs[0].itemSize - 1;
      /* the cap's own copies of the rim points, so their normals can face out without bending the skin's normals */
      const rim = loop.map(i => { attrs.forEach((a, k) => { const sz = a.itemSize; if (k === nIdx) out[k].push(capN.x, capN.y, capN.z); else for (let c = 0; c < sz; c++) out[k].push(out[k][i * sz + c]); }); morphs.forEach((m, k) => { for (let c = 0; c < 3; c++) outM[k].push(outM[k][i * 3 + c]); }); return out[0].length / attrs[0].itemSize - 1; });
      for (let i = 0; i < rim.length; i++) { const a = rim[i], b = rim[(i + 1) % rim.length]; const tn = new V3().subVectors(posAt(b), posAt(a)).cross(new V3().subVectors(mid, posAt(a))); if (tn.dot(capN) >= 0) outIdx.push(a, b, centre); else outIdx.push(b, a, centre); capped++; }
    }
  }

  const g = new THREE.BufferGeometry();
  attrs.forEach((a, k) => { const arr = new a.array.constructor(out[k].length); arr.set(out[k]); const na = new THREE.BufferAttribute(arr, a.itemSize, a.normalized); na.name = a.name; g.setAttribute(names[k], na); });
  if (morphs.length) { g.morphAttributes.position = morphs.map((m, k) => { const na = new THREE.BufferAttribute(new Float32Array(outM[k]), 3); na.name = m.name; return na; }); g.morphTargetsRelative = geo.morphTargetsRelative; }
  const count = out[0].length / attrs[0].itemSize; g.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(outIdx) : new Uint16Array(outIdx), 1));
  g.userData = Object.assign({}, geo.userData); g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, removed, added, capped };
}

/* ---------- Erase: delete whole triangles under a ball (stray bits, artifacts), no clipping and no new points ----------
   eraseGeometry(THREE, geo, ball, opts): a triangle goes when its middle (opts.posed = the posed vertex positions, else the rest ones) lies inside the ball { c, r }. Every point, skin weight, uv and shape key
   stays exactly as it was (only the index list shrinks), so the open edge is the triangle edge, nothing is bent. Returns { geometry, posed, removed } or null when nothing is inside. */
export function eraseGeometry(THREE, geo, ball, opts) {
  opts = opts || {}; const P = opts.posed || geo.attributes.position.array, idx = geo.index ? geo.index.array : null, n = idx ? idx.length : geo.attributes.position.count, c = ball.c, r2 = ball.r * ball.r, keepIdx = []; let removed = 0;
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, d = idx ? idx[t + 2] : t + 2;
    const x = (P[a * 3] + P[b * 3] + P[d * 3]) / 3 - c.x, y = (P[a * 3 + 1] + P[b * 3 + 1] + P[d * 3 + 1]) / 3 - c.y, z = (P[a * 3 + 2] + P[b * 3 + 2] + P[d * 3 + 2]) / 3 - c.z;
    if (x * x + y * y + z * z <= r2) removed++; else keepIdx.push(a, b, d);
  }
  if (!removed) return null;
  const g = new THREE.BufferGeometry(); for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
  if (geo.morphAttributes.position) { g.morphAttributes.position = geo.morphAttributes.position.slice(); g.morphTargetsRelative = geo.morphTargetsRelative; }
  g.setIndex(new THREE.BufferAttribute(geo.attributes.position.count > 65535 ? new Uint32Array(keepIdx) : new Uint16Array(keepIdx), 1));
  g.userData = Object.assign({}, geo.userData); g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, posed: opts.posed || null, removed, kept: keepIdx.length / 3 };
}

/* ---------- Heal edge: make a rough open edge smooth ----------
   healGeometry(THREE, geo, ball, opts): the open (boundary) edges whose middle lies inside the ball { c, r } (opts.posed = posed vertex positions, else rest).
   opts.mode 'smooth' (default): every selected edge longer than opts.split (rest units, 0 = none) is cut in two with a new point halfway (the triangle beside it becomes two, so the missing triangles are added),
     then the rim points are relaxed along the rim (Taubin: shrink then un-shrink, so the loop keeps its size), softest at the ball's edge. Welded copies of a point (uv seams) move together.
   opts.mode 'close': each open loop touched by the ball is closed with a fan of triangles from its middle.
   New points carry uv, normal, shape keys (halfway) and the skin of the nearer end. Returns { geometry, split, moved, closed } or null when the ball touches no open edge. */
export function healGeometry(THREE, geo, ball, opts) {
  opts = opts || {}; if (!geo.index) return null;
  const V3 = THREE.Vector3, pos = geo.attributes.position, n0 = pos.count, A0 = pos.array, P0 = opts.posed || A0, I0 = geo.index.array, r2 = ball.r * ball.r, c = ball.c;
  const names = Object.keys(geo.attributes), attrs = names.map(k => geo.attributes[k]), morphs = geo.morphAttributes.position || [];
  const A = Array.from(attrs, a => Array.from(a.array)), M = morphs.map(m => Array.from(m.array)), P = Array.from(P0), idx = Array.from(I0);
  const pIdx = names.indexOf('position'), nIdx = names.indexOf('normal'), skinNames = ['skinIndex', 'skinWeight'];
  /* welded groups */
  const weld = new Map(), grp = new Int32Array(n0 + idx.length), members = []; const q = 1e-5;
  const groupOf = i => grp[i];
  const gKey = i => Math.round(A[pIdx][i * 3] / q) + '_' + Math.round(A[pIdx][i * 3 + 1] / q) + '_' + Math.round(A[pIdx][i * 3 + 2] / q);
  const addToGroup = i => { const k = gKey(i); let g = weld.get(k); if (g === undefined) { g = members.length; weld.set(k, g); members.push([]); } grp[i] = g; members[g].push(i); };
  for (let i = 0; i < n0; i++) addToGroup(i);
  const boundary = () => {   /* directed boundary edges (in the triangle's own winding) with their triangle and corner */
    const cnt = new Map(); for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const u = idx[t + k], v = idx[t + (k + 1) % 3], gu = grp[u], gv = grp[v], key = gu < gv ? gu * 4000003 + gv : gv * 4000003 + gu; const e = cnt.get(key); if (e) e.c++; else cnt.set(key, { c: 1, t, k, u, v }); }
    const out = []; cnt.forEach(e => { if (e.c === 1) out.push(e); }); return out;
  };
  const mid = (e, Q) => [(Q[e.u * 3] + Q[e.v * 3]) / 2 - c.x, (Q[e.u * 3 + 1] + Q[e.v * 3 + 1]) / 2 - c.y, (Q[e.u * 3 + 2] + Q[e.v * 3 + 2]) / 2 - c.z];
  const inside = (e, Q) => { const d = mid(e, Q); return d[0] * d[0] + d[1] * d[1] + d[2] * d[2] <= r2; };
  let be = boundary(); const sel0 = be.filter(e => inside(e, P)); if (!sel0.length) return null;
  const res = { split: 0, moved: 0, closed: 0 };
  const newVertex = (a, b, t) => {   /* a point between vertices a and b */
    const id = A[0].length / attrs[0].itemSize;
    attrs.forEach((at, k) => { const sz = at.itemSize, isF = at.array instanceof Float32Array || at.array instanceof Float64Array; if (skinNames.includes(names[k]) || !isF) { for (let j = 0; j < sz; j++) A[k].push(A[k][a * sz + j]); } else { for (let j = 0; j < sz; j++) A[k].push(A[k][a * sz + j] * (1 - t) + A[k][b * sz + j] * t); if (k === nIdx) { const L = Math.hypot(A[k][id * 3], A[k][id * 3 + 1], A[k][id * 3 + 2]) || 1; for (let j = 0; j < 3; j++) A[k][id * 3 + j] /= L; } } });
    M.forEach(m => { for (let j = 0; j < 3; j++) m.push(m[a * 3 + j] * (1 - t) + m[b * 3 + j] * t); });
    for (let j = 0; j < 3; j++) P.push(P[a * 3 + j] * (1 - t) + P[b * 3 + j] * t);
    addToGroup(id); return id;
  };
  if (opts.mode === 'close') {
    const outOf = new Map(); be.forEach(e => { const g = grp[e.u]; if (!outOf.has(g)) outOf.set(g, []); outOf.get(g).push(e); });
    const used = new Set();
    for (const e0 of sel0) {
      if (used.has(e0)) continue; const loop = [e0]; used.add(e0); let cur = e0, ok = false;
      for (let step = 0; step < 6000; step++) { const nx = (outOf.get(grp[cur.v]) || []).find(x => !used.has(x)); if (!nx) { ok = grp[cur.v] === grp[e0.u]; break; } if (nx === e0) { ok = true; break; } loop.push(nx); used.add(nx); cur = nx; if (grp[cur.v] === grp[e0.u]) { ok = true; break; } }
      if (!ok || loop.length < 3) continue;
      const cx = new V3(); loop.forEach(e => { cx.x += A[pIdx][e.u * 3]; cx.y += A[pIdx][e.u * 3 + 1]; cx.z += A[pIdx][e.u * 3 + 2]; }); cx.multiplyScalar(1 / loop.length);
      let near = loop[0], bd = 1e18; loop.forEach(e => { const d = (A[pIdx][e.u * 3] - cx.x) ** 2 + (A[pIdx][e.u * 3 + 1] - cx.y) ** 2 + (A[pIdx][e.u * 3 + 2] - cx.z) ** 2; if (d < bd) { bd = d; near = e; } });
      const id = newVertex(near.u, near.u, 0); A[pIdx][id * 3] = cx.x; A[pIdx][id * 3 + 1] = cx.y; A[pIdx][id * 3 + 2] = cx.z;
      const pc = new V3(); loop.forEach(e => { pc.x += P[e.u * 3]; pc.y += P[e.u * 3 + 1]; pc.z += P[e.u * 3 + 2]; }); pc.multiplyScalar(1 / loop.length); P[id * 3] = pc.x; P[id * 3 + 1] = pc.y; P[id * 3 + 2] = pc.z;
      loop.forEach(e => { idx.push(e.v, e.u, id); }); res.closed++;
    }
    if (!res.closed) return null;
  } else {
    if (opts.split > 0) {
      const done = new Set(); const todo = [];
      for (const e of sel0) { const L = Math.hypot(A[pIdx][e.u * 3] - A[pIdx][e.v * 3], A[pIdx][e.u * 3 + 1] - A[pIdx][e.v * 3 + 1], A[pIdx][e.u * 3 + 2] - A[pIdx][e.v * 3 + 2]); if (L > opts.split && !done.has(e.t)) { done.add(e.t); todo.push(e); } }
      todo.forEach(e => { const t = e.t, a = idx[t + e.k], b = idx[t + (e.k + 1) % 3], cc = idx[t + (e.k + 2) % 3], m = newVertex(a, b, 0.5); idx[t] = a; idx[t + 1] = m; idx[t + 2] = cc; idx.push(m, b, cc); res.split++; });
    }
    be = boundary(); const sel = be.filter(e => inside(e, P)); const nb = new Map(), w = new Map();
    const link = (g, h) => { if (!nb.has(g)) nb.set(g, new Set()); nb.get(g).add(h); };
    be.forEach(e => { link(grp[e.u], grp[e.v]); link(grp[e.v], grp[e.u]); });
    const moveG = new Set(); sel.forEach(e => { moveG.add(grp[e.u]); moveG.add(grp[e.v]); });
    moveG.forEach(g => { const i = members[g][0], dx = P[i * 3] - c.x, dy = P[i * 3 + 1] - c.y, dz = P[i * 3 + 2] - c.z, t = Math.sqrt(dx * dx + dy * dy + dz * dz) / ball.r, f = t >= 1 ? 0 : (1 - t * t) * (1 - t * t); w.set(g, f); });
    const Ap = A[pIdx]; const rep = g => members[g][0];
    for (let it = 0; it < 8; it++) for (const lam of [0.5, -0.53]) {
      const upd = []; moveG.forEach(g => { const ns = nb.get(g); if (!ns || ns.size < 2) return; let x = 0, y = 0, z = 0; ns.forEach(h => { const j = rep(h); x += Ap[j * 3]; y += Ap[j * 3 + 1]; z += Ap[j * 3 + 2]; }); x /= ns.size; y /= ns.size; z /= ns.size; const i = rep(g), f = lam * w.get(g); upd.push([g, Ap[i * 3] + (x - Ap[i * 3]) * f, Ap[i * 3 + 1] + (y - Ap[i * 3 + 1]) * f, Ap[i * 3 + 2] + (z - Ap[i * 3 + 2]) * f]); });
      upd.forEach(([g, x, y, z]) => members[g].forEach(i => { Ap[i * 3] = x; Ap[i * 3 + 1] = y; Ap[i * 3 + 2] = z; }));
    }
    res.moved = moveG.size;
    if (!res.moved) return null;
  }
  const count = A[0].length / attrs[0].itemSize, g = new THREE.BufferGeometry();
  attrs.forEach((at, k) => { const arr = new at.array.constructor(A[k].length); arr.set(A[k]); const na = new THREE.BufferAttribute(arr, at.itemSize, at.normalized); na.name = at.name; g.setAttribute(names[k], na); });
  if (M.length) { g.morphAttributes.position = M.map((m, k) => { const na = new THREE.BufferAttribute(new Float32Array(m), 3); na.name = morphs[k].name; return na; }); g.morphTargetsRelative = geo.morphTargetsRelative; }
  g.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1)); g.userData = Object.assign({}, geo.userData); g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, posed: null, split: res.split, moved: res.moved, closed: res.closed, removed: res.split + res.moved + res.closed };
}

/* ---------- Subdivide: give a coarse object enough points for the brushes ----------
   subdivideGeometry(THREE, geo, opts): every triangle becomes four (new points at the edge middles) until the longest edge, measured in the world with opts.scale = { x, y, z } (the object's scale), is at most opts.maxEdge
   or the next round would pass opts.maxPoints. Points are shared along an edge, so nothing tears; a hard edge (a cube's corner, split into one point per face) stays hard. New points carry uv, normal (renormalised),
   colour and shape keys halfway, and the skin of the first end. Returns { geometry, rounds, longest } or null when the object is already fine. */
export function subdivideGeometry(THREE, geo, opts) {
  opts = opts || {}; const sc = opts.scale || { x: 1, y: 1, z: 1 }, maxEdge = opts.maxEdge || 0.04, maxPoints = opts.maxPoints || 60000;
  const names = Object.keys(geo.attributes), attrs = names.map(k => geo.attributes[k]), pIdx = names.indexOf('position'), nIdx = names.indexOf('normal'), skinNames = ['skinIndex', 'skinWeight'];
  let A = attrs.map(a => Array.from(a.array)), M = (geo.morphAttributes.position || []).map(m => Array.from(m.array)), idx = geo.index ? Array.from(geo.index.array) : Array.from({ length: geo.attributes.position.count }, (_, i) => i);
  const longest = () => { const P = A[pIdx]; let L = 0; for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k] * 3, b = idx[t + (k + 1) % 3] * 3; const d = Math.hypot((P[a] - P[b]) * sc.x, (P[a + 1] - P[b + 1]) * sc.y, (P[a + 2] - P[b + 2]) * sc.z); if (d > L) L = d; } return L; };
  const first = longest(); if (first <= maxEdge) return null; let rounds = 0, L = first;
  while (L > maxEdge && rounds < 8) {
    const n = A[0].length / attrs[0].itemSize; if ((n + idx.length * 1.5) > maxPoints) break;   /* the next round adds about one point per edge */
    const mids = new Map(), mid = (a, b) => { const key = a < b ? a * 4194304 + b : b * 4194304 + a; let id = mids.get(key); if (id !== undefined) return id; id = A[0].length / attrs[0].itemSize;
      attrs.forEach((at, k) => { const sz = at.itemSize, isF = at.array instanceof Float32Array || at.array instanceof Float64Array; if (skinNames.includes(names[k]) || !isF) { for (let j = 0; j < sz; j++) A[k].push(A[k][a * sz + j]); } else { for (let j = 0; j < sz; j++) A[k].push((A[k][a * sz + j] + A[k][b * sz + j]) / 2); if (k === nIdx) { const l = Math.hypot(A[k][id * 3], A[k][id * 3 + 1], A[k][id * 3 + 2]) || 1; for (let j = 0; j < 3; j++) A[k][id * 3 + j] /= l; } } });
      M.forEach(m => { for (let j = 0; j < 3; j++) m.push((m[a * 3 + j] + m[b * 3 + j]) / 2); }); mids.set(key, id); return id; };
    const out = []; for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); }
    idx = out; rounds++; L /= 2;
  }
  if (!rounds) return null;
  const count = A[0].length / attrs[0].itemSize, g = new THREE.BufferGeometry();
  attrs.forEach((at, k) => { const arr = new at.array.constructor(A[k].length); arr.set(A[k]); const na = new THREE.BufferAttribute(arr, at.itemSize, at.normalized); na.name = at.name; g.setAttribute(names[k], na); });
  if (M.length) { g.morphAttributes.position = M.map((m, k) => { const na = new THREE.BufferAttribute(new Float32Array(m), 3); na.name = geo.morphAttributes.position[k].name; return na; }); g.morphTargetsRelative = geo.morphTargetsRelative; }
  g.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1)); g.userData = Object.assign({}, geo.userData); g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, rounds, longest: L };
}

/* ---------- Carve: subtract a ball from a surface (or keep only what is inside it) ----------
   carveGeometry(THREE, geo, ball, opts): ball = { c: Vector3, r: number } in the mesh's own space; opts.posed = Float32Array of every vertex's POSED position (so the ball lands where the hand is on a posed figure;
   the new points' rest position is the blend at the same t, as in cutGeometry); opts.keep = 'outside' (subtract: the skin inside the ball goes) or 'inside' (intersect: only the skin inside the ball stays).
   The ball is a 42-sided round solid just outside the true ball (the planes sit at the radius along 42 even directions), so the clipping is exact and the hole is round to the eye. Whole triangles away from
   the ball are copied untouched; triangles that cross it are clipped and every attribute (skin, shape keys, uv, normals) is carried as in cutGeometry. The inside of the hole is left open (the skin only).
   Returns { geometry, posed (the new vertices' posed positions), removed, kept } or null if the ball touches nothing (subtract) or holds nothing (intersect). */
let BALL_DIRS = null;
function ballDirs(THREE) {
  if (BALL_DIRS) return BALL_DIRS; const t = (1 + Math.sqrt(5)) / 2, ico = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v => new THREE.Vector3(...v).normalize()), seen = new Map(), out = [];
  const add = v => { const k = v.toArray().map(x => Math.round(x * 1e4)).join(','); if (!seen.has(k)) { seen.set(k, 1); out.push(v); } };
  ico.forEach(add); const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  F.forEach(f => { for (let i = 0; i < 3; i++) add(ico[f[i]].clone().add(ico[f[(i + 1) % 3]]).normalize()); });   /* the 12 corners and the 30 edge middles */
  return (BALL_DIRS = out);
}
export function carveGeometry(THREE, geo, ball, opts) {
  opts = opts || {}; const keepIn = opts.keep === 'inside', dirs = ballDirs(THREE), K = dirs.length, P = geo.attributes.position, n = P.count, PO = opts.posed, c = ball.c, r = ball.r;
  const idx = geo.index ? geo.index.array : null, triN = (idx ? idx.length : n) / 3, names = Object.keys(geo.attributes), attrs = names.map(k => geo.attributes[k]), morphs = geo.morphAttributes && geo.morphAttributes.position ? geo.morphAttributes.position : [];
  const skin = attrs.map(a => a.name === 'skinIndex' || a.name === 'skinWeight');
  const off = []; let L = 0; attrs.forEach(a => { off.push(L); L += a.itemSize; }); const mOff = L; L += 3 * morphs.length; const pOff = L; L += 3; const dOff = L; L += K;   /* one flat record per vertex: attributes, key deltas, posed position, distances to the 42 planes */
  const rec = i => { const o = new Float32Array(L); attrs.forEach((a, k) => { for (let q = 0; q < a.itemSize; q++) o[off[k] + q] = a.array[i * a.itemSize + q]; }); morphs.forEach((m, k) => { for (let q = 0; q < 3; q++) o[mOff + k * 3 + q] = m.array[i * 3 + q]; });
    const x = PO[i * 3] - c.x, y = PO[i * 3 + 1] - c.y, z = PO[i * 3 + 2] - c.z; o[pOff] = PO[i * 3]; o[pOff + 1] = PO[i * 3 + 1]; o[pOff + 2] = PO[i * 3 + 2]; for (let j = 0; j < K; j++) o[dOff + j] = dirs[j].x * x + dirs[j].y * y + dirs[j].z * z - r; return o; };
  const lerp = (a, b, t) => { const o = new Float32Array(L), near = t < 0.5 ? a : b; for (let q = 0; q < L; q++) o[q] = a[q] + (b[q] - a[q]) * t; attrs.forEach((at, k) => { if (skin[k]) for (let q = 0; q < at.itemSize; q++) o[off[k] + q] = near[off[k] + q]; }); return o; };
  const clip = (poly, j, outside) => {   /* keep the part of a convex polygon on the outside (distance > 0) or inside (<= 0) of plane j */
    const res = [], m = poly.length; for (let i = 0; i < m; i++) { const a = poly[i], b = poly[(i + 1) % m], da = a[dOff + j], db = b[dOff + j], ia = outside ? da > 0 : da <= 0, ib = outside ? db > 0 : db <= 0;
      if (ia) res.push(a); if (ia !== ib) res.push(lerp(a, b, da / (da - db))); } return res; };
  const outRecs = [], outIdx = []; let removed = 0, kept = 0; const cache = new Map();
  const idOf = new Map(), emit = (poly) => { if (poly.length < 3) return; const ids = poly.map(v => { let id = idOf.get(v); if (id === undefined) { outRecs.push(v); id = outRecs.length - 1; idOf.set(v, id); } return id; }); for (let i = 1; i < ids.length - 1; i++) outIdx.push(ids[0], ids[i], ids[i + 1]); };
  const vr = i => { let o = cache.get(i); if (!o) { o = rec(i); cache.set(i, o); } return o; };
  const rr = r * 1.001; let touched = false;
  for (let t = 0; t < triN; t++) {
    const ia = idx ? idx[t * 3] : t * 3, ib = idx ? idx[t * 3 + 1] : t * 3 + 1, ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
    /* quick look: the triangle's box against the ball */
    let lo = 1e9, hi = -1e9, near = false; const ps = [ia, ib, ic].map(v => [PO[v * 3] - c.x, PO[v * 3 + 1] - c.y, PO[v * 3 + 2] - c.z]);
    const bx = [0, 1, 2].map(ax => [Math.min(ps[0][ax], ps[1][ax], ps[2][ax]), Math.max(ps[0][ax], ps[1][ax], ps[2][ax])]); near = bx.every(b => b[1] > -rr * 1.06 && b[0] < rr * 1.06);
    if (!near) { if (!keepIn) { emit([vr(ia), vr(ib), vr(ic)]); kept++; } else removed++; continue; }
    let poly = [vr(ia), vr(ib), vr(ic)];
    if (keepIn) { for (let j = 0; j < K && poly.length >= 3; j++) poly = clip(poly, j, false); if (poly.length >= 3) { emit(poly); kept++; touched = true; } else removed++; continue; }
    /* subtract: the pieces outside plane 0, then outside plane 1 and inside plane 0, ... each piece fully outside the ball; what is left after every plane is inside it and goes */
    let rem = poly;
    for (let j = 0; j < K && rem.length >= 3; j++) { const o = clip(rem, j, true); if (o.length >= 3) emit(o); rem = clip(rem, j, false); }
    kept++; if (rem.length >= 3) { const A = rem[0], B = rem[1]; let ar = 0; for (let i = 1; i < rem.length - 1; i++) { const u = [rem[i][pOff] - A[pOff], rem[i][pOff + 1] - A[pOff + 1], rem[i][pOff + 2] - A[pOff + 2]], w = [rem[i + 1][pOff] - A[pOff], rem[i + 1][pOff + 1] - A[pOff + 1], rem[i + 1][pOff + 2] - A[pOff + 2]]; ar += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]); } if (ar > 1e-10) touched = true; }
  }
  if (!outIdx.length) return null;
  const cnt = outRecs.length, g = new THREE.BufferGeometry();
  attrs.forEach((a, k) => { const arr = new a.array.constructor(cnt * a.itemSize); for (let i = 0; i < cnt; i++) for (let q = 0; q < a.itemSize; q++) arr[i * a.itemSize + q] = outRecs[i][off[k] + q]; const na = new THREE.BufferAttribute(arr, a.itemSize, a.normalized); na.name = a.name; g.setAttribute(names[k], na); });
  if (morphs.length) { g.morphAttributes.position = morphs.map((m, k) => { const arr = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) for (let q = 0; q < 3; q++) arr[i * 3 + q] = outRecs[i][mOff + k * 3 + q]; const na = new THREE.BufferAttribute(arr, 3); na.name = m.name; return na; }); g.morphTargetsRelative = geo.morphTargetsRelative; }
  g.setIndex(new THREE.BufferAttribute(cnt > 65535 ? new Uint32Array(outIdx) : new Uint16Array(outIdx), 1)); g.userData = Object.assign({}, geo.userData);
  const posed = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) { posed[i * 3] = outRecs[i][pOff]; posed[i * 3 + 1] = outRecs[i][pOff + 1]; posed[i * 3 + 2] = outRecs[i][pOff + 2]; }
  g.computeBoundingBox(); g.computeBoundingSphere();
  const before = triN, after = outIdx.length / 3; if (!keepIn && !touched) return null;
  return { geometry: g, posed, removed: Math.max(0, before - after), kept: after };
}

/* ---------- Stamp: subtract ANY closed object from a surface (Ruth 2026-10-10: "I want the boolean function because then I can use the objects to carve stamps ... then I can create my own tools of subtraction") ----------
   solidFromMesh(THREE, geometry, matrix) turns a closed mesh into outward-facing triangles in the body's space and says whether it IS closed (every edge shared by exactly two triangles, welded by place).
   stampGeometry(THREE, geo, solid, opts) takes the solid's triangles away from the body's skin (opts.keep 'outside', the default) or keeps only the skin inside the solid ('inside'). The solid is turned into a BSP tree
   (any shape, holes and hollows included), and each body triangle near it is split by that tree: pieces inside the solid go, pieces outside stay, with every attribute carried as in cutGeometry.
   opts.posed: Float32Array of the body's POSED vertex positions (the solid is in the same space). Returns { geometry, posed, removed } or null when the solid touches nothing (subtract) or holds nothing (intersect). */
export function solidFromMesh(THREE, geometry, matrix, positions) {
  const P = geometry.attributes.position, I = geometry.index ? geometry.index.array : null, nT = (I ? I.length : P.count) / 3, V = THREE.Vector3, tris = [], q = 1e-5;
  const at = i => (positions ? new V(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]) : new V().fromBufferAttribute(P, i)).applyMatrix4(matrix), key = v => Math.round(v.x / q) + '_' + Math.round(v.y / q) + '_' + Math.round(v.z / q);
  for (let t = 0; t < nT; t++) tris.push([at(I ? I[t * 3] : t * 3), at(I ? I[t * 3 + 1] : t * 3 + 1), at(I ? I[t * 3 + 2] : t * 3 + 2)]);
  const edges = new Map(); let vol = 0;
  tris.forEach(([a, b, c]) => { [[a, b], [b, c], [c, a]].forEach(([u, w]) => { const ku = key(u), kw = key(w); if (ku === kw) return; const k = ku + '>' + kw, r = kw + '>' + ku; edges.set(k, (edges.get(k) || 0) + 1); edges.set(r, edges.get(r) || 0); }); vol += a.dot(new V().crossVectors(b, c)) / 6; });
  let closed = true; edges.forEach((n, k) => { const [u, w] = k.split('>'); if (n !== (edges.get(w + '>' + u) || 0)) closed = false; if (n > 1) closed = false; });   /* each directed edge once, with its twin the other way */
  if (vol < 0) tris.forEach(t => { const x = t[1]; t[1] = t[2]; t[2] = x; });
  return { tris, closed, volume: Math.abs(vol) };
}

/* the BSP kit: a tree of planes over any closed solid's triangles (or any polygon soup), and the clip that sorts polygons into outside and inside it */
const KITS = new WeakMap();
function bspKit(THREE) {
  if (KITS.has(THREE)) return KITS.get(THREE); const V = THREE.Vector3, EPS = 1e-6;
  const plane = (a, b, c) => { const nn = new V().subVectors(b, a).cross(new V().subVectors(c, a)); const l = nn.length(); if (l < 1e-14) return null; nn.multiplyScalar(1 / l); return { n: nn, w: nn.dot(a) }; };
  const splitPoly = (pl, verts, cf, cb, f, b, pos, lp, sameBack) => {
    let poly = 0; const types = [], T = verts.map(v => { const d = pl.n.dot(pos(v)) - pl.w, ty = d < -EPS ? 2 : d > EPS ? 1 : 0; poly |= ty; types.push(ty); return d; });
    if (poly === 0) { const pn = new V().subVectors(pos(verts[1]), pos(verts[0])).cross(new V().subVectors(pos(verts[2]), pos(verts[0]))); ((pl.n.dot(pn) > 0 && !sameBack) ? cf : cb).push(verts); return; }
    if (poly === 1) { f.push(verts); return; } if (poly === 2) { b.push(verts); return; }
    const fv = [], bv = []; for (let i = 0; i < verts.length; i++) { const j = (i + 1) % verts.length, ti = types[i], tj = types[j], vi = verts[i], vj = verts[j];
      if (ti !== 2) fv.push(vi); if (ti !== 1) bv.push(vi); if ((ti | tj) === 3) { const t = T[i] / (T[i] - T[j]), nv = lp(vi, vj, t); fv.push(nv); bv.push(nv); } }
    if (fv.length >= 3) f.push(fv); if (bv.length >= 3) b.push(bv);
  };
  const posV = v => v, lpV = (a, b, t) => new V().lerpVectors(a, b, t);
  const build = polys => { if (!polys.length) return null; let pl = null; for (let k = 0; k < polys.length && !pl; k++) pl = plane(polys[k][0], polys[k][1], polys[k][2]); if (!pl) return null;
    const node = { pl, polys: [], front: null, back: null }, f = [], b = []; polys.forEach(p => splitPoly(pl, p, node.polys, node.polys, f, b, posV, lpV)); node.front = build(f); node.back = build(b); return node; };
  const walk = (node, polys, wantInside, pos, lp, sameBack) => {   /* sameBack: a polygon lying in a plane and facing the same way counts as inside (so two solids sharing a face keep only one copy of it) */
    if (!polys.length) return []; if (!node) return polys;
    const f = [], b = [], cf = [], cb = []; polys.forEach(p => splitPoly(node.pl, p, cf, cb, f, b, pos, lp, sameBack)); const F = f.concat(cf), B = b.concat(cb), nf = node.front, nb = node.back;
    if (!wantInside) return (nf ? walk(nf, F, false, pos, lp, sameBack) : F).concat(nb ? walk(nb, B, false, pos, lp, sameBack) : []);
    return (nf ? walk(nf, F, true, pos, lp, sameBack) : []).concat(nb ? walk(nb, B, true, pos, lp, sameBack) : B);
  };
  const kit = { V, plane, splitPoly, posV, lpV, build, walk }; KITS.set(THREE, kit); return kit;
}
/* several closed solids as ONE: the faces of each that lie outside all the others (a group of shapes is a single cutter; where two touch, the wall between them goes) */
export function solidUnion(THREE, solids) {
  const K = bspKit(THREE), trees = solids.map(s => K.build(s.tris.map(t => t.map(v => v.clone())))); let out = [];
  solids.forEach((s, i) => { let polys = s.tris.map(t => t.map(v => v.clone())); trees.forEach((tr, j) => { if (j !== i && tr) polys = K.walk(tr, polys, false, K.posV, K.lpV, j < i); }); polys.forEach(p => { for (let k = 1; k < p.length - 1; k++) out.push([p[0], p[k], p[k + 1]]); }); });
  return { tris: out, closed: solids.every(s => s.closed), volume: solids.reduce((a, s) => a + s.volume, 0) };
}

/* stampGeometry(THREE, geo, solid, opts): take the solid away from the body (opts.keep 'outside', default) or keep only what is inside it ('inside').
   The body's skin is clipped exactly by the solid's BSP; then the solid's own faces that lie INSIDE the body become the walls of the space (opts.lining false leaves it a bare hole): they are split exactly where the skin
   crosses them, sorted by whether they sit inside the body (a ray count along three axes against the body's own triangles), turned to face into the space, and given the skin of the nearest body point.
   opts.posed: the body's POSED vertex positions (same space as the solid). opts.restFix(i, d): turns a posed-space step d at body vertex i into a rest-space step (a posed figure); default is the identity.
   Returns { geometry, posed, removed, lining (wall triangles) } or null when nothing changes. */
export function stampGeometry(THREE, geo, solid, opts) {
  opts = opts || {}; const keepIn = opts.keep === 'inside', K = bspKit(THREE), V = K.V, P = geo.attributes.position, n = P.count, PO = opts.posed, restFix = opts.restFix || ((i, d) => d);
  const idx = geo.index ? geo.index.array : null, triN = (idx ? idx.length : n) / 3, names = Object.keys(geo.attributes), attrs = names.map(k => geo.attributes[k]), morphs = geo.morphAttributes && geo.morphAttributes.position ? geo.morphAttributes.position : [];
  const skin = attrs.map(a => a.name === 'skinIndex' || a.name === 'skinWeight'), off = []; let L = 0; attrs.forEach(a => { off.push(L); L += a.itemSize; }); const mOff = L; L += 3 * morphs.length; const pOff = L; L += 3;
  const rec = i => { const o = new Float32Array(L); attrs.forEach((a, k) => { for (let q = 0; q < a.itemSize; q++) o[off[k] + q] = a.array[i * a.itemSize + q]; }); morphs.forEach((m, k) => { for (let q = 0; q < 3; q++) o[mOff + k * 3 + q] = m.array[i * 3 + q]; }); o[pOff] = PO[i * 3]; o[pOff + 1] = PO[i * 3 + 1]; o[pOff + 2] = PO[i * 3 + 2]; return o; };
  const lerp = (a, b, t) => { const o = new Float32Array(L), near = t < 0.5 ? a : b; for (let q = 0; q < L; q++) o[q] = a[q] + (b[q] - a[q]) * t; attrs.forEach((at, k) => { if (skin[k]) for (let q = 0; q < at.itemSize; q++) o[off[k] + q] = near[off[k] + q]; }); return o; };
  const bb = new THREE.Box3(); solid.tris.forEach(t => t.forEach(v => bb.expandByPoint(v)));
  const tree = K.build(solid.tris.map(t => t.map(v => v.clone()))), recPos = v => new V(v[pOff], v[pOff + 1], v[pOff + 2]);
  const outRecs = [], outIdx = [], idOf = new Map(); let changed = false;
  const emit = poly => { if (poly.length < 3) return; const ids = poly.map(v => { let id = idOf.get(v); if (id === undefined) { outRecs.push(v); id = outRecs.length - 1; idOf.set(v, id); } return id; }); for (let i = 1; i < ids.length - 1; i++) outIdx.push(ids[0], ids[i], ids[i + 1]); };
  const cache = new Map(), vr = i => { let o = cache.get(i); if (!o) { o = rec(i); cache.set(i, o); } return o; };
  const lo = bb.min, hi = bb.max; let bodyTouched = false;
  for (let t = 0; t < triN; t++) {
    const ia = idx ? idx[t * 3] : t * 3, ib = idx ? idx[t * 3 + 1] : t * 3 + 1, ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
    let near = true; for (let ax = 0; ax < 3 && near; ax++) { const mn = Math.min(PO[ia * 3 + ax], PO[ib * 3 + ax], PO[ic * 3 + ax]), mx = Math.max(PO[ia * 3 + ax], PO[ib * 3 + ax], PO[ic * 3 + ax]); if (mx < lo.getComponent(ax) || mn > hi.getComponent(ax)) near = false; }
    if (!near) { if (!keepIn) emit([vr(ia), vr(ib), vr(ic)]); continue; }
    const tri = [vr(ia), vr(ib), vr(ic)], res = K.walk(tree, [tri], keepIn, recPos, lerp);
    if (!keepIn && !(res.length === 1 && res[0].length === 3 && res[0].every((v, i) => v === tri[i]))) { changed = true; bodyTouched = true; }
    if (keepIn) bodyTouched = true;
    res.forEach(emit);
  }
  /* ---- the walls ---- */
  let lining = 0;
  if (opts.lining !== false) {
    const TA = new Int32Array(triN * 3); for (let t = 0; t < triN; t++) { TA[t * 3] = idx ? idx[t * 3] : t * 3; TA[t * 3 + 1] = idx ? idx[t * 3 + 1] : t * 3 + 1; TA[t * 3 + 2] = idx ? idx[t * 3 + 2] : t * 3 + 2; }
    const pv = i => new V(PO[i * 3], PO[i * 3 + 1], PO[i * 3 + 2]), body = new THREE.Box3(); for (let i = 0; i < n; i++) body.expandByPoint(pv(i));
    const size = body.getSize(new V()), cell = Math.max(0.005, Math.max(size.x, size.y, size.z) / 60);
    /* a 2D grid per axis over the triangles' shadows, for the ray counts; a 3D grid over their boxes, for what crosses a wall */
    const g2 = [0, 1, 2].map(() => new Map()), g3 = new Map(), ck = (a, b, c) => a + ',' + b + ',' + c;
    for (let t = 0; t < triN; t++) { const ps = [0, 1, 2].map(k => TA[t * 3 + k]), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; ps.forEach(i => { for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], PO[i * 3 + a]); mx[a] = Math.max(mx[a], PO[i * 3 + a]); } });
      for (let ax = 0; ax < 3; ax++) { const u = (ax + 1) % 3, v = (ax + 2) % 3; for (let a = Math.floor(mn[u] / cell); a <= Math.floor(mx[u] / cell); a++) for (let b = Math.floor(mn[v] / cell); b <= Math.floor(mx[v] / cell); b++) { const k = a + ',' + b; let l = g2[ax].get(k); if (!l) { l = []; g2[ax].set(k, l); } l.push(t); } }
      for (let a = Math.floor(mn[0] / cell); a <= Math.floor(mx[0] / cell); a++) for (let b = Math.floor(mn[1] / cell); b <= Math.floor(mx[1] / cell); b++) for (let c = Math.floor(mn[2] / cell); c <= Math.floor(mx[2] / cell); c++) { const k = ck(a, b, c); let l = g3.get(k); if (!l) { l = []; g3.set(k, l); } l.push(t); } }
    const rayHits = (p, ax) => { const u = (ax + 1) % 3, v = (ax + 2) % 3, list = g2[ax].get(Math.floor(p.getComponent(u) / cell) + ',' + Math.floor(p.getComponent(v) / cell)) || []; let c = 0; const pu = p.getComponent(u), pvv = p.getComponent(v), pa = p.getComponent(ax);
      for (const t of list) { const A = pv(TA[t * 3]), B = pv(TA[t * 3 + 1]), C = pv(TA[t * 3 + 2]), au = A.getComponent(u), av = A.getComponent(v), bu = B.getComponent(u), bv = B.getComponent(v), cu = C.getComponent(u), cv = C.getComponent(v);
        const d = (bu - au) * (cv - av) - (cu - au) * (bv - av); if (Math.abs(d) < 1e-14) continue; const w1 = ((pu - au) * (cv - av) - (cu - au) * (pvv - av)) / d, w2 = ((bu - au) * (pvv - av) - (pu - au) * (bv - av)) / d; if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue;
        const ta = A.getComponent(ax) + w1 * (B.getComponent(ax) - A.getComponent(ax)) + w2 * (C.getComponent(ax) - A.getComponent(ax)); if (ta > pa) c++; } return c; };
    const insideBody = p => { let votes = 0; for (let ax = 0; ax < 3; ax++) if (rayHits(p, ax) % 2 === 1) votes++; return votes >= 2; };
    const triPlane = t => K.plane(pv(TA[t * 3]), pv(TA[t * 3 + 1]), pv(TA[t * 3 + 2]));
    const candidates = poly => { const mn = new V(1e9, 1e9, 1e9), mx = new V(-1e9, -1e9, -1e9); poly.forEach(v => { mn.min(v); mx.max(v); }); const seen = new Set();
      for (let a = Math.floor(mn.x / cell); a <= Math.floor(mx.x / cell); a++) for (let b = Math.floor(mn.y / cell); b <= Math.floor(mx.y / cell); b++) for (let c = Math.floor(mn.z / cell); c <= Math.floor(mx.z / cell); c++) (g3.get(ck(a, b, c)) || []).forEach(t => seen.add(t)); return seen; };
    const vgrid = new Map(); for (let i = 0; i < n; i++) { const k = ck(Math.floor(PO[i * 3] / cell), Math.floor(PO[i * 3 + 1] / cell), Math.floor(PO[i * 3 + 2] / cell)); let l = vgrid.get(k); if (!l) { l = []; vgrid.set(k, l); } l.push(i); }
    const nearestV = p => { const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell); for (let r = 1; r <= 8; r++) { let best = -1, bd = 1e30; for (let a = cx - r; a <= cx + r; a++) for (let b = cy - r; b <= cy + r; b++) for (let c = cz - r; c <= cz + r; c++) (vgrid.get(ck(a, b, c)) || []).forEach(i => { const d = (PO[i * 3] - p.x) ** 2 + (PO[i * 3 + 1] - p.y) ** 2 + (PO[i * 3 + 2] - p.z) ** 2; if (d < bd) { bd = d; best = i; } }); if (best >= 0) return best; }
      let best = 0, bd = 1e30; for (let i = 0; i < n; i++) { const d = (PO[i * 3] - p.x) ** 2 + (PO[i * 3 + 1] - p.y) ** 2 + (PO[i * 3 + 2] - p.z) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
    const posAttr = names.indexOf('position'), nrmAttr = names.indexOf('normal'), flip = !keepIn;
    solid.tris.forEach(tri => {
      const pl = K.plane(tri[0], tri[1], tri[2]); if (!pl) return; let frags = [tri.map(v => v.clone())];
      for (const t of candidates(tri)) {   /* every skin triangle that crosses this wall cuts it along its own plane, so no piece is left half in and half out */
        const A = pv(TA[t * 3]), B = pv(TA[t * 3 + 1]), C = pv(TA[t * 3 + 2]), da = pl.n.dot(A) - pl.w, db = pl.n.dot(B) - pl.w, dc = pl.n.dot(C) - pl.w; if ((da > 1e-7 && db > 1e-7 && dc > 1e-7) || (da < -1e-7 && db < -1e-7 && dc < -1e-7)) continue;
        const tp = triPlane(t); if (!tp) continue; const nf = []; frags.forEach(f => { const fr = [], bk = [], cf = [], cb = []; K.splitPoly(tp, f, cf, cb, fr, bk, K.posV, K.lpV); const parts = fr.concat(cf, bk, cb); if (parts.length > 1) nf.push(...parts); else nf.push(f); }); frags = nf; if (frags.length > 3000) break; }
      frags.forEach(f => { const c = new V(); f.forEach(v => c.add(v)); c.multiplyScalar(1 / f.length); if (!insideBody(c)) return;
        const pts = flip ? f.slice().reverse() : f, fn = K.plane(pts[0], pts[1], pts[2]); if (!fn) return; const ids = pts.map(p => { const i = nearestV(p), r = rec(i), d = p.clone().sub(pv(i)), dr = restFix(i, d);
          for (let q = 0; q < 3; q++) r[off[posAttr] + q] = P.array[i * 3 + q] + [dr.x, dr.y, dr.z][q]; r[pOff] = p.x; r[pOff + 1] = p.y; r[pOff + 2] = p.z; for (let k = 0; k < morphs.length; k++) for (let q = 0; q < 3; q++) r[mOff + k * 3 + q] = 0;
          if (nrmAttr >= 0) { const nd = restFix(i, fn.n.clone()).normalize(); r[off[nrmAttr]] = nd.x; r[off[nrmAttr] + 1] = nd.y; r[off[nrmAttr] + 2] = nd.z; } outRecs.push(r); return outRecs.length - 1; });
        for (let i = 1; i < ids.length - 1; i++) { outIdx.push(ids[0], ids[i], ids[i + 1]); lining++; } changed = true; });
    });
  }
  if (!outIdx.length) return null; if (!keepIn && !changed) return null;
  const cnt = outRecs.length, g = new THREE.BufferGeometry();
  attrs.forEach((a, k) => { const arr = new a.array.constructor(cnt * a.itemSize); for (let i = 0; i < cnt; i++) for (let q = 0; q < a.itemSize; q++) arr[i * a.itemSize + q] = outRecs[i][off[k] + q]; const na = new THREE.BufferAttribute(arr, a.itemSize, a.normalized); na.name = a.name; g.setAttribute(names[k], na); });
  if (morphs.length) { g.morphAttributes.position = morphs.map((m, k) => { const arr = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) for (let q = 0; q < 3; q++) arr[i * 3 + q] = outRecs[i][mOff + k * 3 + q]; const na = new THREE.BufferAttribute(arr, 3); na.name = m.name; return na; }); g.morphTargetsRelative = geo.morphTargetsRelative; }
  g.setIndex(new THREE.BufferAttribute(cnt > 65535 ? new Uint32Array(outIdx) : new Uint16Array(outIdx), 1)); g.userData = Object.assign({}, geo.userData);
  const posed = new Float32Array(cnt * 3); for (let i = 0; i < cnt; i++) { posed[i * 3] = outRecs[i][pOff]; posed[i * 3 + 1] = outRecs[i][pOff + 1]; posed[i * 3 + 2] = outRecs[i][pOff + 2]; }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, posed, removed: Math.max(0, triN - (outIdx.length / 3 - lining)), lining };
}
