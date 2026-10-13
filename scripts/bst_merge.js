/* bst_merge.js: "Duplicate as one object" (Ruth, 2026-10-10: "a duplicate object tool that takes the mathmatics of the object (which might be a group and have
   multiple objects inside) and makes it all one one object"). mergeToOne(root, name) never touches root: it reads every visible mesh under it, bakes each part's
   world matrix into the vertices, and returns ONE Mesh with one material slot per distinct material (same material object, by uuid, never by name),
   so the skins survive. Kept: position, normal, uv, uv1, vertex colours. A mirrored part (negative scale) has its winding flipped so it still faces out.
   A skinned part is merged in its current pose and its normals are recomputed; morph targets are dropped; lines and points are not merged. The report says each of these.
   Pure: depends only on three and BufferGeometryUtils, so it can be tested without the page. */
import * as THREE from 'three';
import { mergeGeometries } from '/pe_lib/bst_three_buffergeometryutils_0.186.1.js';

function toFloat(attr, size) {   /* a plain Float32 copy at `size` components (padding with 0, or 1 for the 4th colour component), whatever the source type */
  const n = attr.count, out = new Float32Array(n * size), src = attr.itemSize;
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) out[i * size + k] = k < src ? (attr.normalized ? attr.getComponent(i, k) : attr.getComponent(i, k)) : (size === 4 && k === 3 ? 1 : 0);
  return new THREE.BufferAttribute(out, size);
}

/* one piece = the triangles of one mesh that use one material, as a compact indexed geometry in WORLD space */
function pieces(mesh) {
  const g = mesh.geometry, pos = g.attributes.position; if (!pos) return [];
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const idx = g.index ? g.index.array : null, total = idx ? idx.length : pos.count;
  const groups = (Array.isArray(mesh.material) && g.groups && g.groups.length) ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
  const world = mesh.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(world), flip = world.determinant() < 0, skinned = !!mesh.isSkinnedMesh;
  const v = new THREE.Vector3(), nrm = new THREE.Vector3(), out = [];
  for (const gr of groups) {
    const mat = mats[gr.materialIndex]; if (!mat) continue;
    const start = Math.max(0, gr.start), end = Math.min(total, gr.count === Infinity ? total : gr.start + gr.count), remap = new Map(), order = [], tri = [];
    for (let i = start; i + 2 < end + 0 && i < end; i += 3) {
      const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2, ids = [a, b, c];
      for (const o of ids) if (!remap.has(o)) { remap.set(o, order.length); order.push(o); }
      tri.push(remap.get(a), remap.get(flip ? c : b), remap.get(flip ? b : c));
    }
    if (!tri.length) continue;
    const n = order.length, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    const has = k => !!g.attributes[k];
    for (let j = 0; j < n; j++) {
      const o = order[j];
      if (skinned) mesh.getVertexPosition(o, v); else v.fromBufferAttribute(pos, o);
      v.applyMatrix4(world); P[j * 3] = v.x; P[j * 3 + 1] = v.y; P[j * 3 + 2] = v.z;
      if (g.attributes.normal) { nrm.fromBufferAttribute(g.attributes.normal, o).applyMatrix3(nm).normalize(); N[j * 3] = nrm.x; N[j * 3 + 1] = nrm.y; N[j * 3 + 2] = nrm.z; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    if (g.attributes.normal && !skinned) geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    for (const k of ['uv', 'uv1', 'color']) if (has(k)) {
      const src = g.attributes[k], size = k === 'color' ? (src.itemSize >= 4 ? 4 : 3) : 2, A = new Float32Array(n * size);
      for (let j = 0; j < n; j++) for (let c = 0; c < size; c++) A[j * size + c] = src.getComponent(order[j], c);
      geo.setAttribute(k, new THREE.BufferAttribute(A, size));
    }
    geo.setIndex(tri);
    if (!geo.attributes.normal) geo.computeVertexNormals();   /* a skinned part, or a part that had none */
    out.push({ geo, mat, skinned, morph: !!(g.morphAttributes && g.morphAttributes.position) });
  }
  return out;
}

export function mergeToOne(root, name) {
  root.updateMatrixWorld(true);
  const all = [], rep = { parts: 0, skinned: 0, morph: 0, ignoredLines: 0, hidden: 0, warnings: [] };
  root.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) {
      if (!o.visible) { rep.hidden++; return; }
      rep.parts++; if (o.isSkinnedMesh) rep.skinned++;
      for (const p of pieces(o)) { all.push(p); if (p.morph) rep.morph++; }
    } else if (o.isLine || o.isPoints) rep.ignoredLines++;
  });
  if (!all.length) return { mesh: null, report: Object.assign(rep, { warnings: ['There is nothing visible to merge.'] }) };
  /* one attribute set for every piece, or the merge refuses */
  const want = k => all.some(p => p.geo.attributes[k]);
  for (const k of ['uv', 'uv1', 'color']) if (want(k)) {
    const size = k === 'color' ? (all.some(p => p.geo.attributes.color && p.geo.attributes.color.itemSize === 4) ? 4 : 3) : 2;
    for (const p of all) {
      const a = p.geo.attributes[k];
      if (!a) { const n = p.geo.attributes.position.count, A = new Float32Array(n * size); if (k === 'color') A.fill(1); p.geo.setAttribute(k, new THREE.BufferAttribute(A, size)); }
      else if (a.itemSize !== size) p.geo.setAttribute(k, toFloat(a, size));
    }
  }
  /* group by material object, in first-seen order, merge each group, then merge the groups so each keeps its own slot */
  const order = [], byMat = new Map();
  for (const p of all) { if (!byMat.has(p.mat.uuid)) { byMat.set(p.mat.uuid, { mat: p.mat, geos: [] }); order.push(p.mat.uuid); } byMat.get(p.mat.uuid).geos.push(p.geo); }
  const perMat = order.map(id => { const e = byMat.get(id); return e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false); });
  if (perMat.some(g => !g)) return { mesh: null, report: Object.assign(rep, { warnings: ['The parts could not be merged (their vertex data does not line up).'] }) };
  const merged = perMat.length === 1 ? perMat[0] : mergeGeometries(perMat, true);
  if (!merged) return { mesh: null, report: Object.assign(rep, { warnings: ['The parts could not be merged (their vertex data does not line up).'] }) };
  const mats = order.map(id => byMat.get(id).mat);
  const mesh = new THREE.Mesh(merged, mats.length === 1 ? mats[0] : mats); mesh.name = name || 'One object';
  rep.materials = mats.length; rep.verts = merged.attributes.position.count; rep.tris = Math.round((merged.index ? merged.index.count : rep.verts) / 3);
  if (rep.skinned) rep.warnings.push(rep.skinned + ' skinned part' + (rep.skinned === 1 ? ' was' : 's were') + ' merged in the current pose and lose their bones.');
  if (rep.morph) rep.warnings.push('Shape keys (morph targets) were dropped.');
  if (rep.ignoredLines) rep.warnings.push(rep.ignoredLines + ' line or point object' + (rep.ignoredLines === 1 ? ' was' : 's were') + ' left out.');
  if (rep.hidden) rep.warnings.push(rep.hidden + ' hidden part' + (rep.hidden === 1 ? ' was' : 's were') + ' left out.');
  return { mesh, report: rep };
}
