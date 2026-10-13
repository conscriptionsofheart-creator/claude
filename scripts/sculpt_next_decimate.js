/* sculpt_next_decimate.js: thin a mesh to a triangle budget (quadric error edge collapse, Garland and Heckbert 1997), written here so nothing is bought or fetched. Pure typed arrays, no three.js,
   so the export can run it in the Web Worker (a 100k-triangle copy takes about a second: off the page's thread the headset keeps its frame rate). Used on COPIES only (sculpt_next_export.js).
   decimateArrays({ position: Float32Array, index: Uint32Array | null, color?: Float32Array (3 per point), uv?: Float32Array (2 per point) }, target, opts)
   -> { position, index, color?, uv?, before, after }. Points at one place are joined first (they keep the first point's colour and uv); open edges get a steep plane so outlines stay. */
export function decimateArrays(src, target, opts) {
  opts = opts || {}; const P0 = src.position, n0 = P0.length / 3, I0 = src.index || null, triN = (I0 ? I0.length : n0) / 3;
  if (triN <= target) return { position: P0, index: I0 || Uint32Array.from({ length: n0 }, (_, i) => i), color: src.color, uv: src.uv, before: triN, after: triN };
  const q = 1e6, ids = new Map(), rep = [], vmap = new Int32Array(n0);
  for (let i = 0; i < n0; i++) { const k = Math.round(P0[i * 3] * q) + ',' + Math.round(P0[i * 3 + 1] * q) + ',' + Math.round(P0[i * 3 + 2] * q); let id = ids.get(k); if (id === undefined) { id = rep.length; ids.set(k, id); rep.push(i); } vmap[i] = id; }
  const nv = rep.length, pos = new Float64Array(nv * 3); for (let v = 0; v < nv; v++) { pos[v * 3] = P0[rep[v] * 3]; pos[v * 3 + 1] = P0[rep[v] * 3 + 1]; pos[v * 3 + 2] = P0[rep[v] * 3 + 2]; }
  const F = new Int32Array(triN * 3), faceOk = new Uint8Array(triN); let alive = 0;
  for (let t = 0; t < triN; t++) { const a = vmap[I0 ? I0[t * 3] : t * 3], b = vmap[I0 ? I0[t * 3 + 1] : t * 3 + 1], c = vmap[I0 ? I0[t * 3 + 2] : t * 3 + 2]; F[t * 3] = a; F[t * 3 + 1] = b; F[t * 3 + 2] = c; if (a !== b && b !== c && a !== c) { faceOk[t] = 1; alive++; } }
  const vf = Array.from({ length: nv }, () => []); for (let t = 0; t < triN; t++) if (faceOk[t]) for (let k = 0; k < 3; k++) vf[F[t * 3 + k]].push(t);
  const Qd = new Float64Array(nv * 10), addQ = (v, a, b, c, d, w) => { const o = v * 10; Qd[o] += w * a * a; Qd[o + 1] += w * a * b; Qd[o + 2] += w * a * c; Qd[o + 3] += w * a * d; Qd[o + 4] += w * b * b; Qd[o + 5] += w * b * c; Qd[o + 6] += w * b * d; Qd[o + 7] += w * c * c; Qd[o + 8] += w * c * d; Qd[o + 9] += w * d * d; };
  const fn = new Float64Array(3), faceNormal = t => { const a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; fn[0] = uy * vz - uz * vy; fn[1] = uz * vx - ux * vz; fn[2] = ux * vy - uy * vx; return fn; };
  const edgeUse = new Map(), ek = (a, b) => (a < b ? a * nv + b : b * nv + a);
  for (let t = 0; t < triN; t++) { if (!faceOk[t]) continue; const n = faceNormal(t), L = Math.hypot(n[0], n[1], n[2]); if (L < 1e-20) continue; const a = n[0] / L, b = n[1] / L, c = n[2] / L, v0 = F[t * 3], d = -(a * pos[v0 * 3] + b * pos[v0 * 3 + 1] + c * pos[v0 * 3 + 2]), w = L / 2; for (let k = 0; k < 3; k++) addQ(F[t * 3 + k], a, b, c, d, w);
    for (let k = 0; k < 3; k++) { const u = F[t * 3 + k], v = F[t * 3 + (k + 1) % 3], key = ek(u, v), e = edgeUse.get(key); if (e) e.n++; else edgeUse.set(key, { n: 1, u, v, t }); } }
  edgeUse.forEach(e => { if (e.n !== 1) return; const n = faceNormal(e.t), u = e.u * 3, v = e.v * 3, ex = pos[v] - pos[u], ey = pos[v + 1] - pos[u + 1], ez = pos[v + 2] - pos[u + 2]; let a = ey * n[2] - ez * n[1], b = ez * n[0] - ex * n[2], c = ex * n[1] - ey * n[0]; const L = Math.hypot(a, b, c); if (L < 1e-20) return; a /= L; b /= L; c /= L; const d = -(a * pos[u] + b * pos[u + 1] + c * pos[u + 2]), w = (ex * ex + ey * ey + ez * ez) * 10; addQ(e.u, a, b, c, d, w); addQ(e.v, a, b, c, d, w); });
  const best = new Float64Array(3), Qs = new Float64Array(10);
  const cost = (a, b) => {
    for (let k = 0; k < 10; k++) Qs[k] = Qd[a * 10 + k] + Qd[b * 10 + k];
    const q00 = Qs[0], q01 = Qs[1], q02 = Qs[2], q03 = Qs[3], q11 = Qs[4], q12 = Qs[5], q13 = Qs[6], q22 = Qs[7], q23 = Qs[8], q33 = Qs[9];
    const ev = (x, y, z) => q00 * x * x + 2 * q01 * x * y + 2 * q02 * x * z + 2 * q03 * x + q11 * y * y + 2 * q12 * y * z + 2 * q13 * y + q22 * z * z + 2 * q23 * z + q33;
    const det = q00 * (q11 * q22 - q12 * q12) - q01 * (q01 * q22 - q12 * q02) + q02 * (q01 * q12 - q11 * q02), scale = Math.abs(q00) + Math.abs(q11) + Math.abs(q22);
    if (Math.abs(det) > 1e-12 * scale * scale * scale) {
      const i = 1 / det, x = -i * (q03 * (q11 * q22 - q12 * q12) - q01 * (q13 * q22 - q12 * q23) + q02 * (q13 * q12 - q11 * q23)), y = -i * (q00 * (q13 * q22 - q23 * q12) - q03 * (q01 * q22 - q12 * q02) + q02 * (q01 * q23 - q13 * q02)), z = -i * (q00 * (q11 * q23 - q12 * q13) - q01 * (q01 * q23 - q13 * q02) + q03 * (q01 * q12 - q11 * q02));
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2], L = Math.hypot(pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az);
      if (Math.hypot(x - ax, y - ay, z - az) < L * 2) { best[0] = x; best[1] = y; best[2] = z; return Math.max(0, ev(x, y, z)); }   /* far away means a nearly flat quadric: use the ends */
    }
    let bc = Infinity; for (const s of [0, 0.5, 1]) { const x = pos[a * 3] + (pos[b * 3] - pos[a * 3]) * s, y = pos[a * 3 + 1] + (pos[b * 3 + 1] - pos[a * 3 + 1]) * s, z = pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * s, c = ev(x, y, z); if (c < bc) { bc = c; best[0] = x; best[1] = y; best[2] = z; } }
    return Math.max(0, bc);
  };
  /* a min-heap of candidate pairs; a pair is stale when either end changed after it was pushed */
  const hc = [], ha = [], hb = [], hva = [], hvb = [], ver = new Int32Array(nv), dead = new Uint8Array(nv);
  const swapH = (i, j) => { let t = hc[i]; hc[i] = hc[j]; hc[j] = t; t = ha[i]; ha[i] = ha[j]; ha[j] = t; t = hb[i]; hb[i] = hb[j]; hb[j] = t; t = hva[i]; hva[i] = hva[j]; hva[j] = t; t = hvb[i]; hvb[i] = hvb[j]; hvb[j] = t; };
  const push = (c, a, b) => { let i = hc.length; hc.push(c); ha.push(a); hb.push(b); hva.push(ver[a]); hvb.push(ver[b]); while (i > 0) { const p = (i - 1) >> 1; if (hc[p] <= hc[i]) break; swapH(p, i); i = p; } };
  const popTo = out => { out[0] = ha[0]; out[1] = hb[0]; out[2] = hva[0]; out[3] = hvb[0]; const last = hc.length - 1; swapH(0, last); hc.pop(); ha.pop(); hb.pop(); hva.pop(); hvb.pop(); let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hc.length && hc[l] < hc[m]) m = l; if (r < hc.length && hc[r] < hc[m]) m = r; if (m === i) break; swapH(m, i); i = m; } };
  edgeUse.forEach(e => push(cost(e.u, e.v), e.u, e.v));
  const nbrs = v => { const s = new Set(); for (const t of vf[v]) if (faceOk[t]) for (let k = 0; k < 3; k++) if (F[t * 3 + k] !== v) s.add(F[t * 3 + k]); return s; };
  const flips = (v, other, x, y, z) => {   /* would moving v to (x, y, z) turn one of its faces (not shared with other) over or into a sliver? */
    for (const t of vf[v]) { if (!faceOk[t]) continue; if (F[t * 3] === other || F[t * 3 + 1] === other || F[t * 3 + 2] === other) continue;
      const n0 = faceNormal(t), l0 = Math.hypot(n0[0], n0[1], n0[2]), ax = n0[0], ay = n0[1], az = n0[2], sx = pos[v * 3], sy = pos[v * 3 + 1], sz = pos[v * 3 + 2]; pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
      const n1 = faceNormal(t), l1 = Math.hypot(n1[0], n1[1], n1[2]), dot = ax * n1[0] + ay * n1[1] + az * n1[2]; pos[v * 3] = sx; pos[v * 3 + 1] = sy; pos[v * 3 + 2] = sz;
      if (l1 < 1e-24 || dot < 0.2 * l0 * l1) return true; }
    return false;
  };
  const e4 = [0, 0, 0, 0];
  while (alive > target && hc.length) {
    popTo(e4); const a = e4[0], b = e4[1]; if (dead[a] || dead[b] || ver[a] !== e4[2] || ver[b] !== e4[3]) continue;
    const na = nbrs(a), nb = nbrs(b); if (!na.has(b)) continue; let shared = 0; na.forEach(x => { if (nb.has(x)) shared++; }); if (shared > 2) continue;   /* the link condition: joining would pinch the surface */
    cost(a, b); const x = best[0], y = best[1], z = best[2]; if (flips(a, b, x, y, z) || flips(b, a, x, y, z)) continue;
    pos[a * 3] = x; pos[a * 3 + 1] = y; pos[a * 3 + 2] = z; for (let k = 0; k < 10; k++) Qd[a * 10 + k] += Qd[b * 10 + k]; dead[b] = 1; ver[a]++;
    for (const t of vf[b]) { if (!faceOk[t]) continue; if (F[t * 3] === a || F[t * 3 + 1] === a || F[t * 3 + 2] === a) { faceOk[t] = 0; alive--; continue; } for (let k = 0; k < 3; k++) if (F[t * 3 + k] === b) F[t * 3 + k] = a; vf[a].push(t); }
    vf[b] = []; nbrs(a).forEach(u => push(cost(a, u), a, u));   /* only pairs that touch the joined point changed */
  }
  const remap = new Int32Array(nv).fill(-1), outI = []; let cnt = 0; for (let t = 0; t < triN; t++) { if (!faceOk[t]) continue; for (let k = 0; k < 3; k++) { const v = F[t * 3 + k]; if (remap[v] < 0) remap[v] = cnt++; outI.push(remap[v]); } }
  const position = new Float32Array(cnt * 3); for (let v = 0; v < nv; v++) if (remap[v] >= 0) { position[remap[v] * 3] = pos[v * 3]; position[remap[v] * 3 + 1] = pos[v * 3 + 1]; position[remap[v] * 3 + 2] = pos[v * 3 + 2]; }
  const carry = (A, sz) => { if (!A) return undefined; const o = new Float32Array(cnt * sz); for (let v = 0; v < nv; v++) if (remap[v] >= 0) for (let k = 0; k < sz; k++) o[remap[v] * sz + k] = A[rep[v] * sz + k]; return o; };
  return { position, index: Uint32Array.from(outI), color: carry(src.color, 3), uv: carry(src.uv, 2), before: triN, after: outI.length / 3 };
}
