/* bst_addbone.js: Add bone (Ruth, 2026-10-10: "the add bones function"). The manual has no add-bones function, so this is new. Pure: addBoneTo(THREE, ...) takes three as a parameter and works
   on any skinned figure (r128 or r186). A new bone is a child of a chosen parent bone, placed by an offset from the parent in the figure's own rest axes (metres), and is pushed onto the
   skeleton of every skinned mesh that has the parent. Its rest pose is the parent's rest orientation, so the skeleton's bind inverses stay true. Optional skin: the vertices within a radius
   take some of their weight from the old bones and give it to the new one (full at the bone, nothing at the rim, the same soft edge as the sculpt brushes); a vertex holds four influences,
   so the smallest one makes room. Everything is undoable: undo removes the bone and puts the old weights back byte for byte. The new bone carries userData.added = true, which the glTF
   exporter writes as an extra, so the figure remembers which bones are yours. */
/* Where a skinned mesh's own coordinates sit against the skeleton's bind frame. A mesh bound the usual way ('attached', what the glTF loader does) has its vertices in that frame already, wherever
   the figure is standing on the stage: three.js rewrites bindMatrix to the mesh's world matrix every frame in that mode, so bindMatrixInverse must NOT be used to get back to rest space
   (found by the round-trip test: a figure standing beside another had every rest position shifted by the stage offset). Only a 'detached' mesh keeps a true bind matrix. */
export function restToMesh(THREE, mesh) { return mesh.bindMode === 'detached' ? new THREE.Matrix4().copy(mesh.bindMatrixInverse) : new THREE.Matrix4(); }
export function restWorld(THREE, skel, bone) {
  const i = skel.bones.indexOf(bone); if (i < 0) return null;
  return new THREE.Matrix4().copy(skel.boneInverses[i]).invert();
}
/* where a new bone goes by default: on along the line from the parent's own parent to the parent (so a new bone off an upper arm carries on down the arm), 10 cm long; a bone with no parent goes up */
export function defaultOffset(THREE, root, parent) {
  let skel = null; root.traverse(o => { if (!skel && o.isSkinnedMesh && o.skeleton && o.skeleton.bones.includes(parent)) skel = o.skeleton; });
  const V = THREE.Vector3, up = new V(0, 0.1, 0); if (!skel) return up;
  const p = new V().setFromMatrixPosition(restWorld(THREE, skel, parent));
  const pp = parent.parent && skel.bones.includes(parent.parent) ? new V().setFromMatrixPosition(restWorld(THREE, skel, parent.parent)) : null;
  if (!pp || pp.distanceTo(p) < 1e-4) return up;
  return p.sub(pp).normalize().multiplyScalar(0.1);
}
const fall = t => t >= 1 ? 0 : (1 - t * t) * (1 - t * t);
/* give vertex v (in attributes ia = skinIndex, wa = skinWeight) a share w of new bone index bi: the old weights shrink by (1 - w), the smallest slot is overwritten, the four are renormalised */
function giveShare(ia, wa, v, bi, w) {
  const o = v * 4; let slot = -1;
  for (let k = 0; k < 4; k++) if (ia.array[o + k] === bi && wa.array[o + k] > 0) slot = k;
  if (slot < 0) { slot = 0; for (let k = 1; k < 4; k++) if (wa.array[o + k] < wa.array[o + slot]) slot = k; }
  const old = slot >= 0 && ia.array[o + slot] === bi ? wa.array[o + slot] : 0;
  for (let k = 0; k < 4; k++) if (k !== slot) wa.array[o + k] *= (1 - w);
  ia.array[o + slot] = bi; wa.array[o + slot] = Math.max(old * (1 - w), 0) + w;
  let s = 0; for (let k = 0; k < 4; k++) s += wa.array[o + k]; if (s > 0) for (let k = 0; k < 4; k++) wa.array[o + k] /= s;
}
export function addBoneTo(THREE, root, parent, opts) {
  const V = THREE.Vector3, M = THREE.Matrix4, name = (opts.name || 'New bone').trim() || 'New bone', off = new V(...(opts.offset || [0, 0.1, 0])), radius = opts.radius || 0;
  const meshes = []; root.traverse(o => { if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones.includes(parent)) meshes.push(o); });
  if (!meshes.length) return { error: 'That bone belongs to no skinned figure here.' };
  const skels = [...new Set(meshes.map(m => m.skeleton))];
  const taken = new Set(); skels.forEach(s => s.bones.forEach(b => taken.add(b.name)));
  let nm = name, n = 2; while (taken.has(nm)) nm = name + ' ' + n++;
  const bone = new THREE.Bone(); bone.name = nm; bone.userData.added = true;
  const ref = skels[0], P = restWorld(THREE, ref, parent), pp = new V().setFromMatrixPosition(P);
  const local = pp.clone().add(off).applyMatrix4(new M().copy(P).invert());   /* the offset, as a position in the parent's own axes */
  bone.position.copy(local);
  const rest = new M().copy(P).multiply(new M().makeTranslation(local.x, local.y, local.z)), inv = new M().copy(rest).invert(), here = new V().setFromMatrixPosition(rest);
  /* skin: the weights that change, per mesh, copied first so undo is exact */
  const saved = [];
  if (radius > 0) for (const m of meshes) {
    const g = m.geometry, ia = g.attributes.skinIndex, wa = g.attributes.skinWeight; if (!ia || !wa) continue;
    saved.push({ m, ia: ia.array.slice(), wa: wa.array.slice() });
  }
  const added = { mesh: 0, verts: 0 };
  const apply = () => {
    parent.add(bone);
    skels.forEach(s => { if (s.bones.includes(bone)) return; s.bones.push(bone); s.boneInverses.push(inv.clone()); s.dispose(); s.init(); });
    if (radius > 0) {
      added.verts = 0; added.mesh = 0;
      for (const sv of saved) {
        const m = sv.m, g = m.geometry, pos = g.attributes.position, ia = g.attributes.skinIndex, wa = g.attributes.skinWeight, bi = m.skeleton.bones.indexOf(bone), c = here.clone().applyMatrix4(restToMesh(THREE, m)), q = new V();
        let cnt = 0; for (let i = 0; i < pos.count; i++) { q.fromBufferAttribute(pos, i); const d = q.distanceTo(c); if (d >= radius) continue; const w = fall(d / radius); if (w < 0.01) continue; giveShare(ia, wa, i, bi, w); cnt++; }
        ia.needsUpdate = true; wa.needsUpdate = true; added.verts += cnt; added.mesh++;
      }
    }
  };
  const undo = () => {
    skels.forEach(s => { const i = s.bones.indexOf(bone); if (i >= 0) { s.bones.splice(i, 1); s.boneInverses.splice(i, 1); s.dispose(); s.init(); } });
    parent.remove(bone);
    saved.forEach(sv => { const g = sv.m.geometry; g.attributes.skinIndex.array.set(sv.ia); g.attributes.skinWeight.array.set(sv.wa); g.attributes.skinIndex.needsUpdate = true; g.attributes.skinWeight.needsUpdate = true; });
  };
  const redo = () => {   /* the weights were restored by undo to their first values; applying again repeats exactly */
    apply();
  };
  apply();
  return { bone, undo, redo, report: { name: nm, parent: parent.name, skeletons: skels.length, meshes: added.mesh, vertices: added.verts, offset: off.toArray().map(x => +x.toFixed(4)) } };
}
