/* bst_shapekeys.js: shape keys (morph targets) and the limb a sculpt stroke belongs to, shared by the desktop Sculpt tab (r186) and the headset sculpt tool (r128). Pure: makeShapeKeys(THREE) takes three
   as a parameter, so one file is tested in both. Ruth, 2026-10-10: "bags under the eyes ... a beauty mark or a lump, or melt down a leg into a stump", "a neck roll", mirror or not, 360 or not.
   ensureKey: a named key on a mesh (per-vertex deltas, relative). In three r128 a material only morphs when material.morphTargets is true, so it is switched on there (it is gone from r131 on).
   limbAxis / sideOf: the bind-pose bone segment nearest a point (so 360 goes round a neck, an arm or a waist) and which side of a j-numbered figure the point is on (left hip j1's sign). */
import { restToMesh } from '/pe_lib/bst_addbone.js';
export function makeShapeKeys(THREE) {
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, oldMorphFlag = parseInt(THREE.REVISION, 10) < 131;
  const keysOf = mesh => Object.keys(mesh.morphTargetDictionary || {}).sort((a, b) => mesh.morphTargetDictionary[a] - mesh.morphTargetDictionary[b]);
  function ensureKey(mesh, name) {
    const g = mesh.geometry; g.morphAttributes.position = g.morphAttributes.position || [];
    if (!mesh.morphTargetDictionary) mesh.morphTargetDictionary = {};
    let k = mesh.morphTargetDictionary[name], added = false;
    if (k === undefined) {
      added = true;
      const old = (mesh.morphTargetInfluences || []).slice(), a = new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3); a.name = name;
      g.morphAttributes.position.push(a); g.morphTargetsRelative = true; mesh.updateMorphTargets();
      g.morphAttributes.position.forEach((x, i) => { if (!x.name) x.name = 'key ' + i; });
      k = g.morphAttributes.position.length - 1; mesh.morphTargetDictionary[name] = k;
      old.forEach((v, i) => { mesh.morphTargetInfluences[i] = v; }); mesh.morphTargetInfluences[k] = 1;   /* a new key shows at full strength while you shape it */
    }
    if (oldMorphFlag) {
      [].concat(mesh.material).forEach(m => { if (m && !m.morphTargets) { m.morphTargets = true; m.needsUpdate = true; } });
      if (added) {   /* this r128 build builds its list of morph influences once per geometry and never rebuilds it when a key is added (the render then throws), so a new key gets a new geometry object that shares every buffer: a new id, a fresh list, no re-upload */
        const g0 = mesh.geometry, ng = new THREE.BufferGeometry(); ng.name = g0.name; ng.index = g0.index; Object.keys(g0.attributes).forEach(n => ng.setAttribute(n, g0.attributes[n]));
        ng.morphAttributes = g0.morphAttributes; ng.morphTargetsRelative = true; ng.groups = g0.groups; ng.boundingBox = g0.boundingBox; ng.boundingSphere = g0.boundingSphere; ng.userData = g0.userData; mesh.geometry = ng;
      }
    }
    return k;
  }
  const nextKeyName = mesh => { const have = new Set(keysOf(mesh)); let n = 1; while (have.has('Shape ' + n) || have.has('Shape ' + n + ' (left)') || have.has('Shape ' + n + ' (right)')) n++; return 'Shape ' + n; };
  const segCache = new WeakMap();
  function segmentsOf(mesh) {
    if (segCache.has(mesh)) return segCache.get(mesh);
    const out = { segs: [], leftX: 1 };
    if (mesh.isSkinnedMesh && mesh.skeleton) {
      const sk = mesh.skeleton, P = new Map(), bi = sk.boneInverses, lateral = new Set(['j1', 'j2', 'j13', 'j14']), toMesh = restToMesh(THREE, mesh);
      sk.bones.forEach((b, i) => { if (bi[i]) P.set(b, new V3().setFromMatrixPosition(new M4().copy(bi[i]).invert()).applyMatrix4(toMesh)); });
      sk.bones.forEach(b => {
        const pa = b.parent; if (!pa || !P.has(pa) || !P.has(b) || lateral.has(b.name)) return;
        const a = P.get(pa), c = P.get(b); if (a.distanceTo(c) < 1e-4) return; out.segs.push([a, c]);
      });
      const hip = sk.bones.find(b => b.name === 'j1'); if (hip && P.has(hip) && Math.abs(P.get(hip).x) > 1e-4) out.leftX = Math.sign(P.get(hip).x);
    }
    segCache.set(mesh, out); return out;
  }
  function limbAxis(mesh, c) {
    const { segs } = segmentsOf(mesh); let best = null, bd = 1e9;
    for (const [a, b] of segs) {
      const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / ab.lengthSq())), q = a.clone().addScaledVector(ab, t), d = q.distanceTo(c);
      if (d < bd) { bd = d; best = { axisVec: ab.normalize(), origin: q }; }
    }
    if (best) return best;
    const g = mesh.geometry; if (g && !g.boundingBox) g.computeBoundingBox(); return { axisVec: new V3(0, 1, 0), origin: g && g.boundingBox ? g.boundingBox.getCenter(new V3()) : new V3(0, 0, 0) };   /* a plain object has no bones: 360 turns round its own upright through its middle */
  }
  const sideOf = (mesh, c) => (c.x * segmentsOf(mesh).leftX >= 0 ? 'left' : 'right');
  return { keysOf, ensureKey, nextKeyName, segmentsOf, limbAxis, sideOf };
}
