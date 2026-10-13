/* bst_sculpt_selftest.js: the same sculpt checks run against any three.js, so the brush module is proven in r128 (the Atelier and BSA headset) and r186 (BST) with the same numbers.
   runChecks(THREE, makeSculpt) uses only what bst_sculpt_core.js uses: Vector3, SphereGeometry, BufferGeometry, BufferAttribute. Returns plain numbers. */
export function runChecks(THREE, makeSculpt) {
  const S = makeSculpt(THREE), V3 = THREE.Vector3, r6 = x => Math.round(x * 1e6) / 1e6, out = { revision: String(THREE.REVISION) };
  const fresh = () => { const g = new THREE.SphereGeometry(0.5, 48, 32); g.computeVertexNormals(); return g; };
  const copy = g => Array.from(g.attributes.position.array);
  const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
  const base = { mode: 'inflate', radius: 0.15, strength: 0.5 };
  const c = new V3(0, 0.5, 0), n = new V3(0, 1, 0);

  let g = fresh(), st = S.prepare(g); out.verts = g.attributes.position.count; out.welded = st.G; out.volume0 = r6(S.volume(g));
  const a0 = copy(g); let rec = new Map();
  out.inflateMoved = S.stroke(st, c, n, { ...base, sym: null }, rec); S.finish(st, { target: null });
  out.volumeInflate = r6(S.volume(g)); out.inflateGrew = S.volume(g) > S.volume(fresh()) ? 1 : 0;
  const a1 = copy(g); let outside = 0, seam = 0; const A = g.attributes.position.array, B = g.attributes.position.count;
  for (let i = 0; i < B; i++) { const d = Math.hypot(a0[i * 3] - c.x, a0[i * 3 + 1] - c.y, a0[i * 3 + 2] - c.z); if (d > base.radius + 1e-9 && (a1[i * 3] !== a0[i * 3] || a1[i * 3 + 1] !== a0[i * 3 + 1] || a1[i * 3 + 2] !== a0[i * 3 + 2])) outside++; }
  for (const mem of st.members) for (let k = 1; k < mem.length; k++) if (Math.abs(A[mem[0] * 3] - A[mem[k] * 3]) + Math.abs(A[mem[0] * 3 + 1] - A[mem[k] * 3 + 1]) + Math.abs(A[mem[0] * 3 + 2] - A[mem[k] * 3 + 2]) > 1e-7) seam++;
  out.movedOutsideRadius = outside; out.seamTears = seam; out.recorded = rec.size;
  let m = S.swap(st, rec, null); out.undoMaxDiff = r6(maxDiff(copy(g), a0)); m = S.swap(st, m, null); out.redoMaxDiff = r6(maxDiff(copy(g), a1));

  g = fresh(); st = S.prepare(g); out.deflateVolumeDelta = 0; { const v0 = S.volume(g); S.stroke(st, c, n, { ...base, mode: 'deflate', sym: null }, new Map()); S.finish(st, { target: null }); out.deflateShrinks = S.volume(g) < v0 ? 1 : 0; }

  g = fresh(); st = S.prepare(g); const mc = new V3(0.3, 0.4, 0.1).normalize().multiplyScalar(0.5), mn = mc.clone().normalize();
  S.stroke(st, mc, mn, { ...base, sym: { mirror: true } }, new Map()); S.finish(st, { target: null });
  { const P = g.attributes.position.array, q = new Map(); for (let i = 0; i < B; i++) q.set(r6(P[i * 3]) + '_' + r6(P[i * 3 + 1]) + '_' + r6(P[i * 3 + 2]), 1); const orig = fresh().attributes.position.array; let worst = 0; for (let i = 0; i < B; i++) { const dx = P[i * 3] - orig[i * 3], mi = findMirror(orig, i); if (mi >= 0) { worst = Math.max(worst, Math.abs(dx + (P[mi * 3] - orig[mi * 3])), Math.abs(P[i * 3 + 1] - orig[i * 3 + 1] - (P[mi * 3 + 1] - orig[mi * 3 + 1])), Math.abs(P[i * 3 + 2] - orig[i * 3 + 2] - (P[mi * 3 + 2] - orig[mi * 3 + 2]))); } } out.mirrorAsymmetry = r6(worst); }
  function findMirror(o, i) { const x = -o[i * 3], y = o[i * 3 + 1], z = o[i * 3 + 2]; for (let j = 0; j < B; j++) if (Math.abs(o[j * 3] - x) < 1e-6 && Math.abs(o[j * 3 + 1] - y) < 1e-6 && Math.abs(o[j * 3 + 2] - z) < 1e-6) return j; return -1; }

  const d6 = S.dabs(new V3(0.5, 0, 0), new V3(1, 0, 0), { radial: { axis: 'y', count: 6, origin: new V3() } }); out.radialDabs = d6.length; out.radialRadii = r6(Math.max(...d6.map(d => d.c.length())) - Math.min(...d6.map(d => d.c.length())));
  const dv = S.dabs(new V3(0.5, 0, 0), new V3(1, 0, 0), { radial: { axisVec: new V3(1, 0, 0), count: 4, origin: new V3() } }); out.radialAxisVecSpread = r6(Math.max(...dv.map(d => Math.abs(d.c.x))) - Math.min(...dv.map(d => Math.abs(d.c.x))));   /* round the x axis: every copy of a point on that axis is the same point */

  g = fresh(); st = S.prepare(g); const T = new Float32Array(g.attributes.position.array.length), b0 = copy(g); rec = new Map();
  S.stroke(st, c, n, { ...base, sym: null, target: T }, rec); S.finish(st, { target: T });
  out.keyBaseChanged = maxDiff(copy(g), b0) === 0 ? 0 : 1; let nz = 0; for (let i = 0; i < T.length; i++) if (T[i] !== 0) nz++; out.keyNonzero = nz;
  S.swap(st, rec, T); let nz2 = 0; for (let i = 0; i < T.length; i++) if (T[i] !== 0) nz2++; out.keyUndoNonzero = nz2;

  g = fresh(); st = S.prepare(g); const vm0 = S.volume(g); S.stroke(st, new V3(0, -0.5, 0), new V3(0, -1, 0), { mode: 'melt', radius: 0.2, strength: 0.6, sym: null, down: new V3(0, -1, 0) }, new Map()); S.finish(st, { target: null });
  out.meltMoves = maxDiff(copy(g), copy(fresh())) > 1e-4 ? 1 : 0;
  return out;
}
