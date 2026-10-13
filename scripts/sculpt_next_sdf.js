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
export function opShape(f, lo, hi, dist, mode, k, color, snap, amount) {
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
