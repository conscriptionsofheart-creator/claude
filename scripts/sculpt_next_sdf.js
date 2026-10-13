/* sculpt_next_sdf.js: the clay itself (Ruth 2026-10-13: "sculpt objects in VR as well as in Adobe Substance 3D Modeler"). Substance keeps clay as a volume and meshes it on the fly, so you never think about
   triangles; this is the same idea sized for a Quest in a browser. Pure: no three.js, no page, so it runs in the page and in a Web Worker alike.
   A FIELD is a signed distance, sampled on a grid of h metres (in the layer's own space): below 0 is inside the clay, above 0 is air. Only a narrow band round the surface is stored, in bricks of 8 x 8 x 8 samples:
   a missing brick is air, the INSIDE brick is solid clay all through, any other brick holds 512 distances and 512 colours. So a fist-sized lump costs a few hundred kB, not a dense block of megabytes.
   Every change goes through read() and write(): an operation reads a box of samples, changes them, writes them back. write() can fill a snapshot map first (the bricks as they were), which is the undo of a stroke. */
export const B = 8, B3 = 512;
export const INSIDE = Object.freeze({ inside: true });
const OFS = 4096, SPAN = 8192;   /* brick coordinates from -4096 to 4095: 262 m of clay at 8 mm, far more than a room */
export const bkey = (bx, by, bz) => ((bx + OFS) * SPAN + (by + OFS)) * SPAN + (bz + OFS);
export const bunkey = k => { const bz = k % SPAN, r = (k - bz) / SPAN, by = r % SPAN, bx = (r - by) / SPAN; return [bx - OFS, by - OFS, bz - OFS]; };
const floorDiv = (a, b) => Math.floor(a / b);

/* falloff: how much of the brush reaches a point t of the way from the middle (0) to the rim (1). Substance calls it hardness. */
export function falloff(kind) {
  if (kind === 'linear') return t => (t >= 1 ? 0 : 1 - t);
  if (kind === 'sharp') return t => { if (t >= 1) return 0; const u = 1 - t; return u * u * u; };
  if (kind === 'flat') return t => (t >= 1 ? 0 : t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
  return t => { if (t >= 1) return 0; const u = 1 - t * t; return u * u; };   /* 'smooth', the old engine's soft edge */
}
/* soft union and soft difference (polynomial smooth min, k = how wide the blend is, in metres) */
export function smin(a, b, k) { if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export function smax(a, b, k) { return -smin(-a, -b, k); }

export function createField(opts) {
  opts = opts || {};
  const h = opts.h || 0.005, band = opts.band || h * 4, base = opts.color || [214, 196, 170];
  const f = { h, band, base: base.slice(0, 3), bricks: new Map(), version: 0 };
  f.newBrick = (fill) => { const d = new Float32Array(B3).fill(fill), c = new Uint8Array(B3 * 3); for (let i = 0; i < B3; i++) { c[i * 3] = f.base[0]; c[i * 3 + 1] = f.base[1]; c[i * 3 + 2] = f.base[2]; } return { d, c }; };
  /* read a box of nx x ny x nz samples starting at sample (i0, j0, k0); index x + nx * (y + ny * z) */
  f.read = (i0, j0, k0, nx, ny, nz) => {
    const n = nx * ny * nz, d = new Float32Array(n), c = new Uint8Array(n * 3);
    const bx0 = floorDiv(i0, B), by0 = floorDiv(j0, B), bz0 = floorDiv(k0, B), bx1 = floorDiv(i0 + nx - 1, B), by1 = floorDiv(j0 + ny - 1, B), bz1 = floorDiv(k0 + nz - 1, B);
    const b0 = f.base[0], b1 = f.base[1], b2 = f.base[2];
    for (let bz = bz0; bz <= bz1; bz++) for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      const br = f.bricks.get(bkey(bx, by, bz));
      const xa = Math.max(i0, bx * B), xb = Math.min(i0 + nx, bx * B + B), ya = Math.max(j0, by * B), yb = Math.min(j0 + ny, by * B + B), za = Math.max(k0, bz * B), zb = Math.min(k0 + nz, bz * B + B);
      for (let z = za; z < zb; z++) for (let y = ya; y < yb; y++) {
        let o = (xa - i0) + nx * ((y - j0) + ny * (z - k0));
        if (!br || br === INSIDE) { const v = br ? -band : band; for (let x = xa; x < xb; x++, o++) { d[o] = v; c[o * 3] = b0; c[o * 3 + 1] = b1; c[o * 3 + 2] = b2; } continue; }
        let s = (xa - bx * B) + B * ((y - by * B) + B * (z - bz * B));
        for (let x = xa; x < xb; x++, o++, s++) { d[o] = br.d[s]; c[o * 3] = br.c[s * 3]; c[o * 3 + 1] = br.c[s * 3 + 1]; c[o * 3 + 2] = br.c[s * 3 + 2]; }
      }
    }
    return { d, c, i0, j0, k0, nx, ny, nz };
  };
  /* copy a brick's present state into a snapshot map, once per stroke (undefined = air, INSIDE, or a copy) */
  const snapOne = (snap, k) => { if (!snap || snap.has(k)) return; const br = f.bricks.get(k); snap.set(k, !br || br === INSIDE ? br : { d: br.d.slice(), c: br.c.slice() }); };
  /* write a region back: bricks that end up all air are dropped, all solid become INSIDE. Returns the number of bricks touched. */
  f.write = (reg, snap) => {
    const { d, c, i0, j0, k0, nx, ny, nz } = reg; let touched = 0;
    const bx0 = floorDiv(i0, B), by0 = floorDiv(j0, B), bz0 = floorDiv(k0, B), bx1 = floorDiv(i0 + nx - 1, B), by1 = floorDiv(j0 + ny - 1, B), bz1 = floorDiv(k0 + nz - 1, B);
    for (let bz = bz0; bz <= bz1; bz++) for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      const k = bkey(bx, by, bz); let br = f.bricks.get(k);
      const xa = Math.max(i0, bx * B), xb = Math.min(i0 + nx, bx * B + B), ya = Math.max(j0, by * B), yb = Math.min(j0 + ny, by * B + B), za = Math.max(k0, bz * B), zb = Math.min(k0 + nz, bz * B + B);
      if (!br || br === INSIDE) {   /* nothing to do when the region keeps the brick all air (or all solid) */
        const lim = br ? -band : band; let same = true;
        for (let z = za; z < zb && same; z++) for (let y = ya; y < yb && same; y++) { let o = (xa - i0) + nx * ((y - j0) + ny * (z - k0)); for (let x = xa; x < xb; x++, o++) { if (br ? d[o] > lim : d[o] < lim) { same = false; break; } if (c[o * 3] !== f.base[0] || c[o * 3 + 1] !== f.base[1] || c[o * 3 + 2] !== f.base[2]) { if (br) { same = false; break; } } } }
        if (same) continue;
        snapOne(snap, k); br = f.newBrick(br ? -band : band); f.bricks.set(k, br);
      } else snapOne(snap, k);
      touched++;
      for (let z = za; z < zb; z++) for (let y = ya; y < yb; y++) {
        let o = (xa - i0) + nx * ((y - j0) + ny * (z - k0)), s = (xa - bx * B) + B * ((y - by * B) + B * (z - bz * B));
        for (let x = xa; x < xb; x++, o++, s++) { const v = d[o]; br.d[s] = v > band ? band : v < -band ? -band : v; br.c[s * 3] = c[o * 3]; br.c[s * 3 + 1] = c[o * 3 + 1]; br.c[s * 3 + 2] = c[o * 3 + 2]; }
      }
      let allOut = true, allIn = true; for (let s = 0; s < B3; s++) { const v = br.d[s]; if (v < band) allOut = false; if (v > -band) allIn = false; if (!allOut && !allIn) break; }
      if (allOut) f.bricks.delete(k); else if (allIn) f.bricks.set(k, INSIDE);
    }
    if (touched) f.version++;
    return touched;
  };
  /* undo: put the snapshot back; returns the snapshot of what was there (redo) and the brick keys (so the caller can remesh them) */
  f.restore = snap => {
    const back = new Map(); snap.forEach((v, k) => { snapOne(back, k); if (v === undefined) f.bricks.delete(k); else f.bricks.set(k, v === INSIDE ? INSIDE : { d: v.d.slice(), c: v.c.slice() }); });
    f.version++; return back;
  };
  /* the sample box holding every brick that is not air: [i0, j0, k0, i1, j1, k1] inclusive, or null when empty */
  f.bounds = () => {
    if (!f.bricks.size) return null; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    f.bricks.forEach((_, k) => { const b = bunkey(k); for (let a = 0; a < 3; a++) { if (b[a] < lo[a]) lo[a] = b[a]; if (b[a] > hi[a]) hi[a] = b[a]; } });
    return [lo[0] * B, lo[1] * B, lo[2] * B, hi[0] * B + B - 1, hi[1] * B + B - 1, hi[2] * B + B - 1];
  };
  /* one sample, and a trilinear reading at a point in metres (layer space) */
  f.at = (i, j, k) => { const br = f.bricks.get(bkey(floorDiv(i, B), floorDiv(j, B), floorDiv(k, B))); if (!br) return band; if (br === INSIDE) return -band; return br.d[(i - floorDiv(i, B) * B) + B * ((j - floorDiv(j, B) * B) + B * (k - floorDiv(k, B) * B))]; };
  f.sample = (x, y, z) => {
    const gx = x / h, gy = y / h, gz = z / h, i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz), u = gx - i, v = gy - j, w = gz - k;
    const c00 = f.at(i, j, k) * (1 - u) + f.at(i + 1, j, k) * u, c10 = f.at(i, j + 1, k) * (1 - u) + f.at(i + 1, j + 1, k) * u, c01 = f.at(i, j, k + 1) * (1 - u) + f.at(i + 1, j, k + 1) * u, c11 = f.at(i, j + 1, k + 1) * (1 - u) + f.at(i + 1, j + 1, k + 1) * u;
    return (c00 * (1 - v) + c10 * v) * (1 - w) + (c01 * (1 - v) + c11 * v) * w;
  };
  f.colorAt = (x, y, z) => { const i = Math.round(x / h), j = Math.round(y / h), k = Math.round(z / h), br = f.bricks.get(bkey(floorDiv(i, B), floorDiv(j, B), floorDiv(k, B))); if (!br || br === INSIDE) return f.base; const s = (i - floorDiv(i, B) * B) + B * ((j - floorDiv(j, B) * B) + B * (k - floorDiv(k, B) * B)); return [br.c[s * 3], br.c[s * 3 + 1], br.c[s * 3 + 2]]; };
  f.gradient = (x, y, z, out) => { const e = h; out = out || [0, 0, 0]; out[0] = f.sample(x + e, y, z) - f.sample(x - e, y, z); out[1] = f.sample(x, y + e, z) - f.sample(x, y - e, z); out[2] = f.sample(x, y, z + e) - f.sample(x, y, z - e); const L = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= L; out[1] /= L; out[2] /= L; return out; };
  f.clone = () => { const g = createField({ h, band, color: f.base }); f.bricks.forEach((v, k) => g.bricks.set(k, v === INSIDE ? INSIDE : { d: v.d.slice(), c: v.c.slice() })); return g; };
  f.bytes = () => { let n = 0; f.bricks.forEach(v => { if (v !== INSIDE) n += B3 * 7; }); return n; };
  f.empty = () => { for (const v of f.bricks.values()) if (v === INSIDE || v.d.some(x => x < 0)) return false; return true; };
  return f;
}

/* ---------- the operations a brush, a shape or a merge does to a field. Each takes the box it may change (in metres, layer space), returns the sample box it changed or null. ---------- */
const box = (f, lo, hi, pad) => { const h = f.h, p = pad || 0; const i0 = Math.floor(lo[0] / h) - p, j0 = Math.floor(lo[1] / h) - p, k0 = Math.floor(lo[2] / h) - p, i1 = Math.ceil(hi[0] / h) + p, j1 = Math.ceil(hi[1] / h) + p, k1 = Math.ceil(hi[2] / h) + p; return [i0, j0, k0, i1 - i0 + 1, j1 - j0 + 1, k1 - k0 + 1]; };
const doneBox = r => [r.i0, r.j0, r.k0, r.i0 + r.nx - 1, r.j0 + r.ny - 1, r.k0 + r.nz - 1];
const MAX_SAMPLES = 900000;   /* about 3.6 MB of distances: a bigger box would stall the frame, so the caller is told no (the brush is too big for this clay's detail) */

/* a shape: dist(x, y, z) is its signed distance in metres; mode 'add' (soft union with blend k), 'subtract', 'intersect' (only inside the box: the caller handles the rest of the layer), 'paint' (colour only, inside the shape).
   color [r, g, b] is what added clay or paint becomes; amount 0..1 how strongly paint covers. */
/* in place, brick by brick: a brick the shape cannot reach is never read (the distance is 1-Lipschitz, so the distance at a brick's middle minus half its diagonal bounds every sample in it),
   and a brick is copied for undo and made solid only when a sample in it really changes. This is the hot path of every clay stroke, shape and saw pass. */
export function opShape(f, lo, hi, dist, mode, k, color, snap, amount) {
  const pad = Math.ceil((f.band + k) / f.h) + 1, [i0, j0, k0, nx, ny, nz] = box(f, lo, hi, pad); if (nx * ny * nz > MAX_SAMPLES) return null;
  const h = f.h, h2 = h * 2, band = f.band, a = amount == null ? 1 : amount, half = 3.5 * h * Math.sqrt(3), reach = mode === 'paint' ? 0 : band + k, base = f.base;
  const bx0 = Math.floor(i0 / B), by0 = Math.floor(j0 / B), bz0 = Math.floor(k0 / B), bx1 = Math.floor((i0 + nx - 1) / B), by1 = Math.floor((j0 + ny - 1) / B), bz1 = Math.floor((k0 + nz - 1) / B);
  let changed = false, ci0 = 1e9, cj0 = 1e9, ck0 = 1e9, ci1 = -1e9, cj1 = -1e9, ck1 = -1e9;
  for (let bz = bz0; bz <= bz1; bz++) for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
    const dc = dist((bx * B + 3.5) * h, (by * B + 3.5) * h, (bz * B + 3.5) * h); if (dc - half > reach) continue;
    const key = bkey(bx, by, bz); let br = f.bricks.get(key);
    if (mode === 'subtract' && !br) continue; if (mode === 'paint' && (!br || br === INSIDE)) continue; if (mode === 'add' && br === INSIDE) continue;
    const whole = bx * B >= i0 && by * B >= j0 && bz * B >= k0 && bx * B + B <= i0 + nx && by * B + B <= j0 + ny && bz * B + B <= k0 + nz;
    if (whole && dc + half < -band - k && (mode === 'add' || mode === 'subtract')) {   /* the whole brick lies deep inside the tool: it becomes solid (add) or air (subtract) in one step, no sample by sample */
      if (snap && !snap.has(key)) snap.set(key, !br || br === INSIDE ? br : { d: br.d.slice(), c: br.c.slice() });
      if (mode === 'add') f.bricks.set(key, INSIDE); else f.bricks.delete(key); changed = true;
      if (bx * B < ci0) ci0 = bx * B; if (by * B < cj0) cj0 = by * B; if (bz * B < ck0) ck0 = bz * B; if (bx * B + B - 1 > ci1) ci1 = bx * B + B - 1; if (by * B + B - 1 > cj1) cj1 = by * B + B - 1; if (bz * B + B - 1 > ck1) ck1 = bz * B + B - 1;
      continue;
    }
    let own = false; const fill = br === INSIDE ? -band : band, src = br && br !== INSIDE ? br : null;
    const xa = Math.max(i0, bx * B), xb = Math.min(i0 + nx, bx * B + B), ya = Math.max(j0, by * B), yb = Math.min(j0 + ny, by * B + B), za = Math.max(k0, bz * B), zb = Math.min(k0 + nz, bz * B + B);
    for (let z = za; z < zb; z++) for (let y = ya; y < yb; y++) {
      let s = (xa - bx * B) + B * ((y - by * B) + B * (z - bz * B)); const Y = y * h, Z = z * h;
      for (let x = xa; x < xb; x++, s++) {
        const old = src ? src.d[s] : fill, sd = dist(x * h, Y, Z); let nv = old, paint = 0;
        if (mode === 'paint') { if (sd < 0 && old < band) paint = Math.min(1, a * Math.min(1, -sd / h2)); else continue; }
        else if (mode === 'add') { if (sd >= old + k || sd > band + k) continue; nv = smin(old, sd, k); if (color && nv < h2 && nv > -h2) paint = sd <= old ? 1 : 1 - (sd - old) / (k + 1e-9); }
        else if (mode === 'subtract') { if (sd > band + k || old >= band || -sd <= old - k) continue; nv = smax(old, -sd, k); }
        else if (mode === 'intersect') nv = smax(old, sd, k);
        if (nv > band) nv = band; else if (nv < -band) nv = -band;
        if (nv === old && !paint) continue;
        if (!own) {   /* first real change in this brick: keep the old one for undo, then work on our own copy */
          if (snap && !snap.has(key)) snap.set(key, !br || br === INSIDE ? br : { d: br.d.slice(), c: br.c.slice() });
          if (!src) { br = f.newBrick(fill); f.bricks.set(key, br); } own = true;
        }
        const tgt = src || br; tgt.d[s] = nv;
        if (paint) { const o3 = s * 3; tgt.c[o3] = tgt.c[o3] + (color[0] - tgt.c[o3]) * paint + 0.5; tgt.c[o3 + 1] = tgt.c[o3 + 1] + (color[1] - tgt.c[o3 + 1]) * paint + 0.5; tgt.c[o3 + 2] = tgt.c[o3 + 2] + (color[2] - tgt.c[o3 + 2]) * paint + 0.5; }
      }
    }
    if (!own) continue; changed = true; const tgt = f.bricks.get(key);
    let allOut = true, allIn = true; for (let s = 0; s < B3; s++) { const v = tgt.d[s]; if (v < band) allOut = false; if (v > -band) allIn = false; if (!allOut && !allIn) break; }
    if (allOut) f.bricks.delete(key); else if (allIn) f.bricks.set(key, INSIDE);
    if (bx * B < ci0) ci0 = bx * B; if (by * B < cj0) cj0 = by * B; if (bz * B < ck0) ck0 = bz * B; if (bx * B + B - 1 > ci1) ci1 = bx * B + B - 1; if (by * B + B - 1 > cj1) cj1 = by * B + B - 1; if (bz * B + B - 1 > ck1) ck1 = bz * B + B - 1;
  }
  void base; if (!changed) return null; f.version++; return [ci0, cj0, ck0, ci1, cj1, ck1];
}
export function opShapeDense(f, lo, hi, dist, mode, k, color, snap, amount) {   /* the read-change-write version, kept to check the in-place one against */
  const pad = Math.ceil((f.band + k) / f.h) + 1, [i0, j0, k0, nx, ny, nz] = box(f, lo, hi, pad); if (nx * ny * nz > MAX_SAMPLES) return null;
  const r = f.read(i0, j0, k0, nx, ny, nz), d = r.d, c = r.c, h = f.h, h2 = f.h * 2, band = f.band, a = amount == null ? 1 : amount; let changed = false;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const o = x + nx * (y + ny * z), s = dist((i0 + x) * h, (j0 + y) * h, (k0 + z) * h), old = d[o];
    if (mode === 'paint') { if (s < 0 && old < band) { const w = Math.min(1, a * Math.min(1, -s / (h * 2))); for (let q = 0; q < 3; q++) c[o * 3 + q] = Math.round(c[o * 3 + q] + (color[q] - c[o * 3 + q]) * w); changed = true; } continue; }
    let nv = old;
    if (mode === 'add') {
      if (s >= old + k || s > band + k) continue;   /* the stroke changes nothing here (smooth min gives the old value back) */
      nv = smin(old, s, k);
      if (color && nv < h2 && nv > -h2) { const w = s <= old ? 1 : 1 - (s - old) / (k + 1e-9); const o3 = o * 3; c[o3] = c[o3] + (color[0] - c[o3]) * w + 0.5; c[o3 + 1] = c[o3 + 1] + (color[1] - c[o3 + 1]) * w + 0.5; c[o3 + 2] = c[o3 + 2] + (color[2] - c[o3 + 2]) * w + 0.5; }   /* only the skin of the clay shows its colour, so only samples near the new surface take it */
    }
    else if (mode === 'subtract') { if (s > band + k || old >= band || -s <= old - k) continue; nv = smax(old, -s, k); }
    else if (mode === 'intersect') nv = smax(old, s, k);
    if (nv !== old) { d[o] = nv; changed = true; }
  }
  if (!changed) return null; f.write(r, snap); return doneBox(r);
}
/* intersect across the WHOLE layer: everything outside the shape goes (a temp field holds the shape: a stroke or a primitive). k = blend. */
export function opIntersectField(f, g, k, snap, gMap) {
  const bb = f.bounds(); if (!bb) return null; const h = f.h, [i0, j0, k0] = bb, nx = bb[3] - i0 + 1, ny = bb[4] - j0 + 1, nz = bb[5] - k0 + 1;
  const out = []; for (let bz = Math.floor(k0 / B); bz <= Math.floor(bb[5] / B); bz++) for (let by = Math.floor(j0 / B); by <= Math.floor(bb[4] / B); by++) for (let bx = Math.floor(i0 / B); bx <= Math.floor(bb[3] / B); bx++) {
    if (!f.bricks.has(bkey(bx, by, bz))) continue;
    const r = f.read(bx * B, by * B, bz * B, B, B, B); let ch = false;
    for (let z = 0; z < B; z++) for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const o = x + B * (y + B * z), p = gMap ? gMap((bx * B + x) * h, (by * B + y) * h, (bz * B + z) * h) : [(bx * B + x) * h, (by * B + y) * h, (bz * B + z) * h], s = g.sample(p[0], p[1], p[2]), nv = smax(r.d[o], s, k); if (nv !== r.d[o]) { r.d[o] = nv; ch = true; } }
    if (ch) { f.write(r, snap); out.push(1); }
  }
  void nx; void ny; void nz; return out.length ? bb : null;
}
/* Inflate (amount > 0 grows the clay out, < 0 shrinks it in) inside a ball */
export function opOffset(f, c, rad, amount, fall, snap) {
  const [i0, j0, k0, nx, ny, nz] = box(f, [c[0] - rad, c[1] - rad, c[2] - rad], [c[0] + rad, c[1] + rad, c[2] + rad], 1); if (nx * ny * nz > MAX_SAMPLES) return null;
  const r = f.read(i0, j0, k0, nx, ny, nz), d = r.d, h = f.h, band = f.band; let ch = false;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const o = x + nx * (y + ny * z), old = d[o]; if (old >= band && amount < 0) continue; if (old <= -band && amount > 0) continue; const dx = (i0 + x) * h - c[0], dy = (j0 + y) * h - c[1], dz = (k0 + z) * h - c[2], w = fall(Math.sqrt(dx * dx + dy * dy + dz * dz) / rad); if (w <= 0) continue; d[o] = old - amount * w; ch = true; }
  if (!ch) return null; f.write(r, snap); return doneBox(r);
}
/* Smooth: each sample moves toward the mean of its six neighbours (the surface relaxes), strongest in the middle of the ball */
export function opSmooth(f, c, rad, s, fall, snap) {
  const [i0, j0, k0, nx, ny, nz] = box(f, [c[0] - rad, c[1] - rad, c[2] - rad], [c[0] + rad, c[1] + rad, c[2] + rad], 2); if (nx * ny * nz > MAX_SAMPLES) return null;
  const r = f.read(i0, j0, k0, nx, ny, nz), d = r.d, src = d.slice(), h = f.h, band = f.band; let ch = false;
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const o = x + nx * (y + ny * z), old = src[o]; if (old >= band || old <= -band) { let near = false; for (const q of [1, -1, nx, -nx, nx * ny, -nx * ny]) if (Math.abs(src[o + q]) < band) { near = true; break; } if (!near) continue; }
    const dx = (i0 + x) * h - c[0], dy = (j0 + y) * h - c[1], dz = (k0 + z) * h - c[2], w = fall(Math.sqrt(dx * dx + dy * dy + dz * dz) / rad) * s; if (w <= 0) continue;
    const m = (src[o + 1] + src[o - 1] + src[o + nx] + src[o - nx] + src[o + nx * ny] + src[o - nx * ny]) / 6; d[o] = old + (m - old) * Math.min(1, w); if (d[o] !== old) ch = true;
  }
  if (!ch) return null; f.write(r, snap); return doneBox(r);
}
/* the surface plane under the brush: the mean place and mean outward direction of the samples near the surface inside the ball; null when no surface is there */
export function surfacePlane(f, c, rad) {
  const [i0, j0, k0, nx, ny, nz] = box(f, [c[0] - rad, c[1] - rad, c[2] - rad], [c[0] + rad, c[1] + rad, c[2] + rad], 1); if (nx * ny * nz > MAX_SAMPLES) return null;
  const r = f.read(i0, j0, k0, nx, ny, nz), d = r.d, h = f.h; let W = 0; const p = [0, 0, 0], n = [0, 0, 0];
  for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
    const o = x + nx * (y + ny * z), v = d[o]; if (Math.abs(v) > h) continue; const X = (i0 + x) * h, Y = (j0 + y) * h, Z = (k0 + z) * h, dx = X - c[0], dy = Y - c[1], dz = Z - c[2], t = Math.sqrt(dx * dx + dy * dy + dz * dz) / rad; if (t >= 1) continue;
    const w = 1 - t; W += w; p[0] += (X) * w; p[1] += (Y) * w; p[2] += (Z) * w;
    const gx = d[o + 1] - d[o - 1], gy = d[o + nx] - d[o - nx], gz = d[o + nx * ny] - d[o - nx * ny], L = Math.hypot(gx, gy, gz) || 1; n[0] += gx / L * w; n[1] += gy / L * w; n[2] += gz / L * w;
  }
  if (W <= 0) return null; const L = Math.hypot(n[0], n[1], n[2]) || 1;
  return { p: [p[0] / W, p[1] / W, p[2] / W], n: [n[0] / L, n[1] / L, n[2] / L], weight: W };
}
/* Flatten, Scrape and Fill: the clay inside the ball moves toward the plane (Scrape only takes away what stands above it, Fill only fills what lies below) */
export function opPlane(f, c, rad, plane, s, kind, fall, snap) {
  const [i0, j0, k0, nx, ny, nz] = box(f, [c[0] - rad, c[1] - rad, c[2] - rad], [c[0] + rad, c[1] + rad, c[2] + rad], 1); if (nx * ny * nz > MAX_SAMPLES) return null;
  const r = f.read(i0, j0, k0, nx, ny, nz), d = r.d, h = f.h, band = f.band, P = plane.p, N = plane.n; let ch = false;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const o = x + nx * (y + ny * z), old = d[o], X = (i0 + x) * h, Y = (j0 + y) * h, Z = (k0 + z) * h, dx = X - c[0], dy = Y - c[1], dz = Z - c[2], w = fall(Math.sqrt(dx * dx + dy * dy + dz * dz) / rad) * s; if (w <= 0) continue;
    const pd = (X - P[0]) * N[0] + (Y - P[1]) * N[1] + (Z - P[2]) * N[2];   /* the plane's own signed distance: above the plane is air */
    let goal = pd; if (kind === 'scrape') goal = Math.max(old, pd); else if (kind === 'fill') goal = Math.min(old, pd);
    if (Math.abs(goal) > band && Math.abs(old) >= band) continue;
    const nv = old + (goal - old) * Math.min(1, w); if (nv !== old) { d[o] = nv; ch = true; }
  }
  if (!ch) return null; f.write(r, snap); return doneBox(r);
}
/* a warp: the clay at each point comes from p - disp(p) (Grab, Smear, Pinch, Melt). disp returns [dx, dy, dz] in metres or null. The box must hold every point that moves AND where it comes from. */
export function opWarp(f, lo, hi, reach, disp, snap) {
  const padC = Math.ceil(reach / f.h) + 2, [i0, j0, k0, nx, ny, nz] = box(f, lo, hi, padC); if (nx * ny * nz > MAX_SAMPLES) return null;
  const r = f.read(i0, j0, k0, nx, ny, nz), d = r.d, c = r.c, src = d.slice(), csrc = c.slice(), h = f.h; let ch = false;
  const tri = (gx, gy, gz) => {   /* trilinear from the copy, clamped to the box */
    gx = Math.max(0, Math.min(nx - 1.001, gx)); gy = Math.max(0, Math.min(ny - 1.001, gy)); gz = Math.max(0, Math.min(nz - 1.001, gz));
    const x = Math.floor(gx), y = Math.floor(gy), z = Math.floor(gz), u = gx - x, v = gy - y, w = gz - z, o = x + nx * (y + ny * z), sx = 1, sy = nx, sz = nx * ny;
    const c00 = src[o] * (1 - u) + src[o + sx] * u, c10 = src[o + sy] * (1 - u) + src[o + sy + sx] * u, c01 = src[o + sz] * (1 - u) + src[o + sz + sx] * u, c11 = src[o + sz + sy] * (1 - u) + src[o + sz + sy + sx] * u;
    return [(c00 * (1 - v) + c10 * v) * (1 - w) + (c01 * (1 - v) + c11 * v) * w, Math.round(gx) + nx * (Math.round(gy) + ny * Math.round(gz))];
  };
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const X = (i0 + x) * h, Y = (j0 + y) * h, Z = (k0 + z) * h, m = disp(X, Y, Z); if (!m) continue; const L2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2]; if (L2 < 1e-14) continue;
    const o = x + nx * (y + ny * z), [v, co] = tri(x - m[0] / h, y - m[1] / h, z - m[2] / h); if (v === src[o]) continue; d[o] = v; c[o * 3] = csrc[co * 3]; c[o * 3 + 1] = csrc[co * 3 + 1]; c[o * 3 + 2] = csrc[co * 3 + 2]; ch = true;
  }
  if (!ch) return null; f.write(r, snap); return doneBox(r);
}
/* field g (in its own space) into f: gMap(x, y, z) turns a point of f's space into g's; mode as opShape. Used by Merge down, by booleans between layers and by Remesh (into an empty field). */
export function opMergeField(f, g, gMap, mode, k, snap, lo, hi) {
  if (mode === 'intersect') return opIntersectField(f, g, k, snap, gMap);
  const pad = Math.ceil((f.band + k) / f.h) + 1, [i0, j0, k0, nx, ny, nz] = box(f, lo, hi, pad); if (nx * ny * nz > MAX_SAMPLES * 4) return null;   /* a merge happens once, not every frame, so it may take a bigger box */
  const r = f.read(i0, j0, k0, nx, ny, nz), d = r.d, c = r.c, h = f.h, band = f.band; let ch = false;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const o = x + nx * (y + ny * z), p = gMap((i0 + x) * h, (j0 + y) * h, (k0 + z) * h), s = g.sample(p[0], p[1], p[2]), old = d[o];
    if (mode === 'paint') { if (s < 0 && old < band) { const gc = g.colorAt(p[0], p[1], p[2]); c[o * 3] = gc[0]; c[o * 3 + 1] = gc[1]; c[o * 3 + 2] = gc[2]; ch = true; } continue; }
    if (s >= band && mode === 'add') continue;
    const nv = mode === 'subtract' ? smax(old, -s, k) : smin(old, s, k);
    if (mode === 'add' && s < old + h) { const gc = g.colorAt(p[0], p[1], p[2]); c[o * 3] = gc[0]; c[o * 3 + 1] = gc[1]; c[o * 3 + 2] = gc[2]; ch = true; }
    if (nv !== old) { d[o] = nv; ch = true; }
  }
  if (!ch) return null; f.write(r, snap); return doneBox(r);
}

/* ---------- the shapes (signed distances in their own unit space; the caller scales and turns them) ---------- */
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z), len2 = (x, y) => Math.sqrt(x * x + y * y);
export const PRIMS = ['sphere', 'cube', 'cylinder', 'cone', 'torus', 'capsule'];
/* each shape fills about a unit ball (half-size 0.5 to 1); rounding r rounds the edges of the cube and the cylinder */
export function sdPrim(kind, x, y, z, round) {
  const rr = round || 0;
  if (kind === 'cube') { const qx = Math.abs(x) - (1 - rr), qy = Math.abs(y) - (1 - rr), qz = Math.abs(z) - (1 - rr); return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rr; }
  if (kind === 'cylinder') { const dx = len2(x, z) - (1 - rr), dy = Math.abs(y) - (1 - rr); return Math.min(Math.max(dx, dy), 0) + len2(Math.max(dx, 0), Math.max(dy, 0)) - rr; }
  if (kind === 'cone') {   /* point up, base radius 1 at y = -1, tip at y = 1 (exact cone distance) */
    const q = len2(x, z), hy = y + 1, H = 2, R = 1; const ax = R, ay = -H; const wx = q, wy = hy - H;   /* tip at (0, H) in (q, hy) */
    const t = Math.max(0, Math.min(1, (wx * ax + wy * ay) / (ax * ax + ay * ay))), bx = wx - ax * t, by = wy - ay * t, cx = wx - ax * Math.max(0, Math.min(1, wx / ax)), cy = wy + H;
    const k = Math.sign(ay), dd = Math.min(bx * bx + by * by, cx * cx + cy * cy), s = Math.max(k * (wx * ay - wy * ax), k * (wy + H)); return Math.sqrt(dd) * Math.sign(s);
  }
  if (kind === 'torus') { const q = len2(x, z) - 0.7; return len2(q, y) - 0.3; }
  if (kind === 'capsule') { const yy = Math.max(-0.5, Math.min(0.5, y)); return len3(x, y - yy, z) - 0.5; }
  return len3(x, y, z) - 1;   /* sphere */
}
/* a capsule from a to b with radius r (a clay stroke between two dabs); flat > 0 squashes it along n into a ribbon */
export function sdCapsule(x, y, z, a, b, r, n, flat) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], pax = x - a[0], pay = y - a[1], paz = z - a[2], L2 = bax * bax + bay * bay + baz * baz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / L2)) : 0; let dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  if (flat && n) { const k = dx * n[0] + dy * n[1] + dz * n[2], s = 1 / (1 - flat * 0.75); dx += n[0] * k * (s - 1); dy += n[1] * k * (s - 1); dz += n[2] * k * (s - 1); return (len3(dx, dy, dz) - r) / s; }   /* stretched along n by s, so the ribbon is r * (1 - 0.75 flat) thick; dividing by s keeps it a safe distance */
  return len3(dx, dy, dz) - r;
}

/* signed distances near a closed triangle soup (Make clay, a stamp pressed into clay): the distance to the nearest triangle, the sign from a ray count along x (odd = inside). Bounded: refuses more than 4 M samples. */
export function voxelizeTris(tris, h, band, base) {
    const f = { base }, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; tris.forEach(t => { for (let k = 0; k < 9; k++) { const a = k % 3; if (t[k] < lo[a]) lo[a] = t[k]; if (t[k] > hi[a]) hi[a] = t[k]; } });
    const i0 = Math.floor(lo[0] / h) - 5, j0 = Math.floor(lo[1] / h) - 5, k0 = Math.floor(lo[2] / h) - 5, nx = Math.ceil(hi[0] / h) + 5 - i0 + 1, ny = Math.ceil(hi[1] / h) + 5 - j0 + 1, nz = Math.ceil(hi[2] / h) + 5 - k0 + 1;
    if (nx * ny * nz > 4e6) return null;
    const d = new Float32Array(nx * ny * nz).fill(band), c = new Uint8Array(nx * ny * nz * 3); for (let i = 0; i < nx * ny * nz; i++) { c[i * 3] = f.base[0]; c[i * 3 + 1] = f.base[1]; c[i * 3 + 2] = f.base[2]; }
    /* unsigned distance in the band: each triangle writes to the samples round it */
    const cp = new Float64Array(3);
    for (const t of tris) {
      const a0 = Math.floor((Math.min(t[0], t[3], t[6]) - band) / h) - i0, a1 = Math.ceil((Math.max(t[0], t[3], t[6]) + band) / h) - i0, b0 = Math.floor((Math.min(t[1], t[4], t[7]) - band) / h) - j0, b1 = Math.ceil((Math.max(t[1], t[4], t[7]) + band) / h) - j0, c0 = Math.floor((Math.min(t[2], t[5], t[8]) - band) / h) - k0, c1 = Math.ceil((Math.max(t[2], t[5], t[8]) + band) / h) - k0;
      for (let z = Math.max(0, c0); z <= Math.min(nz - 1, c1); z++) for (let y = Math.max(0, b0); y <= Math.min(ny - 1, b1); y++) for (let x = Math.max(0, a0); x <= Math.min(nx - 1, a1); x++) {
        const px = (i0 + x) * h, py = (j0 + y) * h, pz = (k0 + z) * h; closestOnTri(px, py, pz, t, cp); const dd = Math.hypot(px - cp[0], py - cp[1], pz - cp[2]), o = x + nx * (y + ny * z); if (dd < d[o]) d[o] = dd;
      }
    }
    /* the sign: a ray along +x from each row; crossings toggle inside */
    const rows = new Map(); tris.forEach((t, ti) => { const y0 = Math.floor(Math.min(t[1], t[4], t[7]) / h) - j0, y1 = Math.ceil(Math.max(t[1], t[4], t[7]) / h) - j0, z0 = Math.floor(Math.min(t[2], t[5], t[8]) / h) - k0, z1 = Math.ceil(Math.max(t[2], t[5], t[8]) / h) - k0; for (let z = Math.max(0, z0); z <= Math.min(nz - 1, z1); z++) for (let y = Math.max(0, y0); y <= Math.min(ny - 1, y1); y++) { const k = y + ny * z; let l = rows.get(k); if (!l) { l = []; rows.set(k, l); } l.push(ti); } });
    rows.forEach((list, k) => {
      const y = k % ny, z = (k - y) / ny, py = (j0 + y) * h + h * 1e-3, pz = (k0 + z) * h + h * 7e-4, xs = [];
      for (const ti of list) { const t = tris[ti], ay = t[1], az = t[2], by = t[4], bz = t[5], cy = t[7], cz = t[8], dd = (by - ay) * (cz - az) - (cy - ay) * (bz - az); if (Math.abs(dd) < 1e-18) continue; const w1 = ((py - ay) * (cz - az) - (cy - ay) * (pz - az)) / dd, w2 = ((by - ay) * (pz - az) - (py - ay) * (bz - az)) / dd; if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue; xs.push(t[0] + w1 * (t[3] - t[0]) + w2 * (t[6] - t[0])); }
      if (xs.length < 2) return; xs.sort((p, q) => p - q);
      for (let x = 0; x < nx; x++) { const px = (i0 + x) * h; let n = 0; for (const xx of xs) { if (xx < px) n++; else break; } if (n % 2 === 1) { const o = x + nx * (y + ny * z); d[o] = -d[o]; } }
    });
    return { d, c, i0, j0, k0, nx, ny, nz };
  }
function closestOnTri(px, py, pz, t, out) {   /* the closest point of triangle t (9 numbers) to p (Ericson, Real-Time Collision Detection 5.1.5) */
    const ax = t[0], ay = t[1], az = t[2], abx = t[3] - ax, aby = t[4] - ay, abz = t[5] - az, acx = t[6] - ax, acy = t[7] - ay, acz = t[8] - az, apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz; if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
    const bpx = px - t[3], bpy = py - t[4], bpz = pz - t[5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz; if (d3 >= 0 && d4 <= d3) { out[0] = t[3]; out[1] = t[4]; out[2] = t[5]; return; }
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + abx * v; out[1] = ay + aby * v; out[2] = az + abz * v; return; }
    const cpx = px - t[6], cpy = py - t[7], cpz = pz - t[8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz; if (d6 >= 0 && d5 <= d6) { out[0] = t[6]; out[1] = t[7]; out[2] = t[8]; return; }
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + acx * w; out[1] = ay + acy * w; out[2] = az + acz * w; return; }
    const va = d3 * d6 - d5 * d4; if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); out[0] = t[3] + (t[6] - t[3]) * w; out[1] = t[4] + (t[7] - t[4]) * w; out[2] = t[5] + (t[8] - t[5]) * w; return; }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
  }
