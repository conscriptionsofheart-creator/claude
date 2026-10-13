/* bst_squeeze.js: the squeeze-out brush's tube (Ruth 2026-10-11: "a painter tool ... more like a squeeze toothpaste out tool, so I can create my own objects ... paints in different thicknesses ... the mirror function will be important").
   Pure: tubeGeometry(THREE, pts, radii, opts) takes world points and a radius for each and returns one closed, smooth BufferGeometry (rounded ends, so it is a closed solid that Stamp, Carve and Save object can use).
   Profiles (shaped from Open Brush's Toothpaste, Tube, Flat, Taffy and Beads brushes, Apache 2.0): 'round' (a plain tube), 'flat' (a ribbon, 4 to 1), 'taffy' (thin ends, fat middle), 'beads' (a row of beads).
   The rings are carried along the path without twisting (parallel transport), so a loop-the-loop does not corkscrew. opts: sides (default 14), cap (rings in each rounded end, default 4), profile, up (a V3: which way a flat ribbon lies),
   reflect (turn the triangles the other way round: only for a mesh that was mirrored AFTER it was built; a path mirrored before it is built is just another path and comes out right). */
export function tubeGeometry(THREE, pts, radii, opts) {
  opts = opts || {}; const V3 = THREE.Vector3, sides = Math.max(6, opts.sides || 14), cap = Math.max(1, opts.cap == null ? 4 : opts.cap), profile = opts.profile || 'round';
  let P = pts.map(p => p.clone()), R = radii.slice();
  if (P.length === 1) { P.push(P[0].clone().add(new V3(0, 0.0005, 0))); R.push(R[0]); }
  /* drop points that sit on top of each other (a hand held still), they have no direction */
  { const Q = [P[0]], QR = [R[0]]; for (let i = 1; i < P.length; i++) { if (P[i].distanceTo(Q[Q.length - 1]) > 1e-5) { Q.push(P[i]); QR.push(R[i]); } } P = Q; R = QR; if (P.length < 2) { P.push(P[0].clone().add(new V3(0, 0.0005, 0))); R.push(R[0]); } }
  const n = P.length, T = [], u = [];
  for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; T.push(new V3().subVectors(b, a).normalize()); u.push(n > 1 ? i / (n - 1) : 0); }
  /* the shape along the path */
  const rad = i => { let r = R[i]; if (profile === 'taffy') r *= Math.min(1, 0.18 + 1.3 * Math.sin(Math.PI * u[i])); else if (profile === 'beads') r *= 0.62 + 0.38 * Math.abs(Math.sin(u[i] * Math.PI * Math.max(2, Math.round(P[0].distanceTo(P[n - 1]) / (R[0] * 2.6) + n / 12)))); return Math.max(r, 1e-4); };
  const up = opts.up ? opts.up.clone().normalize() : new V3(0, 1, 0), N = [], B = [];
  { let n0 = up.clone().sub(T[0].clone().multiplyScalar(up.dot(T[0]))); if (n0.lengthSq() < 1e-8) n0 = new V3(1, 0, 0).sub(T[0].clone().multiplyScalar(T[0].x)); n0.normalize(); N.push(n0); B.push(new V3().crossVectors(T[0], n0).normalize()); }
  for (let i = 1; i < n; i++) { const q = new THREE.Quaternion().setFromUnitVectors(T[i - 1], T[i]), nn = N[i - 1].clone().applyQuaternion(q); nn.sub(T[i].clone().multiplyScalar(nn.dot(T[i]))).normalize(); N.push(nn); B.push(new V3().crossVectors(T[i], nn).normalize()); }
  const ey = profile === 'flat' ? 0.25 : 1, pos = [], uv = [], idx = [], ringStart = [];
  const ring = (c, nv, bv, r, vcoord, tip) => { ringStart.push(pos.length / 3); for (let j = 0; j <= sides; j++) { const a = (j % sides) / sides * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r * ey; pos.push(c.x + nv.x * x + bv.x * y, c.y + nv.y * x + bv.y * y, c.z + nv.z * x + bv.z * y); uv.push(j / sides, vcoord); } };
  const r0 = rad(0), r1 = rad(n - 1), cs = [];
  /* start cap, from the tip inwards */
  const tip0 = P[0].clone().addScaledVector(T[0], -r0 * (profile === 'flat' ? 0.6 : 1)); pos.push(tip0.x, tip0.y, tip0.z); uv.push(0.5, 0); const apex0 = 0;
  for (let k = cap; k >= 1; k--) { const a = k / (cap + 1) * Math.PI / 2, off = -Math.cos(a) * r0 * (profile === 'flat' ? 0.6 : 1), rr = Math.sin(a) * r0; ring(P[0].clone().addScaledVector(T[0], off), N[0], B[0], rr, 0.02 * (cap - k + 1)); }
  for (let i = 0; i < n; i++) ring(P[i], N[i], B[i], rad(i), 0.1 + 0.8 * u[i]);
  for (let k = 1; k <= cap; k++) { const a = k / (cap + 1) * Math.PI / 2, off = Math.cos(a) * r1 * (profile === 'flat' ? 0.6 : 1), rr = Math.sin(a) * r1; ring(P[n - 1].clone().addScaledVector(T[n - 1], off), N[n - 1], B[n - 1], rr, 0.9 + 0.02 * k); }
  const tip1 = P[n - 1].clone().addScaledVector(T[n - 1], r1 * (profile === 'flat' ? 0.6 : 1)); const apex1 = pos.length / 3; pos.push(tip1.x, tip1.y, tip1.z); uv.push(0.5, 1);
  const tri = (a, b, c) => { if (opts.reflect) idx.push(a, c, b); else idx.push(a, b, c); };
  const W = sides + 1;
  for (let j = 0; j < sides; j++) tri(apex0, ringStart[0] + j + 1, ringStart[0] + j);
  for (let k = 0; k + 1 < ringStart.length; k++) for (let j = 0; j < sides; j++) { const a = ringStart[k] + j, b = ringStart[k] + j + 1, c = ringStart[k + 1] + j, d = ringStart[k + 1] + j + 1; tri(a, b, c); tri(b, d, c); }
  const last = ringStart[ringStart.length - 1]; for (let j = 0; j < sides; j++) tri(apex1, last + j, last + j + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(new THREE.BufferAttribute(pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/* the copies one stroke makes: mirror across the vertical plane x = centre.x, and/or count copies turned round the vertical axis through centre */
export function strokeCopies(THREE, pts, sym, centre, count) {
  const V3 = THREE.Vector3; let list = [{ pts: pts.map(p => p.clone()), reflect: false }];
  if (sym === 'mirror') list.push({ pts: pts.map(p => new V3(2 * centre.x - p.x, p.y, p.z)), reflect: false });
  else if (sym === 'radial' && count > 1) { list = []; for (let k = 0; k < count; k++) { const a = Math.PI * 2 * k / count; list.push({ pts: pts.map(p => p.clone().sub(new V3(centre.x, 0, centre.z)).applyAxisAngle(new V3(0, 1, 0), a).add(new V3(centre.x, 0, centre.z))), reflect: false }); } }
  return list;
}
