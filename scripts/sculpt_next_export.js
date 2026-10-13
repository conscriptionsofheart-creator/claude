/* sculpt_next_export.js: getting the work out (Ruth 2026-10-13). Save puts a .glb in the library from inside the headset, as the current engine does; clay is baked to one plain mesh per layer with
   its colours as vertex colours. A triangle BUDGET thins the COPY that is saved, never the work in the room (her rule: budgets check delivery copies, they never cap the master), and never a person:
   skinned pieces (figures, clothes on figures) keep every triangle (people keep their full design; only props may be thinned).
   Decimate: quadric error edge collapse (Garland and Heckbert 1997), written here so nothing is bought or fetched. Works on any indexed or plain mesh; points at one place are joined first.
   Export: three r128 (the Atelier, GLTFExporter as a global script) and r186 (BST, the module). */
export function makeExport(THREE, env) {
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } }, rev = parseInt(THREE.REVISION, 10) || 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  /* ---------- decimate ---------- */
  function decimate(geo, target, opts) {
    opts = opts || {}; const t0 = now(), P0 = geo.attributes.position, n0 = P0.count, I0 = geo.index ? geo.index.array : null, triN = (I0 ? I0.length : n0) / 3;
    if (triN <= target) return { geometry: geo, before: triN, after: triN, ms: 0 };
    /* join points at one place (uv seams), keep the first point's colour and uv */
    const q = 1e6, ids = new Map(), rep = [], vmap = new Int32Array(n0);
    for (let i = 0; i < n0; i++) { const k = Math.round(P0.getX(i) * q) + ',' + Math.round(P0.getY(i) * q) + ',' + Math.round(P0.getZ(i) * q); let id = ids.get(k); if (id === undefined) { id = rep.length; ids.set(k, id); rep.push(i); } vmap[i] = id; }
    const nv = rep.length, pos = new Float64Array(nv * 3); for (let v = 0; v < nv; v++) { pos[v * 3] = P0.getX(rep[v]); pos[v * 3 + 1] = P0.getY(rep[v]); pos[v * 3 + 2] = P0.getZ(rep[v]); }
    const F = new Int32Array(triN * 3); let fAlive = 0; const faceOk = new Uint8Array(triN);
    for (let t = 0; t < triN; t++) { const a = vmap[I0 ? I0[t * 3] : t * 3], b = vmap[I0 ? I0[t * 3 + 1] : t * 3 + 1], c = vmap[I0 ? I0[t * 3 + 2] : t * 3 + 2]; F[t * 3] = a; F[t * 3 + 1] = b; F[t * 3 + 2] = c; if (a !== b && b !== c && a !== c) { faceOk[t] = 1; fAlive++; } }
    const vf = Array.from({ length: nv }, () => []); for (let t = 0; t < triN; t++) if (faceOk[t]) for (let k = 0; k < 3; k++) vf[F[t * 3 + k]].push(t);
    /* quadrics: each face's plane, weighted by its area; open edges get a steep plane so the outline stays */
    const Qd = new Float64Array(nv * 10), addQ = (v, a, b, c, d, w) => { const o = v * 10; Qd[o] += w * a * a; Qd[o + 1] += w * a * b; Qd[o + 2] += w * a * c; Qd[o + 3] += w * a * d; Qd[o + 4] += w * b * b; Qd[o + 5] += w * b * c; Qd[o + 6] += w * b * d; Qd[o + 7] += w * c * c; Qd[o + 8] += w * c * d; Qd[o + 9] += w * d * d; };
    const fn = new Float64Array(3), faceNormal = t => { const a = F[t * 3] * 3, b = F[t * 3 + 1] * 3, c = F[t * 3 + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; fn[0] = uy * vz - uz * vy; fn[1] = uz * vx - ux * vz; fn[2] = ux * vy - uy * vx; return fn; };
    const edgeUse = new Map(), ek = (a, b) => (a < b ? a * nv + b : b * nv + a);
    for (let t = 0; t < triN; t++) { if (!faceOk[t]) continue; const n = faceNormal(t), L = Math.hypot(n[0], n[1], n[2]); if (L < 1e-20) continue; const a = n[0] / L, b = n[1] / L, c = n[2] / L, v0 = F[t * 3], d = -(a * pos[v0 * 3] + b * pos[v0 * 3 + 1] + c * pos[v0 * 3 + 2]), w = L / 2; for (let k = 0; k < 3; k++) addQ(F[t * 3 + k], a, b, c, d, w);
      for (let k = 0; k < 3; k++) { const u = F[t * 3 + k], v = F[t * 3 + (k + 1) % 3], key = ek(u, v), e = edgeUse.get(key); if (e) e.n++; else edgeUse.set(key, { n: 1, u, v, t }); } }
    edgeUse.forEach(e => { if (e.n !== 1) return; const n = faceNormal(e.t), u = e.u * 3, v = e.v * 3, ex = pos[v] - pos[u], ey = pos[v + 1] - pos[u + 1], ez = pos[v + 2] - pos[u + 2]; let a = ey * n[2] - ez * n[1], b = ez * n[0] - ex * n[2], c = ex * n[1] - ey * n[0]; const L = Math.hypot(a, b, c); if (L < 1e-20) return; a /= L; b /= L; c /= L; const d = -(a * pos[u] + b * pos[u + 1] + c * pos[u + 2]), w = (ex * ex + ey * ey + ez * ez) * 10; addQ(e.u, a, b, c, d, w); addQ(e.v, a, b, c, d, w); });
    /* the best place for a joined pair and what it costs */
    const best = new Float64Array(3), Qs = new Float64Array(10);
    const cost = (a, b) => {
      for (let k = 0; k < 10; k++) Qs[k] = Qd[a * 10 + k] + Qd[b * 10 + k];
      const [q00, q01, q02, q03, q11, q12, q13, q22, q23, q33] = Qs, det = q00 * (q11 * q22 - q12 * q12) - q01 * (q01 * q22 - q12 * q02) + q02 * (q01 * q12 - q11 * q02);
      const ev = (x, y, z) => q00 * x * x + 2 * q01 * x * y + 2 * q02 * x * z + 2 * q03 * x + q11 * y * y + 2 * q12 * y * z + 2 * q13 * y + q22 * z * z + 2 * q23 * z + q33;
      const scale = Math.abs(q00) + Math.abs(q11) + Math.abs(q22);
      if (Math.abs(det) > 1e-12 * scale * scale * scale) {
        const i = 1 / det, x = -i * (q03 * (q11 * q22 - q12 * q12) - q01 * (q13 * q22 - q12 * q23) + q02 * (q13 * q12 - q11 * q23)), y = -i * (q00 * (q13 * q22 - q23 * q12) - q03 * (q01 * q22 - q12 * q02) + q02 * (q01 * q23 - q13 * q02)), z = -i * (q00 * (q11 * q23 - q12 * q13) - q01 * (q01 * q23 - q13 * q02) + q03 * (q01 * q12 - q11 * q02));
        const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2], L = Math.hypot(pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az);
        if (Math.hypot(x - ax, y - ay, z - az) < L * 2) { best[0] = x; best[1] = y; best[2] = z; return Math.max(0, ev(x, y, z)); }   /* a solution far away means a nearly flat quadric: fall back to the ends */
      }
      let bc = Infinity; for (const s of [0, 0.5, 1]) { const x = pos[a * 3] + (pos[b * 3] - pos[a * 3]) * s, y = pos[a * 3 + 1] + (pos[b * 3 + 1] - pos[a * 3 + 1]) * s, z = pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * s, c = ev(x, y, z); if (c < bc) { bc = c; best[0] = x; best[1] = y; best[2] = z; } }
      return Math.max(0, bc);
    };
    /* a min-heap of candidate pairs; a pair is stale when either end has changed since it was pushed */
    const hc = [], ha = [], hb = [], hva = [], hvb = [], ver = new Int32Array(nv), dead = new Uint8Array(nv);
    const push = (c, a, b) => { let i = hc.length; hc.push(c); ha.push(a); hb.push(b); hva.push(ver[a]); hvb.push(ver[b]); while (i > 0) { const p = (i - 1) >> 1; if (hc[p] <= hc[i]) break; [hc[p], hc[i]] = [hc[i], hc[p]]; [ha[p], ha[i]] = [ha[i], ha[p]]; [hb[p], hb[i]] = [hb[i], hb[p]]; [hva[p], hva[i]] = [hva[i], hva[p]]; [hvb[p], hvb[i]] = [hvb[i], hvb[p]]; i = p; } };
    const pop = () => { const r = [hc[0], ha[0], hb[0], hva[0], hvb[0]], last = hc.length - 1; hc[0] = hc[last]; ha[0] = ha[last]; hb[0] = hb[last]; hva[0] = hva[last]; hvb[0] = hvb[last]; hc.pop(); ha.pop(); hb.pop(); hva.pop(); hvb.pop();
      let i = 0; for (;;) { const l = 2 * i + 1, rr = l + 1; let m = i; if (l < hc.length && hc[l] < hc[m]) m = l; if (rr < hc.length && hc[rr] < hc[m]) m = rr; if (m === i) break; [hc[m], hc[i]] = [hc[i], hc[m]]; [ha[m], ha[i]] = [ha[i], ha[m]]; [hb[m], hb[i]] = [hb[i], hb[m]]; [hva[m], hva[i]] = [hva[i], hva[m]]; [hvb[m], hvb[i]] = [hvb[i], hvb[m]]; i = m; } return r; };
    edgeUse.forEach(e => push(cost(e.u, e.v), e.u, e.v));
    const nbrs = v => { const s = new Set(); for (const t of vf[v]) if (faceOk[t]) for (let k = 0; k < 3; k++) if (F[t * 3 + k] !== v) s.add(F[t * 3 + k]); return s; };
    const flips = (v, other, x, y, z) => {   /* would moving v to (x, y, z) turn any of its faces (those not shared with other) over, or make a sliver? */
      for (const t of vf[v]) { if (!faceOk[t]) continue; let has = false; for (let k = 0; k < 3; k++) if (F[t * 3 + k] === other) has = true; if (has) continue;
        const n0 = faceNormal(t), l0 = Math.hypot(n0[0], n0[1], n0[2]), ax = n0[0], ay = n0[1], az = n0[2], k = F[t * 3] === v ? 0 : F[t * 3 + 1] === v ? 1 : 2, sv = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]; pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; const n1 = faceNormal(t), l1 = Math.hypot(n1[0], n1[1], n1[2]), dot = (ax * n1[0] + ay * n1[1] + az * n1[2]); pos[v * 3] = sv[0]; pos[v * 3 + 1] = sv[1]; pos[v * 3 + 2] = sv[2]; void k;
        if (l1 < 1e-24 || dot < 0.2 * l0 * l1) return true; }
      return false;
    };
    let alive = fAlive; const keepB = opts.keepBoundary !== false;
    while (alive > target && hc.length) {
      const [, a, b, va, vb] = pop(); if (dead[a] || dead[b] || ver[a] !== va || ver[b] !== vb) continue;
      const na = nbrs(a), nb = nbrs(b); if (!na.has(b)) continue; let shared = 0; na.forEach(x => { if (nb.has(x)) shared++; }); if (shared > 2) continue;   /* the link condition: joining would pinch the surface */
      cost(a, b); const x = best[0], y = best[1], z = best[2]; if (flips(a, b, x, y, z) || flips(b, a, x, y, z)) continue; void keepB;
      pos[a * 3] = x; pos[a * 3 + 1] = y; pos[a * 3 + 2] = z; for (let k = 0; k < 10; k++) Qd[a * 10 + k] += Qd[b * 10 + k]; dead[b] = 1; ver[a]++;
      for (const t of vf[b]) { if (!faceOk[t]) continue; let hasA = false; for (let k = 0; k < 3; k++) if (F[t * 3 + k] === a) hasA = true; if (hasA) { faceOk[t] = 0; alive--; continue; } for (let k = 0; k < 3; k++) if (F[t * 3 + k] === b) F[t * 3 + k] = a; vf[a].push(t); }
      vf[b] = []; nbrs(a).forEach(u => push(cost(a, u), a, u));   /* only pairs that touch the joined point changed */
    }
    /* the thinner copy: live points only, each keeping its colour and uv; normals made fresh */
    const remap = new Int32Array(nv).fill(-1), outI = []; let cnt = 0; for (let t = 0; t < triN; t++) { if (!faceOk[t]) continue; for (let k = 0; k < 3; k++) { const v = F[t * 3 + k]; if (remap[v] < 0) remap[v] = cnt++; outI.push(remap[v]); } }
    const g = new THREE.BufferGeometry(), P = new Float32Array(cnt * 3); for (let v = 0; v < nv; v++) if (remap[v] >= 0) { P[remap[v] * 3] = pos[v * 3]; P[remap[v] * 3 + 1] = pos[v * 3 + 1]; P[remap[v] * 3 + 2] = pos[v * 3 + 2]; }
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    ['color', 'uv'].forEach(nm => { const a = geo.attributes[nm]; if (!a) return; const sz = a.itemSize, A = new Float32Array(cnt * sz); for (let v = 0; v < nv; v++) if (remap[v] >= 0) for (let k = 0; k < sz; k++) A[remap[v] * sz + k] = a.array[rep[v] * sz + k] / (a.normalized && a.array instanceof Uint8Array ? 255 : 1); g.setAttribute(nm, new THREE.BufferAttribute(A, sz)); });
    g.setIndex(cnt > 65535 ? new THREE.Uint32BufferAttribute(outI, 1) : new THREE.Uint16BufferAttribute(outI, 1)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    return { geometry: g, before: triN, after: outI.length / 3, ms: now() - t0 };
  }

  /* ---------- what goes into the file ---------- */
  const isClay = o => !!(o && o.userData && o.userData.clayWork);
  const triCount = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  /* a copy of the roots for the file: clay baked, objects laid out round their own middle, and thinned to the budget if one is set (never a skinned piece) */
  function prepare(roots, opts) {
    opts = opts || {}; const grp = new THREE.Group(); grp.name = opts.name || 'Sculpted object'; const box = new THREE.Box3();
    roots.forEach(r => { r.updateMatrixWorld(true); box.expandByObject(r); }); const pv = box.isEmpty() ? new V3() : box.getCenter(new V3()), back = new M4().makeTranslation(-pv.x, -pv.y, -pv.z);
    roots.forEach(r => {
      let c; if (isClay(r)) { const w = env.clay.works.find(x => x.group === r); c = w ? env.clay.bakedClone(w) : null; } else c = r.clone(true);
      if (!c) return; const M = new M4().multiplyMatrices(back, r.matrixWorld); c.matrix.copy(M); c.matrix.decompose(c.position, c.quaternion, c.scale); c.updateMatrix(); grp.add(c);
    });
    grp.updateMatrixWorld(true);
    let thinned = 0, people = 0;
    if (opts.budget > 0) {
      const plain = [], all = []; grp.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) { all.push(o); if (o.isSkinnedMesh) people++; else plain.push(o); } });
      const fixed = all.filter(o => o.isSkinnedMesh).reduce((a, o) => a + triCount(o.geometry), 0), free = plain.reduce((a, o) => a + triCount(o.geometry), 0), room = Math.max(0, opts.budget - fixed);
      if (free > room && free > 0) { const k = room / free; plain.forEach(o => { const want = Math.max(12, Math.floor(triCount(o.geometry) * k)); const r = decimate(o.geometry, want); if (r.after < r.before) { o.geometry = r.geometry; thinned += r.before - r.after; } }); }
      if (fixed > opts.budget) say('The budget is ' + opts.budget.toLocaleString('en-US') + ' triangles but the people in it have ' + fixed.toLocaleString('en-US') + ': people keep every triangle, so the copy is over budget.');
    }
    let tris = 0; grp.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) tris += triCount(o.geometry); });
    return { root: grp, tris, thinned, people };
  }
  let ExporterP = null;
  function exporter() {
    if (ExporterP) return ExporterP;
    ExporterP = (async () => {
      if (typeof THREE.GLTFExporter === 'function') return THREE.GLTFExporter;
      if (rev >= 150) { const m = await import('/pe_lib/bst_three_gltfexporter_0.186.1.js'); return m.GLTFExporter; }
      await new Promise(ok => { if (typeof document === 'undefined') return ok(); const sc = document.createElement('script'); sc.src = '/pe_lib/GLTFExporter.js'; sc.onload = () => ok(); sc.onerror = () => ok(); document.head.appendChild(sc); });
      if (typeof THREE.GLTFExporter !== 'function') throw new Error('The glb exporter is not loaded.');
      return THREE.GLTFExporter;
    })(); ExporterP.catch(() => { ExporterP = null; });
    return ExporterP;
  }
  async function toGlb(root) {
    const E = await exporter(), ex = new E(), o = { binary: true, embedImages: true, onlyVisible: true };
    return new Promise((ok, no) => { try { if (rev >= 132) ex.parse(root, ok, no, o); else ex.parse(root, ok, o); } catch (e) { no(e); } });
  }
  /* the glb of some roots (clay works, objects), with the budget applied to the copy */
  async function glb(roots, opts) { const p = prepare(roots, opts || {}); const buf = await toGlb(p.root); return { buffer: buf, tris: p.tris, thinned: p.thinned }; }
  /* Save to the library, as the current engine does: the figure itself (people are never thinned, so no budget), or objects / clay laid out round their own middle */
  async function save(name, opts) {
    opts = opts || {}; const exp = opts.exportGlb || null; let target, info = { tris: 0, thinned: 0 };
    if (opts.roots && opts.roots.length) { const roots = opts.roots.filter(r => r && r.parent); if (!roots.length) throw new Error('Nothing to save.'); const p = prepare(roots, { budget: opts.budget, name }); target = p.root; info = p; }
    else if (opts.figure) target = opts.figure; else throw new Error('Nothing to save.');
    const buf = exp ? await exp(target) : await toGlb(target), nm = (name || (opts.roots ? 'Sculpted object' : 'Sculpted figure')).trim(), id = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sculpt', proj = opts.proj || 'studio';
    const mine = { name: 'Own work', source: 'Sculpted by hand in the headset', restricted: false }, inh = (opts.sources && opts.sources()) || [];
    const card = { name: nm, proj, budget: opts.budget ? { id: 'own', label: 'Own number', limit: opts.budget } : { id: 'none', label: 'No budget picked', limit: 0 }, licence: mine, sources: inh.concat([mine]) };
    const fd = new FormData(); fd.append('glb', new Blob([buf], { type: 'model/gltf-binary' }), id + '.glb'); fd.append('card', JSON.stringify(card));
    const r = await fetch('/pe_assets/item/' + id + '?proj=' + proj, { method: 'POST', body: fd }), j = await r.json().catch(() => ({ ok: false, why: 'The library did not answer.' }));
    if (!j.ok) throw new Error(j.why || 'The library said no.');
    say('Saved "' + nm + '" to the library' + (info.tris ? ' (' + info.tris.toLocaleString('en-US') + ' triangles' + (info.thinned ? ', ' + info.thinned.toLocaleString('en-US') + ' thinned from the copy; the work in the room keeps all of them' : '') + ')' : '') + '.'); return Object.assign({ bytes: buf.byteLength, tris: info.tris, thinned: info.thinned }, j);
  }
  return { decimate, prepare, glb, toGlb, save };
}
