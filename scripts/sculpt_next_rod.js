/* sculpt_next_rod.js: a ROD, made the way Ruth describes it (2026-10-14: "take a rectangular rod (not flattened), twist it, and then bend it, and then stretch the end of it and taper it off").
   The steps, in that order, on a real mesh (smooth, crisp, no voxels):
     1. ROD:     a solid bar with a rectangular cross-section (width : thickness about 1.8 : 1, corners slightly rounded), split into many thin slices along its length.
     2. TWIST:   each slice turns on the bar's own axis by twist(s) degrees (s = 0 at one end, 1 at the other).
     3. BEND:    the straight axis is laid along a path (a 3D curve); each slice follows the path with a frame that turns as little as possible (no sudden flips).
     4. STRETCH and TAPER: the far end is drawn out further along its own direction (stretch), and each slice is scaled by taper(s), down to a point at the tip.
   Colour: a gradient along the rod for its FRONT face and another for its BACK face; the two narrow sides blend between them, so you see the faces change as the rod twists.
   Pure arrays (no three.js) in rodArrays, so the headset, the self-test and the preview page build the same rod; rodGeometry(THREE, ...) wraps it for three. */
const hexRGB = s => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
export function stopsAt(stops, t) { t = Math.max(0, Math.min(1, t)); for (let i = 0; i < stops.length - 1; i++) { const [ta, va] = stops[i], [tb, vb] = stops[i + 1]; if (t <= tb) { const u = (t - ta) / (tb - ta || 1), e = u * u * (3 - 2 * u); return va + (vb - va) * e; } } return stops[stops.length - 1][1]; }
export function colourAt(stops, t) { t = Math.max(0, Math.min(1, t)); for (let i = 0; i < stops.length - 1; i++) { const [ta, ca] = stops[i], [tb, cb] = stops[i + 1]; if (t <= tb) { const u = (t - ta) / (tb - ta || 1), A = hexRGB(ca), B = hexRGB(cb); return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u]; } } return hexRGB(stops[stops.length - 1][1]); }
/* a smooth path through points (Catmull-Rom), n + 1 points evenly spaced along it */
export function pathThrough(pts, n) {
  const seg = pts.length - 1, at = (i, u) => { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(seg, i + 1)], p3 = pts[Math.min(seg, i + 2)], u2 = u * u, u3 = u2 * u; return [0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)); };
  const dense = []; for (let i = 0; i < seg; i++) for (let k = 0; k < 24; k++) dense.push(at(i, k / 24)); dense.push(pts[seg].slice(0, 3));
  const len = [0]; for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1], dense[i][2] - dense[i - 1][2]));
  const L = len[len.length - 1], out = []; let j = 0;
  for (let k = 0; k <= n; k++) { const want = L * k / n; while (j < len.length - 2 && len[j + 1] < want) j++; const u = (want - len[j]) / ((len[j + 1] - len[j]) || 1), a = dense[j], b = dense[j + 1]; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); }
  return { pts: out, length: L };
}
/* opts: width, thick (metres), twist [[s, degrees]], taper [[s, 0..1]], stretch (0 = as drawn; 0.3 = the far end drawn out 30% further), front / back colour stops, up (the side the front faces at the start, default toward you),
   slices (along), around (points round the section) */
export function rodArrays(path, opts) {
  const n = opts.slices || 260, m = opts.around || 40, W = opts.width / 2, T = opts.thick / 2, rr = Math.min(T, W) * (opts.round == null ? 0.28 : opts.round), stretch = opts.stretch || 0;
  /* STRETCH: where along the path each slice sits (more of the length goes to the far end) */
  /* STRETCH: the far end is drawn out further along its own direction (stretch = how much longer, as a share of the rod), and the taper runs out along it */
  let pp = path.map(p => p.slice(0, 3)); if (stretch > 0) { const a = pp[pp.length - 2], b = pp[pp.length - 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1, L0 = pathThrough(pp, 60).length * stretch; pp = pp.concat([[b[0] + d[0] / l * L0 * 0.5, b[1] + d[1] / l * L0 * 0.5, b[2] + d[2] / l * L0 * 0.5], [b[0] + d[0] / l * L0, b[1] + d[1] / l * L0, b[2] + d[2] / l * L0]]); }
  const P = pathThrough(pp, 600), place = s => s;
  const sample = u => { const f = u * 600, i = Math.min(599, Math.floor(f)), k = f - i, a = P.pts[i], b = P.pts[i + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
  /* the section: a rectangle with rounded corners, m points, each with its place (x across, y through) and which face it belongs to (+1 front, -1 back, 0 side) */
  const sec = []; { const perim = [], q = 6; const corner = (cx, cy, a0) => { for (let k = 0; k <= q; k++) { const a = a0 + Math.PI / 2 * k / q; perim.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } };
    corner(W - rr, T - rr, 0); corner(-W + rr, T - rr, Math.PI / 2); corner(-W + rr, -T + rr, Math.PI); corner(W - rr, -T + rr, Math.PI * 1.5);
    const L = [0]; for (let i = 1; i <= perim.length; i++) { const a = perim[i - 1], b = perim[i % perim.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    for (let k = 0; k < m; k++) { const want = L[L.length - 1] * k / m; let i = 0; while (i < perim.length - 1 && L[i + 1] < want) i++; const a = perim[i], b = perim[(i + 1) % perim.length], u = (want - L[i]) / ((L[i + 1] - L[i]) || 1); sec.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); } }
  /* BEND: frames along the path that turn as little as possible (each frame is the last one turned by the change in direction) */
  const C = [], Tn = [], Nn = []; for (let i = 0; i <= n; i++) C.push(sample(place(i / n)));
  for (let i = 0; i <= n; i++) { const a = C[Math.max(0, i - 1)], b = C[Math.min(n, i + 1)]; let t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const l = Math.hypot(...t) || 1; Tn.push(t.map(v => v / l)); }
  { let up = opts.up || [0, 0, 1], t0 = Tn[0], d = up[0] * t0[0] + up[1] * t0[1] + up[2] * t0[2]; let nv = [up[0] - t0[0] * d, up[1] - t0[1] * d, up[2] - t0[2] * d]; const l = Math.hypot(...nv) || 1; Nn.push(nv.map(v => v / l)); }
  for (let i = 1; i <= n; i++) { const a = Tn[i - 1], b = Tn[i], ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], sn = Math.hypot(...ax), cs = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], v = Nn[i - 1];
    if (sn < 1e-9) { Nn.push(v.slice()); continue; } const k = ax.map(x => x / sn), ang = Math.atan2(sn, cs), c = Math.cos(ang), s = Math.sin(ang), kd = k[0] * v[0] + k[1] * v[1] + k[2] * v[2], kx = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    let r = [v[0] * c + kx[0] * s + k[0] * kd * (1 - c), v[1] * c + kx[1] * s + k[1] * kd * (1 - c), v[2] * c + kx[2] * s + k[2] * kd * (1 - c)]; const d = r[0] * b[0] + r[1] * b[1] + r[2] * b[2]; r = [r[0] - b[0] * d, r[1] - b[1] * d, r[2] - b[2] * d]; const l = Math.hypot(...r) || 1; Nn.push(r.map(x => x / l)); }
  const pos = new Float32Array((n + 1) * m * 3), col = new Float32Array((n + 1) * m * 3), idx = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, t = Tn[i], N0 = Nn[i], B0 = [t[1] * N0[2] - t[2] * N0[1], t[2] * N0[0] - t[0] * N0[2], t[0] * N0[1] - t[1] * N0[0]];
    const th = stopsAt(opts.twist || [[0, 0], [1, 0]], s) * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th);   /* TWIST: the section turns on the axis */
    const Ax = [B0[0] * c + N0[0] * sn, B0[1] * c + N0[1] * sn, B0[2] * c + N0[2] * sn], Ay = [N0[0] * c - B0[0] * sn, N0[1] * c - B0[1] * sn, N0[2] * c - B0[2] * sn];
    const k = Math.max(0, stopsAt(opts.taper || [[0, 1], [1, 1]], s)), kt = Math.max(0, stopsAt(opts.taperThick || opts.taper || [[0, 1], [1, 1]], s));   /* TAPER: the section shrinks, to a point at a tip */
    const cf = colourAt(opts.front, s), cb = colourAt(opts.back || opts.front, s), side = opts.sideShade == null ? 0.82 : opts.sideShade;
    for (let j = 0; j < m; j++) {
      const [x, y] = sec[j], o = (i * m + j) * 3, X = x * k, Y = y * kt;
      pos[o] = C[i][0] + Ax[0] * X + Ay[0] * Y; pos[o + 1] = C[i][1] + Ax[1] * X + Ay[1] * Y; pos[o + 2] = C[i][2] + Ax[2] * X + Ay[2] * Y;
      const f = Math.max(-1, Math.min(1, y / (T - rr * 0.5))), w = 0.5 + 0.5 * Math.sign(f) * Math.min(1, Math.abs(f) ** 3), edge = 1 - (1 - side) * (1 - Math.abs(f) ** 2);   /* front where y > 0, back where y < 0, the narrow sides a little darker */
      for (let q = 0; q < 3; q++) col[o + q] = (cb[q] + (cf[q] - cb[q]) * w) * edge;
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m, c2 = a + m, d = b + m; idx.push(a, c2, b, b, c2, d); }   /* wound so the outside faces out (the section's x, y and the rod's direction make a left-handed set) */
  /* ends: a tip that tapers to a point closes itself; a blunt end gets a flat cap */
  const cap = (i, flip) => { const ctr = pos.length / 3 + (cap.extra.length / 3); let cx = 0, cy = 0, cz = 0; for (let j = 0; j < m; j++) { cx += pos[(i * m + j) * 3]; cy += pos[(i * m + j) * 3 + 1]; cz += pos[(i * m + j) * 3 + 2]; } cap.extra.push(cx / m, cy / m, cz / m); cap.ec.push(col[i * m * 3], col[i * m * 3 + 1], col[i * m * 3 + 2]); for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m; if (flip) idx.push(ctr, a, b); else idx.push(ctr, b, a); } };
  cap.extra = []; cap.ec = []; cap(0, true); cap(n, false);
  const P2 = new Float32Array(pos.length + cap.extra.length); P2.set(pos); P2.set(cap.extra, pos.length); const C2 = new Float32Array(col.length + cap.ec.length); C2.set(col); C2.set(cap.ec, col.length);
  return { position: P2, color: C2, index: Uint32Array.from(idx), length: P.length };
}
/* three.js wrapper: an indexed geometry with smooth normals and vertex colours (turned to linear light on three r152 and later, so the colours look as picked) */
export function rodGeometry(THREE, path, opts) {
  const r = rodArrays(path, opts), g = new THREE.BufferGeometry();
  if (parseInt(THREE.REVISION, 10) >= 152 && !(THREE.ColorManagement && THREE.ColorManagement.enabled === false)) for (let i = 0; i < r.color.length; i++) { const c = r.color[i]; r.color[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  g.setAttribute('position', new THREE.BufferAttribute(r.position, 3)); g.setAttribute('color', new THREE.BufferAttribute(r.color, 3)); g.setIndex(new THREE.BufferAttribute(r.index, 1)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
