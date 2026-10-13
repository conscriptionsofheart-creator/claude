/* sculpt_next_testkit.js: a stand-in figure for the self-test page when lib/female.glb is not there (the package copied to the cloud had no models). Built in code, any three.js revision:
   a lathe body with two legs, bones named like the app's figures (j0 hips, j1 / j2 the lateral hips with j1 on the LEFT at +x, knees, spine, chest, neck, head), skin weights blended between bones,
   an existing shape key "Smile", a posed knee (so posed and rest differ), and a worn shirt piece (userData.wardrobe) skinned to the same skeleton. Test use only. */
export function makeTestFigure(THREE) {
  const V3 = THREE.Vector3, old = parseInt(THREE.REVISION, 10) < 130;
  const pos = [], idx = [], si = [], sw = [];
  const bones = {}, mk = (name, x, y, z, parent) => { const b = new THREE.Bone(); b.name = name; b.userData.at = new V3(x, y, z); bones[name] = b; if (parent) { parent.add(b); b.position.set(x, y, z).sub(parent.userData.at); } else b.position.set(x, y, z); return b; };
  const j0 = mk('j0', 0, 0.9, 0), j1 = mk('j1', 0.1, 0.9, 0, j0), j2 = mk('j2', -0.1, 0.9, 0, j0), j4 = mk('j4', 0.1, 0.47, 0, j1), j5 = mk('j5', -0.1, 0.47, 0, j2), j7 = mk('j7', 0.1, 0.05, 0, j4), j8 = mk('j8', -0.1, 0.05, 0, j5);
  const j3 = mk('j3', 0, 1.15, 0, j0), j6 = mk('j6', 0, 1.38, 0, j3), j9 = mk('j9', 0, 1.53, 0, j6), j12 = mk('j12', 0, 1.62, 0, j9);
  const list = [j0, j1, j2, j3, j4, j5, j6, j7, j8, j9, j12], bi = b => list.indexOf(b);
  /* a tube of rings round an axis at (cx, cz), from y0 to y1, radius r(y); weight(y) -> [[bone, w], ...] */
  function tube(cx, cz, y0, y1, rings, seg, r, weight, capTop, capBottom) {
    const base = pos.length / 3;
    for (let i = 0; i <= rings; i++) { const y = y0 + (y1 - y0) * i / rings, rr = r(y), w = weight(y); for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2; pos.push(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr); const ws = w.slice(0, 4); while (ws.length < 4) ws.push([j0, 0]); const tot = ws.reduce((s, x) => s + x[1], 0) || 1; ws.forEach(([b, v]) => { si.push(bi(b)); sw.push(v / tot); }); } }
    for (let i = 0; i < rings; i++) for (let k = 0; k < seg; k++) { const a = base + i * seg + k, b = base + i * seg + (k + 1) % seg, c = a + seg, d = b + seg; idx.push(a, c, b, b, c, d); }
    const cap = (ring, up) => { const ctr = pos.length / 3, y = y0 + (y1 - y0) * ring / rings, w = weight(y); pos.push(cx, y, cz); const ws = w.slice(0, 4); while (ws.length < 4) ws.push([j0, 0]); const tot = ws.reduce((s, x) => s + x[1], 0) || 1; ws.forEach(([b, v]) => { si.push(bi(b)); sw.push(v / tot); }); for (let k = 0; k < seg; k++) { const a = base + ring * seg + k, b = base + ring * seg + (k + 1) % seg; if (up) idx.push(ctr, b, a); else idx.push(ctr, a, b); } };
    if (capTop) cap(rings, true); if (capBottom) cap(0, false);
  }
  const blend = (y, pts) => { for (let i = 0; i < pts.length - 1; i++) { const [ya, ba] = pts[i], [yb, bb] = pts[i + 1]; if (y <= yb) { const t = Math.max(0, Math.min(1, (y - ya) / (yb - ya))); return [[ba, 1 - t], [bb, t]]; } } return [[pts[pts.length - 1][1], 1]]; };
  tube(0, 0, 0.88, 1.75, 44, 40, y => y > 1.55 ? Math.max(0.02, 0.1 * Math.sqrt(Math.max(0, 1 - ((y - 1.66) / 0.1) ** 2))) + (y < 1.58 ? 0.03 : 0) : y > 1.5 ? 0.05 : 0.15 + 0.03 * Math.sin((y - 0.88) * 6), y => blend(y, [[0.9, j0], [1.15, j3], [1.38, j6], [1.53, j9], [1.62, j12]]), true, true);
  [[0.1, j1, j4, j7], [-0.1, j2, j5, j8]].forEach(([x, hip, knee, ankle]) => tube(x, 0, 0.04, 0.9, 30, 20, y => 0.065 - 0.02 * (0.9 - y), y => blend(y, [[0.05, ankle], [0.47, knee], [0.9, hip]]), false, true));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  const smile = new Float32Array(pos.length); for (let i = 0; i < pos.length / 3; i++) if (pos[i * 3 + 1] > 1.6 && pos[i * 3 + 2] > 0.03) smile[i * 3 + 2] = 0.006;
  const sa = new THREE.BufferAttribute(smile, 3); sa.name = 'Smile'; g.morphAttributes.position = [sa]; g.morphTargetsRelative = true;
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8b49a, roughness: 0.7 }); if (old) { mat.skinning = true; mat.morphTargets = true; }
  const body = new THREE.SkinnedMesh(g, mat); body.name = 'body'; body.morphTargetDictionary = { Smile: 0 }; body.morphTargetInfluences = [0.5];
  const root = new THREE.Group(); root.name = 'test figure'; root.add(j0); root.add(body); root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(list); body.bind(skel);
  /* a shirt: a slightly larger tube over the chest, skinned to the same bones, worn (userData.wardrobe) */
  const sp = [], sidx = [], ssi = [], ssw = [], seg = 36, rings = 12;
  for (let i = 0; i <= rings; i++) { const y = 1.1 + 0.4 * i / rings, w = blend(y, [[1.15, j3], [1.38, j6], [1.53, j9]]); for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2, rr = 0.15 + 0.03 * Math.sin((y - 0.88) * 6) + 0.012; sp.push(Math.cos(a) * rr, y, Math.sin(a) * rr); ssi.push(bi(w[0][0]), bi(w[1] ? w[1][0] : j0), 0, 0); ssw.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0); } }
  for (let i = 0; i < rings; i++) for (let k = 0; k < seg; k++) { const a = i * seg + k, b = i * seg + (k + 1) % seg, c = a + seg, d = b + seg; sidx.push(a, c, b, b, c, d); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(sidx); sg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ssi, 4)); sg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(ssw, 4)); sg.computeVertexNormals();
  const smat = new THREE.MeshStandardMaterial({ color: 0x5a7fb0 }); if (old) smat.skinning = true;
  const shirt = new THREE.SkinnedMesh(sg, smat); shirt.name = 'cloth_shirt'; shirt.userData.wardrobe = 'shirt'; root.add(shirt); shirt.bind(skel, body.bindMatrix);
  j4.rotation.x = 0.4; j3.rotation.z = 0.05; root.updateMatrixWorld(true); skel.update();
  return { root, body, shirt, skeleton: skel, bones };
}
