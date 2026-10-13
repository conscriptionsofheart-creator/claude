/* sculpt_next_mesher.js: turns a box of clay samples into triangles (Surface Nets: one point per grid cell the surface passes through, four cells round every crossed edge make a quad).
   Pure typed arrays, no three.js, so the page and the Web Worker (sculpt_next_worker.js) run the same code.
   A CHUNK is N x N x N cells. meshChunk gets the samples from one before the chunk to one after it (N + 2 per side), so it can build the points of the cells along its lower faces too: the neighbour chunk
   builds the same points from the same samples, so the pieces meet with no cracks. A chunk owns the edges that START inside it, so no quad is made twice.
   Out: positions (metres, layer space), normals (from the field's slope, so they match across chunks), colours (0..1) and a triangle index. */
export function meshChunk(d, c, n, i0, j0, k0, h) {
  const nc = n - 1, nn = n * n, cellVert = new Int32Array(nc * nc * nc).fill(-1);
  let cap = 1024, P = new Float32Array(cap * 3), Nn = new Float32Array(cap * 3), C = new Float32Array(cap * 3), nv = 0;
  const grow = () => { cap *= 2; const p2 = new Float32Array(cap * 3), n2 = new Float32Array(cap * 3), c2 = new Float32Array(cap * 3); p2.set(P); n2.set(Nn); c2.set(C); P = p2; Nn = n2; C = c2; };
  const corner = [0, 1, n, n + 1, nn, nn + 1, nn + n, nn + n + 1], cx = [0, 1, 0, 1, 0, 1, 0, 1], cy = [0, 0, 1, 1, 0, 0, 1, 1], cz = [0, 0, 0, 0, 1, 1, 1, 1];
  const EA = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3], EB = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];   /* the 12 cell edges as corner pairs */
  const v = new Float32Array(8);
  for (let z = 0; z < nc; z++) for (let y = 0; y < nc; y++) for (let x = 0; x < nc; x++) {
    const o = x + n * (y + n * z); let mask = 0;
    for (let q = 0; q < 8; q++) { v[q] = d[o + corner[q]]; if (v[q] < 0) mask |= 1 << q; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (let e = 0; e < 12; e++) { const a = EA[e], b = EB[e], va = v[a], vb = v[b]; if ((va < 0) === (vb < 0)) continue; const t = va / (va - vb); sx += cx[a] + (cx[b] - cx[a]) * t; sy += cy[a] + (cy[b] - cy[a]) * t; sz += cz[a] + (cz[b] - cz[a]) * t; cnt++; }
    if (nv >= cap) grow();
    P[nv * 3] = (i0 + x + sx / cnt) * h; P[nv * 3 + 1] = (j0 + y + sy / cnt) * h; P[nv * 3 + 2] = (k0 + z + sz / cnt) * h;
    const gx = (v[1] + v[3] + v[5] + v[7]) - (v[0] + v[2] + v[4] + v[6]), gy = (v[2] + v[3] + v[6] + v[7]) - (v[0] + v[1] + v[4] + v[5]), gz = (v[4] + v[5] + v[6] + v[7]) - (v[0] + v[1] + v[2] + v[3]), L = Math.hypot(gx, gy, gz) || 1;
    Nn[nv * 3] = gx / L; Nn[nv * 3 + 1] = gy / L; Nn[nv * 3 + 2] = gz / L;
    let W = 0, r = 0, g = 0, bb = 0; for (let q = 0; q < 8; q++) { const w = 1 / (Math.abs(v[q]) + h * 0.05), s = (o + corner[q]) * 3; W += w; r += c[s] * w; g += c[s + 1] * w; bb += c[s + 2] * w; }
    C[nv * 3] = r / W / 255; C[nv * 3 + 1] = g / W / 255; C[nv * 3 + 2] = bb / W / 255;
    cellVert[x + nc * (y + nc * z)] = nv++;
  }
  let icap = 4096, I = new Uint32Array(icap), ni = 0;
  const cell = (x, y, z) => cellVert[x + nc * (y + nc * z)];
  const quad = (a, b, c2, e, flip) => {
    if (a < 0 || b < 0 || c2 < 0 || e < 0) return; if (ni + 6 > icap) { icap *= 2; const i2 = new Uint32Array(icap); i2.set(I); I = i2; }
    const d02 = (P[a * 3] - P[c2 * 3]) ** 2 + (P[a * 3 + 1] - P[c2 * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[c2 * 3 + 2]) ** 2, d13 = (P[b * 3] - P[e * 3]) ** 2 + (P[b * 3 + 1] - P[e * 3 + 1]) ** 2 + (P[b * 3 + 2] - P[e * 3 + 2]) ** 2;
    let t; if (d02 <= d13) t = [a, b, c2, a, c2, e]; else t = [a, b, e, b, c2, e];   /* split the quad along its shorter diagonal */
    if (flip) { I[ni++] = t[0]; I[ni++] = t[2]; I[ni++] = t[1]; I[ni++] = t[3]; I[ni++] = t[5]; I[ni++] = t[4]; }
    else for (let q = 0; q < 6; q++) I[ni++] = t[q];
  };
  for (let z = 1; z < n - 1; z++) for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const o = x + n * (y + n * z), a = d[o] < 0;
    if (a !== (d[o + 1] < 0)) quad(cell(x, y - 1, z - 1), cell(x, y, z - 1), cell(x, y, z), cell(x, y - 1, z), !a);
    if (a !== (d[o + n] < 0)) quad(cell(x - 1, y, z - 1), cell(x - 1, y, z), cell(x, y, z), cell(x, y, z - 1), !a);
    if (a !== (d[o + nn] < 0)) quad(cell(x - 1, y - 1, z), cell(x, y - 1, z), cell(x, y, z), cell(x - 1, y, z), !a);
  }
  return { position: P.slice(0, nv * 3), normal: Nn.slice(0, nv * 3), color: C.slice(0, nv * 3), index: I.slice(0, ni), verts: nv, tris: ni / 3 };
}
