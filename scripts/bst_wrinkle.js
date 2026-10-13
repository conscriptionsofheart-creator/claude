/* WRINKLES (Ruth 2026-10-11: "I'm using the sculpting tool to try and make wrinkles and am not finding anything that lets me do that").
   wrinkleGeometry(THREE, geo, ball, opts): a fine groove brush. Under the ball { c, r } (mesh space, r in the same units) the skin's triangles are split until no edge is longer than opts.maxEdge
   (so a groove 2 mm wide has points to bend), then every point inside the ball is pushed in along its own normal by opts.depth * falloff, and the normals around it are worked out again so the groove
   catches the light. Old points keep their numbers, new points are added at the end (so a stroke's earlier marks, shape keys and the skin of the shells stay valid).
   opts.posed = Float32Array of every point's POSED position (mesh space), as carveGeometry takes it. opts.depth = how far to push in at the middle (mesh units).
   opts.maxEdge = longest edge left under the ball (default 0.8 * r). opts.minEdge = never split edges shorter than this (default 1.5 mm). opts.maxPoints = stop adding points past this (default 130000).
   Returns { geometry, posed, added, moved } or null when no point lies inside the ball. */
export function wrinkleGeometry(THREE, geo, ball, opts) {
  opts = opts || {};
  const c = ball.c, R = ball.r, PO0 = opts.posed, P0 = geo.attributes.position, n0 = P0.count;
  if (!PO0 || PO0.length < n0 * 3) return null;
  const names = Object.keys(geo.attributes), attrs = names.map(k => geo.attributes[k]), nIdx = names.indexOf('normal'), pIdx = names.indexOf('position');
  if (nIdx < 0) return null;
  const morphs = (geo.morphAttributes && geo.morphAttributes.position) || [], skinNames = ['skinIndex', 'skinWeight'];
  const idx0 = geo.index ? geo.index.array : null, triN = (idx0 ? idx0.length : n0) / 3;
  const target = Math.max(opts.minEdge || 0.0015, opts.maxEdge || R * 0.8), maxPts = opts.maxPoints || 130000, rr = R * 1.7;
  const cx = c.x, cy = c.y, cz = c.z;

  /* the points added so far: one array per attribute, one per shape key, and their posed positions */
  const E = attrs.map(() => []), EM = morphs.map(() => []), EP = []; let extra = 0;
  const get = (k, i, q) => (i < n0 ? attrs[k].array[i * attrs[k].itemSize + q] : E[k][(i - n0) * attrs[k].itemSize + q]);
  const posedOf = (i, ax) => (i < n0 ? PO0[i * 3 + ax] : EP[(i - n0) * 3 + ax]);
  const restOf = (i, ax) => get(pIdx, i, ax);
  const mids = new Map();
  const mid = (a, b) => {
    const key = a < b ? a * 4194304 + b : b * 4194304 + a; let id = mids.get(key); if (id !== undefined) return id;
    id = n0 + extra++; mids.set(key, id);
    attrs.forEach((at, k) => {
      const sz = at.itemSize, isF = at.array instanceof Float32Array || at.array instanceof Float64Array;
      if (skinNames.includes(names[k]) || !isF) for (let j = 0; j < sz; j++) E[k].push(get(k, a, j));
      else { for (let j = 0; j < sz; j++) E[k].push((get(k, a, j) + get(k, b, j)) / 2); if (k === nIdx) { const o = E[k].length - 3, l = Math.hypot(E[k][o], E[k][o + 1], E[k][o + 2]) || 1; E[k][o] /= l; E[k][o + 1] /= l; E[k][o + 2] /= l; } }
    });
    morphs.forEach((m, k) => { for (let j = 0; j < 3; j++) EM[k].push(((i2 => (i2 < n0 ? m.array[i2 * 3 + j] : EM[k][(i2 - n0) * 3 + j]))(a) + (i2 => (i2 < n0 ? m.array[i2 * 3 + j] : EM[k][(i2 - n0) * 3 + j]))(b)) / 2); });
    for (let ax = 0; ax < 3; ax++) EP.push((posedOf(a, ax) + posedOf(b, ax)) / 2);
    return id;
  };
  const dist = (i) => Math.hypot(posedOf(i, 0) - cx, posedOf(i, 1) - cy, posedOf(i, 2) - cz);
  const len = (a, b) => Math.hypot(posedOf(a, 0) - posedOf(b, 0), posedOf(a, 1) - posedOf(b, 1), posedOf(a, 2) - posedOf(b, 2));

  /* the triangles whose box meets the ball (with margin): they are the ones that can change */
  const farIdx = []; let near = [], any = false;
  for (let t = 0; t < triN; t++) {
    const a = idx0 ? idx0[t * 3] : t * 3, b = idx0 ? idx0[t * 3 + 1] : t * 3 + 1, d = idx0 ? idx0[t * 3 + 2] : t * 3 + 2;
    let hit = true;
    for (let ax = 0; ax < 3 && hit; ax++) { const o = ax === 0 ? cx : ax === 1 ? cy : cz, p = PO0[a * 3 + ax] - o, q = PO0[b * 3 + ax] - o, s = PO0[d * 3 + ax] - o; if (Math.min(p, q, s) > rr || Math.max(p, q, s) < -rr) hit = false; }
    if (hit) { near.push([a, b, d]); if (!any && (dist(a) < R || dist(b) < R || dist(d) < R)) any = true; } else farIdx.push(a, b, d);
  }
  if (!near.length || !any) return null;

  /* split the long edges under the ball, a round at a time (a triangle with 1, 2 or 3 split edges becomes 2, 3 or 4 triangles; both triangles on an edge share its new point, so nothing tears) */
  for (let round = 0; round < 4; round++) {
    const want = new Map(); let any2 = false;
    for (const tri of near) for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3]; if (len(a, b) <= target || len(a, b) < 2 * (opts.minEdge || 0.0015)) continue;
      const mx = (posedOf(a, 0) + posedOf(b, 0)) / 2 - cx, my = (posedOf(a, 1) + posedOf(b, 1)) / 2 - cy, mz = (posedOf(a, 2) + posedOf(b, 2)) / 2 - cz;
      if (Math.hypot(mx, my, mz) > R * 1.5) continue; want.set(a < b ? a * 4194304 + b : b * 4194304 + a, 1); any2 = true;
    }
    if (!any2 || n0 + extra + want.size > maxPts) break;
    const mOf = (a, b) => (want.has(a < b ? a * 4194304 + b : b * 4194304 + a) ? mid(a, b) : -1), out = [];
    for (const [a, b, c2] of near) {
      const m0 = mOf(a, b), m1 = mOf(b, c2), m2 = mOf(c2, a), s = (m0 >= 0 ? 1 : 0) + (m1 >= 0 ? 2 : 0) + (m2 >= 0 ? 4 : 0);
      switch (s) {
        case 0: out.push([a, b, c2]); break;
        case 1: out.push([a, m0, c2], [m0, b, c2]); break;
        case 2: out.push([b, m1, a], [m1, c2, a]); break;
        case 4: out.push([c2, m2, b], [m2, a, b]); break;
        case 3: out.push([m0, b, m1], [a, m0, m1], [a, m1, c2]); break;
        case 6: out.push([m1, c2, m2], [b, m1, m2], [b, m2, a]); break;
        case 5: out.push([m2, a, m0], [c2, m2, m0], [c2, m0, b]); break;
        default: out.push([a, m0, m2], [m0, b, m1], [m2, m1, c2], [m0, m1, m2]);
      }
    }
    near = out;
  }

  /* the new arrays: old points first, in their old places, new points after them */
  const cnt = n0 + extra, G = new THREE.BufferGeometry(), NP = new Float32Array(cnt * 3), NN = new Float32Array(cnt * 3), posed = new Float32Array(cnt * 3);
  attrs.forEach((at, k) => {
    let arr;
    if (names[k] === 'position' || names[k] === 'normal') { arr = new at.array.constructor(cnt * 3); arr.set(at.array); for (let i = 0; i < E[k].length; i++) arr[n0 * 3 + i] = E[k][i]; }
    else if (!extra) { G.setAttribute(names[k], at); return; }   /* nothing added: the other attributes are shared with the old geometry */
    else { arr = new at.array.constructor(cnt * at.itemSize); arr.set(at.array); for (let i = 0; i < E[k].length; i++) arr[n0 * at.itemSize + i] = E[k][i]; }
    const na = new THREE.BufferAttribute(arr, at.itemSize, at.normalized); na.name = at.name; G.setAttribute(names[k], na);
  });
  const PA = G.attributes.position.array, NA = G.attributes.normal.array;
  posed.set(PO0.subarray(0, n0 * 3)); for (let i = 0; i < EP.length; i++) posed[n0 * 3 + i] = EP[i];
  if (morphs.length) { G.morphAttributes.position = morphs.map((m, k) => { const arr = new Float32Array(cnt * 3); arr.set(m.array); for (let i = 0; i < EM[k].length; i++) arr[n0 * 3 + i] = EM[k][i]; const na = new THREE.BufferAttribute(arr, 3); na.name = m.name; return na; }); G.morphTargetsRelative = geo.morphTargetsRelative; }

  /* push the points inside the ball in along their normals, softest at the edge of the ball */
  const touched = new Set(near.flat()); let moved = 0; const depth = opts.depth || R * 0.25;
  for (const v of touched) {
    const d = dist(v); if (d >= R) continue; const f = 1 - (d / R) * (d / R), w = f * f * depth, nx = NA[v * 3], ny = NA[v * 3 + 1], nz = NA[v * 3 + 2];
    PA[v * 3] -= nx * w; PA[v * 3 + 1] -= ny * w; PA[v * 3 + 2] -= nz * w; posed[v * 3] -= nx * w; posed[v * 3 + 1] -= ny * w; posed[v * 3 + 2] -= nz * w; moved++;
  }
  /* normals again for the points within 1.5 balls: area-weighted from the triangles round them, shared between points that sit in one place (a texture seam), so the groove shades smoothly across it */
  const key = v => Math.round(PA[v * 3] * 1e5) + ',' + Math.round(PA[v * 3 + 1] * 1e5) + ',' + Math.round(PA[v * 3 + 2] * 1e5), acc = new Map(), inReach = v => dist(v) < R * 1.5;
  for (const [a, b, d] of near) {
    const ux = PA[b * 3] - PA[a * 3], uy = PA[b * 3 + 1] - PA[a * 3 + 1], uz = PA[b * 3 + 2] - PA[a * 3 + 2], vx = PA[d * 3] - PA[a * 3], vy = PA[d * 3 + 1] - PA[a * 3 + 1], vz = PA[d * 3 + 2] - PA[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const v of [a, b, d]) { if (!inReach(v)) continue; const k = key(v); let s = acc.get(k); if (!s) { s = [0, 0, 0]; acc.set(k, s); } s[0] += fx; s[1] += fy; s[2] += fz; }
  }
  for (const v of touched) { if (!inReach(v)) continue; const s = acc.get(key(v)); if (!s) continue; const l = Math.hypot(s[0], s[1], s[2]); if (l < 1e-12) continue;
    const ox = NA[v * 3], oy = NA[v * 3 + 1], oz = NA[v * 3 + 2], nx = s[0] / l, ny = s[1] / l, nz = s[2] / l;
    if (ox * nx + oy * ny + oz * nz < 0) { NA[v * 3] = -nx; NA[v * 3 + 1] = -ny; NA[v * 3 + 2] = -nz; } else { NA[v * 3] = nx; NA[v * 3 + 1] = ny; NA[v * 3 + 2] = nz; } }   /* keep the side the old normal faced (a mesh wound the other way stays that way) */

  const idxOut = farIdx.slice(); for (const t of near) idxOut.push(t[0], t[1], t[2]);
  G.setIndex(new THREE.BufferAttribute(cnt > 65535 ? new Uint32Array(idxOut) : new Uint16Array(idxOut), 1));
  G.userData = Object.assign({}, geo.userData); G.computeBoundingBox(); G.computeBoundingSphere();
  return { geometry: G, posed, added: extra, moved };
}
