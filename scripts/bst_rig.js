/* bst_rig.js: what BST knows about bones (Ruth, 2026-10-10: "their bones need to come in with them, all of them, including face and fingers").
   rigInfo(root): the skeleton of an object in words (how many bones, which are body, jaw and eyes, fingers, extras) and its shape keys (morph targets).
   mergeKeepBones(temp, name): the "Duplicate as one object" that keeps the bones. temp is a Group of clones. The skinned part with the most triangles gives the skeleton;
   every other part (skinned or not) is merged in where it stands: its triangles are moved into that mesh's space, its bone weights are renamed onto the same-named bones
   (a bone with no namesake goes to its nearest ancestor that has one), and a part with no bones is tied rigidly to its nearest bone. One SkinnedMesh, one material slot per
   distinct material (by uuid), uv, uv1, colours and shape keys kept (shape keys are united by name; a part without a key gets zero for it).
   The result is the clone of the skeleton's own object with its meshes replaced by the one merged mesh. Pure: depends on three and BufferGeometryUtils only. */
import * as THREE from 'three';
import { mergeGeometries } from '/pe_lib/bst_three_buffergeometryutils_0.186.1.js';
import { restToMesh } from '/pe_lib/bst_addbone.js';

const FINGER = /thumb|index|middle|ring|pinky|pinkie|finger/i, FACE = /jaw|tongue|eye|lid|brow|lip|cheek|nose|mouth|teeth|ear\b|face/i;
export function boneKind(name) {
  const m = /^j(\d+)$/.exec(name || '');
  if (m) { const n = +m[1]; return n <= 21 ? 'body' : n === 22 || n === 23 || n === 24 ? 'face' : n <= 54 ? 'fingers' : 'extras'; }
  return FINGER.test(name) ? 'fingers' : FACE.test(name) ? 'face' : 'body';
}
export function rigInfo(root) {
  const bones = new Set(), keys = new Set(); let skinned = 0, statics = 0;
  root.traverse(o => {
    if (o.isSkinnedMesh) { skinned++; if (o.skeleton) o.skeleton.bones.forEach(b => bones.add(b)); }
    else if (o.isMesh) statics++;
    if (o.isMesh && o.geometry && o.geometry.morphAttributes && o.geometry.morphAttributes.position) {
      const d = o.morphTargetDictionary ? Object.keys(o.morphTargetDictionary) : o.geometry.morphAttributes.position.map((_, i) => 'key ' + i);
      d.forEach(k => keys.add(k));
    }
  });
  const g = { body: 0, face: 0, fingers: 0, extras: 0, added: 0 }; bones.forEach(b => { if (b.userData && b.userData.added) g.added++; else g[boneKind(b.name)]++; });
  return { bones: bones.size, groups: g, skinned, statics, keys: [...keys] };
}
export const rigLine = r => r.bones ? `${r.bones} (${r.groups.body} body, ${r.groups.face} jaw and eyes, ${r.groups.fingers} fingers${r.groups.extras ? ', ' + r.groups.extras + ' extra' : ''}${r.groups.added ? ', ' + r.groups.added + ' added by you' : ''})` : '';
export const hasBones = root => { let h = false; root.traverse(o => { if (o.isSkinnedMesh) h = true; }); return h; };

const triOf = g => (g.index ? g.index.count : g.attributes.position.count) / 3;

export function mergeKeepBones(temp, name) {
  temp.updateMatrixWorld(true);
  const parts = [], rep = { parts: 0, skinned: 0, statics: 0, remapped: 0, hidden: 0, warnings: [] };
  temp.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { if (!o.visible) { rep.hidden++; return; } if (o.geometry && o.geometry.attributes.position) { parts.push(o); rep.parts++; o.isSkinnedMesh ? rep.skinned++ : rep.statics++; } } });
  const skinnedParts = parts.filter(p => p.isSkinnedMesh && p.skeleton);
  if (!skinnedParts.length) return { mesh: null, root: null, report: Object.assign(rep, { warnings: ['There are no bones to keep here.'] }) };
  const R0 = skinnedParts.reduce((a, b) => triOf(b.geometry) > triOf(a.geometry) ? b : a), skel = R0.skeleton;
  let refRoot = R0; while (refRoot.parent && refRoot.parent !== temp) refRoot = refRoot.parent;
  /* one skeleton only: parts of the same object, and wardrobe made for it (fewer bones, every name found on it), are kept. A skeleton from another object that is as big
     or bigger, or has a bone this one lacks, is another figure: BST does not invent a merged rig for two figures. */
  { const names = new Set(skel.bones.map(b => b.name)); let other = 0;
    for (const p of skinnedParts) { let r = p; while (r.parent && r.parent !== temp) r = r.parent; if (r === refRoot) continue;
      const pn = p.skeleton.bones.map(b => b.name); if (!(pn.length < names.size && pn.every(n => names.has(n)))) other++; }
    if (other) return { mesh: null, root: null, report: Object.assign(rep, { twoSkeletons: true, warnings: ['These parts have two skeletons (two figures). Duplicate as one object keeps the bones of one skeleton, plus clothes and hair made for it. Keep them as separate objects, or use Flatten, no bones.'] }) }; }
  const refIdx = new Map(); skel.bones.forEach((b, i) => { if (!refIdx.has(b.name)) refIdx.set(b.name, i); });
  const R0inv = R0.matrixWorld.clone().invert();
  const bindPos = skel.bones.map((b, i) => new THREE.Vector3().setFromMatrixPosition(skel.boneInverses[i].clone().invert()).applyMatrix4(restToMesh(THREE, R0)));   /* where each bone sits at rest, in the merged mesh's space */
  const keyNames = []; parts.forEach(p => { const m = p.geometry.morphAttributes && p.geometry.morphAttributes.position; if (m) (p.morphTargetDictionary ? Object.keys(p.morphTargetDictionary).sort((a, b) => p.morphTargetDictionary[a] - p.morphTargetDictionary[b]) : m.map((_, i) => 'key ' + i)).forEach(k => { if (!keyNames.includes(k)) keyNames.push(k); }); });
  const all = [];
  for (const mesh of parts) {
    const g = mesh.geometry, pos = g.attributes.position, M = R0inv.clone().multiply(mesh.matrixWorld), N = new THREE.Matrix3().getNormalMatrix(M), L = new THREE.Matrix3().setFromMatrix4(M);
    const flip = M.determinant() < 0, skinned = !!(mesh.isSkinnedMesh && mesh.skeleton);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material], idx = g.index ? g.index.array : null, total = idx ? idx.length : pos.count;
    const groups = (Array.isArray(mesh.material) && g.groups && g.groups.length) ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
    let map = null;   /* this part's bone number -> the merged skeleton's bone number */
    if (skinned) {
      map = mesh.skeleton.bones.map(b => { let c = b; while (c && c.isBone) { if (refIdx.has(c.name)) return refIdx.get(c.name); c = c.parent; } return 0; });
      mesh.skeleton.bones.forEach((b, i) => { if (!refIdx.has(b.name)) rep.remapped++; });
    }
    let staticBone = 0;
    if (!skinned) { const c = new THREE.Vector3(), v = new THREE.Vector3(); const step = Math.max(1, Math.floor(pos.count / 400)); let n = 0; for (let i = 0; i < pos.count; i += step) { c.add(v.fromBufferAttribute(pos, i).applyMatrix4(M)); n++; } c.multiplyScalar(1 / Math.max(1, n)); let best = 1e18; bindPos.forEach((p, i) => { const d = p.distanceToSquared(c); if (d < best) { best = d; staticBone = i; } }); }
    const morph = g.morphAttributes && g.morphAttributes.position, morphNames = morph ? (mesh.morphTargetDictionary ? Object.keys(mesh.morphTargetDictionary).sort((a, b) => mesh.morphTargetDictionary[a] - mesh.morphTargetDictionary[b]) : morph.map((_, i) => 'key ' + i)) : [];
    const v = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (const gr of groups) {
      const mat = mats[gr.materialIndex]; if (!mat) continue;
      const start = Math.max(0, gr.start), end = Math.min(total, gr.count === Infinity ? total : gr.start + gr.count), remap = new Map(), order = [], tri = [];
      for (let i = start; i + 2 < end + 0 && i < end; i += 3) {
        const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
        for (const o of [a, b, c]) if (!remap.has(o)) { remap.set(o, order.length); order.push(o); }
        tri.push(remap.get(a), remap.get(flip ? c : b), remap.get(flip ? b : c));
      }
      if (!tri.length) continue;
      const n = order.length, P = new Float32Array(n * 3), NN = new Float32Array(n * 3), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
      for (let j = 0; j < n; j++) {
        const o = order[j];
        v.fromBufferAttribute(pos, o).applyMatrix4(M); P[j * 3] = v.x; P[j * 3 + 1] = v.y; P[j * 3 + 2] = v.z;
        if (g.attributes.normal) { nrm.fromBufferAttribute(g.attributes.normal, o).applyMatrix3(N).normalize(); NN[j * 3] = nrm.x; NN[j * 3 + 1] = nrm.y; NN[j * 3 + 2] = nrm.z; }
        if (skinned) { const si = g.attributes.skinIndex, sw = g.attributes.skinWeight; let tot = 0; for (let k = 0; k < 4; k++) { SI[j * 4 + k] = map[si.getComponent(o, k)] || 0; SW[j * 4 + k] = sw.getComponent(o, k); tot += SW[j * 4 + k]; } if (tot > 0 && Math.abs(tot - 1) > 1e-6) for (let k = 0; k < 4; k++) SW[j * 4 + k] /= tot; }   /* four influences, re-normalised */
        else { SI[j * 4] = staticBone; SW[j * 4] = 1; }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); if (g.attributes.normal) geo.setAttribute('normal', new THREE.BufferAttribute(NN, 3));
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
      for (const k of ['uv', 'uv1', 'color']) if (g.attributes[k]) {
        const src = g.attributes[k], size = k === 'color' ? (src.itemSize >= 4 ? 4 : 3) : 2, A = new Float32Array(n * size);
        for (let j = 0; j < n; j++) for (let c = 0; c < size; c++) A[j * size + c] = src.getComponent(order[j], c);
        geo.setAttribute(k, new THREE.BufferAttribute(A, size));
      }
      geo.setIndex(tri); if (!geo.attributes.normal) geo.computeVertexNormals();
      const mv = new Map();
      if (morph) morphNames.forEach((kn, ki) => { const src = morph[ki], A = new Float32Array(n * 3); for (let j = 0; j < n; j++) { v.fromBufferAttribute(src, order[j]); if (!g.morphTargetsRelative) { nrm.fromBufferAttribute(pos, order[j]); v.sub(nrm); } v.applyMatrix3(L);   /* a key stored as absolute positions becomes a delta, so no shape key is ever dropped */ A[j * 3] = v.x; A[j * 3 + 1] = v.y; A[j * 3 + 2] = v.z; } mv.set(kn, A); });
      all.push({ geo, mat, mv, infl: mesh.morphTargetInfluences && mesh.morphTargetDictionary ? mesh.morphTargetDictionary : null, mesh });
    }
  }
  if (!all.length) return { mesh: null, root: null, report: Object.assign(rep, { warnings: ['There is nothing visible to merge.'] }) };
  for (const k of ['uv', 'uv1', 'color']) if (all.some(p => p.geo.attributes[k])) {
    const size = k === 'color' ? (all.some(p => p.geo.attributes.color && p.geo.attributes.color.itemSize === 4) ? 4 : 3) : 2;
    for (const p of all) {
      const a = p.geo.attributes[k], n = p.geo.attributes.position.count;
      if (!a) { const A = new Float32Array(n * size); if (k === 'color') A.fill(1); p.geo.setAttribute(k, new THREE.BufferAttribute(A, size)); }
      else if (a.itemSize !== size) { const A = new Float32Array(n * size); for (let j = 0; j < n; j++) for (let c = 0; c < size; c++) A[j * size + c] = c < a.itemSize ? a.getComponent(j, c) : 1; p.geo.setAttribute(k, new THREE.BufferAttribute(A, size)); }
    }
  }
  const usedKeys = keyNames.filter(k => all.some(p => p.mv.has(k)));
  if (usedKeys.length) for (const p of all) { const n = p.geo.attributes.position.count; p.geo.morphAttributes.position = usedKeys.map(k => new THREE.BufferAttribute(p.mv.get(k) || new Float32Array(n * 3), 3)); p.geo.morphTargetsRelative = true; }
  const order = [], byMat = new Map();
  for (const p of all) { if (!byMat.has(p.mat.uuid)) { byMat.set(p.mat.uuid, { mat: p.mat, geos: [] }); order.push(p.mat.uuid); } byMat.get(p.mat.uuid).geos.push(p.geo); }
  const perMat = order.map(id => { const e = byMat.get(id); return e.geos.length === 1 ? e.geos[0] : mergeGeometries(e.geos, false); });
  const merged = perMat.some(g => !g) ? null : perMat.length === 1 ? perMat[0] : mergeGeometries(perMat, true);
  if (!merged) return { mesh: null, root: null, report: Object.assign(rep, { warnings: ['The parts could not be merged (their vertex data does not line up).'] }) };
  const mats = order.map(id => byMat.get(id).mat);
  const mesh = new THREE.SkinnedMesh(merged, mats.length === 1 ? mats[0] : mats); mesh.name = name || 'One object';
  if (usedKeys.length) {
    mesh.morphTargetDictionary = {}; usedKeys.forEach((k, i) => { mesh.morphTargetDictionary[k] = i; });
    mesh.updateMorphTargets(); mesh.morphTargetDictionary = {}; usedKeys.forEach((k, i) => { mesh.morphTargetDictionary[k] = i; });
    mesh.morphTargetInfluences = usedKeys.map(k => { let m = 0; for (const p of all) if (p.infl && p.infl[k] != null) m = Math.max(m, p.mesh.morphTargetInfluences[p.infl[k]] || 0); return m; });
  }
  const parent = R0.parent; mesh.position.copy(R0.position); mesh.quaternion.copy(R0.quaternion); mesh.scale.copy(R0.scale);
  const doomed = []; refRoot.traverse(o => { if (o.isMesh) doomed.push(o); }); doomed.forEach(o => o.removeFromParent());
  parent.add(mesh); mesh.updateMatrixWorld(true); mesh.bind(skel, R0.bindMatrix); mesh.bindMode = R0.bindMode;
  refRoot.removeFromParent(); refRoot.name = name || refRoot.name;
  rep.materials = mats.length; rep.verts = merged.attributes.position.count; rep.tris = Math.round((merged.index ? merged.index.count : rep.verts) / 3);
  rep.bones = skel.bones.length; rep.keys = usedKeys.length;
  if (rep.remapped) rep.warnings.push(rep.remapped + ' bone' + (rep.remapped === 1 ? '' : 's') + ' of other parts had no namesake and moved onto the nearest parent bone.');
  if (rep.statics) rep.warnings.push(rep.statics + ' part' + (rep.statics === 1 ? ' has' : 's have') + ' no bones and ' + (rep.statics === 1 ? 'is' : 'are') + ' tied to the nearest bone.');
  if (rep.hidden) rep.warnings.push(rep.hidden + ' hidden part' + (rep.hidden === 1 ? ' was' : 's were') + ' left out.');
  return { mesh, root: refRoot, report: rep };
}

/* the app's joint numbering (couple3d.html JOINT_LABELS and the 55 body, jaw, eye and finger joints of the MakeHuman figures): plain words for j0 to j54, the extras by number */
const BODY = ['Pelvis', 'Left hip', 'Right hip', 'Spine', 'Left knee', 'Right knee', 'Chest', 'Left ankle', 'Right ankle', 'Upper chest', 'Left foot', 'Right foot', 'Neck', 'Left collar', 'Right collar', 'Head', 'Left shoulder', 'Right shoulder', 'Left elbow', 'Right elbow', 'Left wrist', 'Right wrist', 'Jaw', 'Left eye', 'Right eye'];
const FING = ['index 1', 'index 2', 'index 3', 'middle 1', 'middle 2', 'middle 3', 'pinky 1', 'pinky 2', 'pinky 3', 'ring 1', 'ring 2', 'ring 3', 'thumb 1', 'thumb 2', 'thumb 3'];
export function boneLabel(name) {
  const m = /^j(\d+)$/.exec(name || ''); if (!m) return name || 'bone';
  const n = +m[1]; if (n < BODY.length) return BODY[n];
  if (n >= 25 && n <= 54) return (n < 40 ? 'Left ' : 'Right ') + FING[(n - 25) % 15];
  return 'Extra bone ' + n;
}
