/* bst_weights.js: skin weight painting maths (Ruth, 2026-10-10: bones that "come in with them", plus the add bones function; weight painting is how a figure bends where you want).
   Pure: makeWeights(THREE, S) takes three and the sculpt core S (bst_sculpt_core.js, for its radius query on welded points), so the Atelier headset can load it too.
   A vertex holds up to four bone influences (skinIndex, skinWeight) that always add to 1. The brush sets ONE bone's share of a vertex to a target and the other influences give or take
   in proportion, so the four stay normalised. Add raises the bone's share, Remove lowers it (the share goes to the other influences, or to the bone's parent if it held the vertex alone),
   Smooth moves it toward the average of the neighbours. Vertices at the same place (UV seams) take the same weights, so nothing tears. Strokes record each touched vertex's eight first values. */
export function makeWeights(THREE, S) {
  const fall = (d, r) => { const t = d / r; return t >= 1 ? 0 : (1 - t * t) * (1 - t * t); };
  /* the bone's current share of vertex v */
  function shareOf(ia, wa, v, bi) { const o = v * 4; let s = 0; for (let k = 0; k < 4; k++) if (ia.array[o + k] === bi) s += wa.array[o + k]; return s; }
  /* set bone bi's share of vertex v to target (0 to 1); parentIdx takes the share back if the bone held the vertex alone */
  function setShare(ia, wa, v, bi, target, parentIdx) {
    const o = v * 4, A = ia.array, W = wa.array; target = Math.max(0, Math.min(1, target));
    const cur = shareOf(ia, wa, v, bi); if (Math.abs(cur - target) < 1e-6) return false;
    if (target > cur) {   /* the others shrink by (1 - w), the bone takes the room */
      const w = cur >= 1 ? 0 : (target - cur) / (1 - cur);
      let slot = -1; for (let k = 0; k < 4; k++) if (A[o + k] === bi && W[o + k] > 0) slot = k;
      if (slot < 0) { slot = 0; for (let k = 1; k < 4; k++) if (W[o + k] < W[o + slot]) slot = k; }
      for (let k = 0; k < 4; k++) if (k !== slot) W[o + k] *= (1 - w);
      const had = A[o + slot] === bi ? W[o + slot] : 0; A[o + slot] = bi; W[o + slot] = had * (1 - w) + w;
    } else {   /* the bone shrinks to target, the others grow in proportion */
      const others = 1 - cur;
      if (others > 1e-6) { const f = (1 - target) / others; for (let k = 0; k < 4; k++) { if (A[o + k] === bi) W[o + k] *= cur > 0 ? target / cur : 0; else W[o + k] *= f; } }
      else if (parentIdx != null && parentIdx >= 0 && parentIdx !== bi) {   /* it held the vertex alone: the parent takes the part given up */
        let slot = -1; for (let k = 0; k < 4; k++) if (A[o + k] === parentIdx && W[o + k] > 0) slot = k;
        if (slot < 0) { for (let k = 0; k < 4; k++) if (A[o + k] === bi) { slot = k; break; } }
        for (let k = 0; k < 4; k++) if (A[o + k] === bi) W[o + k] = target;
        const other = [0, 1, 2, 3].find(k => A[o + k] !== bi && W[o + k] === 0); const put = other !== undefined ? other : slot;
        if (A[o + put] !== bi) { A[o + put] = parentIdx; W[o + put] = 1 - target; }
      } else return false;
    }
    let s = 0; for (let k = 0; k < 4; k++) s += W[o + k]; if (s > 0) for (let k = 0; k < 4; k++) W[o + k] /= s;
    return true;
  }
  /* every vertex's share of bone bi, for the colour view */
  function boneWeights(mesh, bi, out) {
    const g = mesh.geometry, ia = g.attributes.skinIndex, wa = g.attributes.skinWeight, n = g.attributes.position.count; out = out || new Float32Array(n);
    for (let v = 0; v < n; v++) out[v] = shareOf(ia, wa, v, bi);
    return out;
  }
  function colourise(mesh, bi) {   /* blue = this bone owns none of the vertex, green = half, red = all of it */
    const g = mesh.geometry, n = g.attributes.position.count; let c = g.attributes.color;
    if (!g.userData.weightColours) {   /* a figure's own vertex colours are put aside and come back when the view ends */
      if (c) g.userData.ownColour = c;
      c = new THREE.BufferAttribute(new Float32Array(n * 3), 3); g.setAttribute('color', c); g.userData.weightColours = true;
    }
    const w = bi >= 0 ? boneWeights(mesh, bi) : new Float32Array(n), A = c.array;
    for (let v = 0; v < n; v++) { const t = w[v]; if (t < 0.5) { A[v * 3] = 0; A[v * 3 + 1] = 2 * t; A[v * 3 + 2] = 1 - 2 * t; } else { A[v * 3] = 2 * (t - 0.5); A[v * 3 + 1] = 1 - 2 * (t - 0.5); A[v * 3 + 2] = 0; } }
    c.needsUpdate = true;
  }
  function clearColours(mesh) {
    const g = mesh.geometry; if (!g.userData.weightColours) return;
    delete g.userData.weightColours; g.deleteAttribute('color'); if (g.userData.ownColour) { g.setAttribute('color', g.userData.ownColour); delete g.userData.ownColour; }
  }
  /* one dab. st = the sculpt state of this mesh's geometry (S.prepare). opts: mode 'add' | 'remove' | 'smooth', radius (rest-space metres), strength 0 to 1, parentIdx. rec fills with first values. */
  function dab(st, mesh, bi, c, opts, rec) {
    const g = mesh.geometry, ia = g.attributes.skinIndex, wa = g.attributes.skinWeight, hits = S.near(st, c, opts.radius); let moved = 0;
    const avg = [];   /* neighbour averages are read before any write, so the order of the points does not matter */
    if (opts.mode === 'smooth') for (const [gr] of hits) { const ns = st.nb[gr]; if (!ns.length) { avg.push(null); continue; } let s = 0; for (const q of ns) s += shareOf(ia, wa, st.members[q][0], bi); avg.push(s / ns.length); }
    hits.forEach(([gr, d], hi) => {
      const f = fall(d, opts.radius); if (f <= 0) return; const mem = st.members[gr], v0 = mem[0], cur = shareOf(ia, wa, v0, bi); let target;
      if (opts.mode === 'add') target = cur + opts.strength * f * (1 - cur);
      else if (opts.mode === 'remove') target = cur * (1 - opts.strength * f);
      else { if (avg[hi] == null) return; target = cur + (avg[hi] - cur) * Math.min(1, opts.strength * f * 0.6); }
      if (Math.abs(target - cur) < 1e-5) return;
      for (const m of mem) {
        if (rec && !rec.has(m)) rec.set(m, [ia.array[m * 4], ia.array[m * 4 + 1], ia.array[m * 4 + 2], ia.array[m * 4 + 3], wa.array[m * 4], wa.array[m * 4 + 1], wa.array[m * 4 + 2], wa.array[m * 4 + 3]]);
        setShare(ia, wa, m, bi, target, opts.parentIdx);
      }
      moved++;
    });
    if (moved) { ia.needsUpdate = true; wa.needsUpdate = true; }
    return moved;
  }
  /* undo and redo: swap the recorded values with the current ones */
  function swap(mesh, rec) {
    const g = mesh.geometry, ia = g.attributes.skinIndex, wa = g.attributes.skinWeight, out = new Map();
    rec.forEach((v, m) => {
      out.set(m, [ia.array[m * 4], ia.array[m * 4 + 1], ia.array[m * 4 + 2], ia.array[m * 4 + 3], wa.array[m * 4], wa.array[m * 4 + 1], wa.array[m * 4 + 2], wa.array[m * 4 + 3]]);
      for (let k = 0; k < 4; k++) { ia.array[m * 4 + k] = v[k]; wa.array[m * 4 + k] = v[4 + k]; }
    });
    ia.needsUpdate = true; wa.needsUpdate = true; return out;
  }
  return { shareOf, setShare, boneWeights, colourise, clearColours, dab, swap };
}
