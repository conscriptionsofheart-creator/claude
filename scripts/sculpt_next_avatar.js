/* sculpt_next_avatar.js: the people you sculpt WITH, as human avatars, each in their own look (Ruth 2026-10-14: "two people in the make human avatars with a shader on each creating together").
   Each headset sends where its head and hands are (sculpt_next_collab.js); here that becomes a whole person: the body stands under the head and turns with it, the arms reach to the real hands
   (two-bone reach: shoulder, elbow, wrist), the legs stand on the floor and bend when the head goes lower. Each person chooses how they look to the others: a look (pearl, glow, metal...) and a
   gradient, from the menu; the settings travel with them.
   Two kinds:
     makeAvatar(THREE, opts)   a light built-in figure (head, neck, torso, arms, hands, legs; under 6k triangles, one material), so it works with no files at all
     rigAvatar(THREE, root)    any figure with a skeleton: a MakeHuman export (its "default" or "game engine" skeleton), a Mixamo or Blender-named rig. Its own skin texture is kept; the
                               look and gradient go on top. Bones are found by name (BONES below); only the head and the arm chains are moved, so the skin weights and shape keys are untouched.
   update(pose, dt): pose = { head: { p: Vector3, q: Quaternion }, hands: [{ p, q?, pinch? }], floor (y) }. Motion is smoothed (no jumps, no flicker), and an avatar never moves faster than a person. */
import { makeMaterial, colourAt } from './sculpt_next_looks.js';

export const BONES = {
  head: ['head', 'Head', 'mixamorig:Head', 'mixamorigHead', 'DEF-head', 'head.x'],
  upperL: ['upperarm01.L', 'upperarm_l', 'upper_arm.L', 'mixamorig:LeftArm', 'mixamorigLeftArm', 'LeftArm', 'DEF-upper_arm.L', 'upperarm.L'],
  lowerL: ['lowerarm01.L', 'lowerarm_l', 'forearm.L', 'mixamorig:LeftForeArm', 'mixamorigLeftForeArm', 'LeftForeArm', 'DEF-forearm.L', 'lowerarm.L'],
  handL: ['wrist.L', 'hand_l', 'hand.L', 'mixamorig:LeftHand', 'mixamorigLeftHand', 'LeftHand', 'DEF-hand.L'],
  upperR: ['upperarm01.R', 'upperarm_r', 'upper_arm.R', 'mixamorig:RightArm', 'mixamorigRightArm', 'RightArm', 'DEF-upper_arm.R', 'upperarm.R'],
  lowerR: ['lowerarm01.R', 'lowerarm_r', 'forearm.R', 'mixamorig:RightForeArm', 'mixamorigRightForeArm', 'RightForeArm', 'DEF-forearm.R', 'lowerarm.R'],
  handR: ['wrist.R', 'hand_r', 'hand.R', 'mixamorig:RightHand', 'mixamorigRightHand', 'RightHand', 'DEF-hand.R'],
};
const LIN = (THREE, c) => (parseInt(THREE.REVISION, 10) >= 152 ? c.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))) : c);

/* where an elbow goes: shoulder S, target T, upper length a, lower length b, pole (which way the elbow points) -> elbow point; the target is pulled in when out of reach */
export function reach(THREE, S, T, a, b, pole) {
  const V3 = THREE.Vector3, d0 = T.clone().sub(S), dist = Math.min(Math.max(d0.length(), Math.abs(a - b) + 1e-4), a + b - 1e-4), dir = d0.lengthSq() > 1e-10 ? d0.normalize() : new V3(0, -1, 0);
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA)), perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (perp.lengthSq() < 1e-8) perp.set(0, -1, 0).sub(dir.clone().multiplyScalar(-dir.y)); perp.normalize();
  return { elbow: S.clone().add(dir.clone().multiplyScalar(a * cosA)).add(perp.multiplyScalar(a * sinA)), hand: S.clone().add(dir.multiplyScalar(dist)) };
}
/* the body frame from the head: forward (flat), right, and how low the head is */
function bodyFrame(THREE, head) { const V3 = THREE.Vector3, f = new V3(0, 0, -1).applyQuaternion(head.q); f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, -1); f.normalize(); return { fwd: f, right: new V3(-f.z, 0, f.x), up: new V3(0, 1, 0) }; }
/* which seen hand is the left and which the right: by which side of the body it is on */
function sides(THREE, pose, neck, right) {
  const hs = (pose.hands || []).slice(0, 2), out = { L: null, R: null };
  if (hs.length === 2) { const a = hs[0].p.clone().sub(neck).dot(right), b = hs[1].p.clone().sub(neck).dot(right); if (a >= b) { out.R = hs[0]; out.L = hs[1]; } else { out.R = hs[1]; out.L = hs[0]; } }
  else if (hs.length === 1) { if (hs[0].p.clone().sub(neck).dot(right) >= 0) out.R = hs[0]; else out.L = hs[0]; }
  return out;
}

/* ---------- the built-in figure ---------- */
export function makeAvatar(THREE, opts) {
  opts = opts || {}; const V3 = THREE.Vector3, Q = THREE.Quaternion, root = new THREE.Group(); root.name = 'vrAvatar ' + (opts.name || ''); root.userData.noMerge = true;
  const parts = {}, Y = new V3(0, 1, 0);
  const paint = (geo, t0, t1) => { const P = geo.attributes.position; geo.computeBoundingBox(); const bb = geo.boundingBox, c = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { const u = (P.getY(i) - bb.min.y) / ((bb.max.y - bb.min.y) || 1); c.set([t0 + (t1 - t0) * u, 0, 0], i * 3); } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.userData.tRange = true; return geo; };
  const limb = (r0, r1, t0, t1) => { const g = new THREE.CylinderGeometry(r1, r0, 1, 14, 4, false); g.translate(0, 0.5, 0); return paint(g, t0, t1); };
  const lathe = (pts, t0, t1, sz) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24); g.scale(1, 1, sz || 1); return paint(g, t0, t1); };
  const mat = makeMaterial(THREE, opts.look || 'pearl', { vertexColors: true });
  const add = (name, geo) => { const m = new THREE.Mesh(geo, mat); m.name = 'vrAvatar_' + name; m.frustumCulled = false; root.add(m); parts[name] = m; return m; };
  add('torso', lathe([[0, -0.04], [0.11, -0.03], [0.155, 0.03], [0.16, 0.1], [0.135, 0.22], [0.15, 0.33], [0.175, 0.43], [0.19, 0.5], [0.16, 0.55], [0.07, 0.58], [0, 0.59]], 0.45, 0.82, 0.6));
  /* round joints so limbs meet smoothly: shoulders, elbows, wrists, hips, knees */
  const ball = (name, rr, t) => add(name, paint(new THREE.SphereGeometry(rr, 14, 10), t, t + 0.01));
  ['L', 'R'].forEach(s => { ball('shoulder' + s, 0.052, 0.78); ball('elbow' + s, 0.04, 0.62); ball('wrist' + s, 0.031, 0.55); ball('hipj' + s, 0.074, 0.44); ball('knee' + s, 0.054, 0.22); });
  add('neck', limb(0.045, 0.04, 0.82, 0.86)); add('head', paint(new THREE.SphereGeometry(0.095, 24, 18).scale(0.88, 1.12, 0.98), 0.86, 1));
  ['L', 'R'].forEach(s => { add('upper' + s, limb(0.05, 0.04, 0.62, 0.78)); add('lower' + s, limb(0.037, 0.028, 0.55, 0.62)); add('hand' + s, paint(new THREE.SphereGeometry(1, 12, 8).scale(0.042, 0.075, 0.02).translate(0, 0.06, 0), 0.5, 0.55));
    add('thigh' + s, limb(0.075, 0.052, 0.22, 0.45)); add('shin' + s, limb(0.05, 0.036, 0.04, 0.22)); add('foot' + s, paint(new THREE.BoxGeometry(0.09, 0.06, 0.24).translate(0, 0.03, -0.06), 0, 0.04)); });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1622 }); [-1, 1].forEach(k => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), eyeMat); e.name = 'vrAvatar_eye'; e.position.set(k * 0.032, 0.015, -0.085); parts.head.add(e); });
  /* colours: each part's 0..1 place along the body, read through the person's gradient (feet -> head) */
  function setLook(look, stops) {
    const m = makeMaterial(THREE, look || 'pearl', { vertexColors: true }); Object.values(parts).forEach(p => { p.material = m; }); if (stops) recolour(stops);
  }
  function recolour(stops) {
    Object.values(parts).forEach(p => { const C = p.geometry.attributes.color; if (!C) return; if (!p.geometry.userData.t) p.geometry.userData.t = Float32Array.from({ length: C.count }, (_, i) => C.getX(i)); const T = p.geometry.userData.t; for (let i = 0; i < C.count; i++) { const c = LIN(THREE, colourAt(stops, T[i])); C.setXYZ(i, c[0], c[1], c[2]); } C.needsUpdate = true; });
  }
  if (opts.stops) recolour(opts.stops);
  const seg = (m, A, B) => { const d = B.clone().sub(A), L = Math.max(1e-4, d.length()); m.position.copy(A); m.quaternion.setFromUnitVectors(Y, d.divideScalar(L)); m.scale.set(1, L, 1); };
  const S = { head: null, hands: { L: null, R: null } };
  function update(pose, dt) {
    if (!pose || !pose.head) return; const k = 1 - Math.exp(-(dt || 0.016) * 14), floor = pose.floor || 0;
    if (!S.head) S.head = { p: pose.head.p.clone(), q: pose.head.q.clone() }; S.head.p.lerp(pose.head.p, k); S.head.q.slerp(pose.head.q, k);
    const H = S.head, F = bodyFrame(THREE, H), neck = H.p.clone().add(new V3(0, -0.14, 0)).add(F.fwd.clone().multiplyScalar(0.03)), hips = neck.clone().add(new V3(0, -0.56, 0)).add(F.fwd.clone().multiplyScalar(0.03));
    const yawQ = new Q().setFromUnitVectors(new V3(0, 0, -1), F.fwd);
    parts.head.position.copy(H.p); parts.head.quaternion.copy(H.q); seg(parts.neck, neck, H.p.clone().add(new V3(0, -0.06, 0)));
    parts.torso.position.copy(hips); parts.torso.quaternion.copy(yawQ); parts.torso.scale.set(1, Math.max(0.6, (neck.y - hips.y + 0.01) / 0.58), 1);
    const sd = sides(THREE, pose, neck, F.right);
    ['L', 'R'].forEach(s => {
      const sign = s === 'R' ? 1 : -1, sh = neck.clone().add(F.right.clone().multiplyScalar(0.17 * sign)).add(new V3(0, -0.04, 0)), seen = sd[s];
      const want = seen ? seen.p.clone() : sh.clone().add(new V3(0, -0.52, 0)).add(F.fwd.clone().multiplyScalar(0.06)).add(F.right.clone().multiplyScalar(0.04 * sign));
      if (!S.hands[s]) S.hands[s] = want.clone(); S.hands[s].lerp(want, seen ? Math.min(1, k * 1.6) : k * 0.5);
      const pole = new V3(0, -1, 0).add(F.fwd.clone().multiplyScalar(-0.35)).add(F.right.clone().multiplyScalar(0.55 * sign)), r = reach(THREE, sh, S.hands[s], 0.29, 0.27, pole);
      seg(parts['upper' + s], sh, r.elbow); seg(parts['lower' + s], r.elbow, r.hand); parts['shoulder' + s].position.copy(sh); parts['elbow' + s].position.copy(r.elbow); parts['wrist' + s].position.copy(r.hand); parts['hand' + s].position.copy(r.hand); parts['hand' + s].quaternion.setFromUnitVectors(Y, r.hand.clone().sub(r.elbow).normalize());
      const hip = hips.clone().add(F.right.clone().multiplyScalar(0.09 * sign)).add(new V3(0, 0.04, 0)), foot = new V3(hip.x, floor + 0.06, hip.z).add(F.fwd.clone().multiplyScalar(0.02)), lr = reach(THREE, hip, foot, 0.44, 0.43, F.fwd.clone().add(new V3(0, 0.2, 0)));
      seg(parts['thigh' + s], hip, lr.elbow); seg(parts['shin' + s], lr.elbow, lr.hand); parts['hipj' + s].position.copy(hip); parts['knee' + s].position.copy(lr.elbow); parts['foot' + s].position.set(lr.hand.x, floor, lr.hand.z); parts['foot' + s].quaternion.copy(yawQ);
    });
    root.updateMatrixWorld(true);
  }
  return { root, update, setLook, recolour, parts, kind: 'built-in', tris: () => { let n = 0; root.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; } };
}

/* ---------- a figure with its own skeleton (a MakeHuman export, Mixamo, a Blender rig) ---------- */
export function rigAvatar(THREE, figure, opts) {
  opts = opts || {}; const V3 = THREE.Vector3, Q = THREE.Quaternion, root = new THREE.Group(); root.name = 'vrAvatar ' + (opts.name || ''); root.userData.noMerge = true; root.add(figure);
  const bones = {}, all = []; figure.traverse(o => { if (o.isBone) all.push(o); });
  Object.keys(BONES).forEach(k => { for (const n of BONES[k]) { const b = all.find(x => x.name === n); if (b) { bones[k] = b; break; } } });
  const ok = !!(bones.head && bones.upperL && bones.lowerL && bones.handL && bones.upperR && bones.lowerR && bones.handR);
  figure.updateMatrixWorld(true);
  const wp = o => new V3().setFromMatrixPosition(o.matrixWorld), wq = o => o.getWorldQuaternion(new Q());
  /* rest measures: head height above the feet, arm lengths, and the head's turn at rest (so the person's head turn is applied on top of it) */
  const box = new THREE.Box3().setFromObject(figure), restHead = bones.head ? wp(bones.head) : new V3(0, box.max.y - 0.1, 0), restHeight = Math.max(0.5, restHead.y - box.min.y), headRest = bones.head ? wq(bones.head) : new Q();
  const lens = s => [wp(bones['upper' + s]).distanceTo(wp(bones['lower' + s])), wp(bones['lower' + s]).distanceTo(wp(bones['hand' + s]))];
  const L = ok ? { L: lens('L'), R: lens('R') } : null, floorOff = box.min.y;
  const meshes = []; figure.traverse(o => { if (o.isMesh) { o.frustumCulled = false; meshes.push(o); } });
  function setLook(look, stops) {
    meshes.forEach(m => { const olds = [].concat(m.material), neu = olds.map(o => makeMaterial(THREE, look || 'satin', o)); m.material = Array.isArray(m.material) ? neu : neu[0]; });
    if (stops) recolour(stops);
  }
  function recolour(stops) {   /* the gradient feet -> head over the figure's own skin (its texture stays underneath) */
    meshes.forEach(m => { const P = m.geometry.attributes.position, n = P.count, c = new Float32Array(n * 3), v = new V3(); for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); const t = (v.y - box.min.y) / ((box.max.y - box.min.y) || 1), cc = LIN(THREE, colourAt(stops, t)); c.set(cc, i * 3); }
      m.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); [].concat(m.material).forEach(x => { x.vertexColors = true; x.needsUpdate = true; }); });
  }
  const turnTo = (bone, from, to) => {   /* turn a bone (in the world) so the direction from -> its child point becomes from -> to */
    const a = from.clone(), d0 = bone.userData._child.clone().sub(a).normalize(), d1 = to.clone().sub(a).normalize(); if (d0.lengthSq() < 1e-8 || d1.lengthSq() < 1e-8) return;
    const dq = new Q().setFromUnitVectors(d0, d1), w = dq.multiply(wq(bone)), pq = bone.parent ? wq(bone.parent) : new Q(); bone.quaternion.copy(pq.invert().multiply(w)); bone.updateMatrixWorld(true);
  };
  const S = { head: null, hands: { L: null, R: null } };
  function update(pose, dt) {
    if (!pose || !pose.head) return; const k = 1 - Math.exp(-(dt || 0.016) * 14), floor = pose.floor || 0;
    if (!S.head) S.head = { p: pose.head.p.clone(), q: pose.head.q.clone() }; S.head.p.lerp(pose.head.p, k); S.head.q.slerp(pose.head.q, k);
    const H = S.head, F = bodyFrame(THREE, H), sc = Math.max(0.5, Math.min(1.4, (H.p.y - floor) / restHeight));   /* the figure is sized so its head is where the person's head is */
    root.scale.setScalar(sc); root.quaternion.setFromUnitVectors(new V3(0, 0, 1), F.fwd); const off = restHead.clone().setY(0).applyQuaternion(root.quaternion).multiplyScalar(sc);
    root.position.set(H.p.x - off.x, floor - floorOff * sc, H.p.z - off.z); root.updateMatrixWorld(true);
    if (!ok) return;
    /* the head: the person's head turn, taken relative to their body's facing, put on top of the figure's own head at rest (figures face +z, a headset looks down -z) */
    const headBone = bones.head, yawCam = new Q().setFromUnitVectors(new V3(0, 0, -1), F.fwd), rel = yawCam.clone().invert().multiply(H.q), R180 = new Q().setFromAxisAngle(new V3(0, 1, 0), Math.PI);
    const relFig = R180.clone().multiply(rel).multiply(R180.clone().invert()), desired = root.quaternion.clone().multiply(relFig).multiply(headRest), pq = headBone.parent ? wq(headBone.parent) : new Q();
    headBone.quaternion.copy(pq.invert().multiply(desired)); headBone.updateMatrixWorld(true);
    const neck = wp(headBone), sd = sides(THREE, pose, neck, F.right);
    ['L', 'R'].forEach(s => {
      const up = bones['upper' + s], lo = bones['lower' + s], hd = bones['hand' + s], sh = wp(up), sign = s === 'R' ? 1 : -1, seen = sd[s];
      const want = seen ? seen.p.clone() : sh.clone().add(new V3(0, -(L[s][0] + L[s][1]) * sc * 0.95, 0)).add(F.fwd.clone().multiplyScalar(0.05));
      if (!S.hands[s]) S.hands[s] = want.clone(); S.hands[s].lerp(want, seen ? Math.min(1, k * 1.6) : k * 0.5);
      const pole = new V3(0, -1, 0).add(F.fwd.clone().multiplyScalar(-0.35)).add(F.right.clone().multiplyScalar(0.55 * sign)), r = reach(THREE, sh, S.hands[s], L[s][0] * sc, L[s][1] * sc, pole);
      up.userData._child = wp(lo); turnTo(up, sh, r.elbow); lo.userData._child = wp(hd); turnTo(lo, wp(lo), r.hand);
    });
    root.updateMatrixWorld(true);
  }
  return { root, update, setLook, recolour, kind: ok ? 'rigged' : 'unrigged', bones, ok, wrist: s => (bones['hand' + s] ? wp(bones['hand' + s]) : null) };
}
