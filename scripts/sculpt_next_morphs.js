/* sculpt_next_morphs.js: faces with more than 8 shape keys at once, in the Atelier's three.js (The Living Face, chapter 11).
   Three.js before release 133 draws at most 8 morph targets (shape keys) at once on a mesh, 4 when its material morphs normals too, and silently drops the weakest
   (the Atelier runs release 128). A face recipe with left and right halves often has 12 or more keys active: sadness alone is 1, 4, 15, 17 and 41 on both sides.
   keepAllKeys(THREE, root) gives every mesh under root a render-time combiner: when more keys are active than the renderer can draw, it adds them all up on the CPU
   into ONE offset and draws that, for that render only. Nothing is changed for good: the keys, their weights, the rest shape, the skeleton and the skin weights stay
   exactly as they are (between renders everything reads as before, and a .glb saves the real keys). The sum is redone only when a weight changes (about 1.3 ms for
   10,000 points and 12 keys in the headless test, less on a face's few thousand points), and shows one frame later. On release 133 and later it does nothing (three.js has no limit there). */
const NO_LIMIT = 133;

/* how many shape keys this three.js draws at once with this material (Infinity: no limit) */
export function morphLimit(THREE, material) {
  const r = parseInt(THREE.REVISION, 10);
  if (!(r < NO_LIMIT)) return Infinity;
  return material && material.morphNormals ? 4 : 8;
}

/* give every mesh with shape keys under root the combiner; returns how many meshes have it (already fitted ones count too) */
export function keepAllKeys(THREE, root) {
  let n = 0; if (!root) return 0;
  if (!(parseInt(THREE.REVISION, 10) < NO_LIMIT)) return 0;   /* nothing to fix on this three.js */
  root.traverse(o => { if (o.isMesh && fit(THREE, o)) n++; });
  return n;
}

function fit(THREE, mesh) {
  if (mesh.userData && mesh.userData.sculptAllKeys) return true;
  const g = mesh.geometry; if (!g || !g.morphAttributes || !(g.morphAttributes.position || []).length) return false;
  /* Two combined keys, written in turn. Three.js uploads a geometry's buffers while it lists the scene, BEFORE any object's onBeforeRender, so a sum made in
     onBeforeRender reaches the graphics card on the next frame. Drawing the one made last frame while writing the other keeps every frame whole (one frame,
     14 ms at 72 fps, behind), and a face is never drawn from a buffer that has not arrived: that frame draws three.js's usual 8 keys instead of a jump to rest. */
  const S = { sig: null, geo: null, buf: [], made: [-1, -1], shown: -1, frame: -1, swap: null, tmp: null, uses: 0 };
  const before = mesh.onBeforeRender, after = mesh.onAfterRender;
  function restore() { const w = S.swap; if (!w) return; S.swap = null; mesh.morphTargetInfluences = w.inf; w.P[0] = w.p0; if (w.N) w.N[0] = w.n0; }
  function make(geo, normals) {   /* kept under the geometry's own morph name 'sculptAllKeys': three.js uploads every morph list, the glTF exporters skip all but position and normal */
    const count = geo.attributes.position.count, one = () => { const a = new THREE.BufferAttribute(new Float32Array(count * 3), 3); a.name = 'sculptAllKeys'; return a; };
    S.buf = [0, 1].map(() => ({ pos: one(), nrm: normals ? one() : null })); S.made = [-1, -1]; S.shown = -1; S.sig = null; S.geo = geo;
    geo.morphAttributes.sculptAllKeys = S.buf.flatMap(b => (b.nrm ? [b.pos, b.nrm] : [b.pos]));
  }
  mesh.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
    if (before) before.apply(this, arguments);
    restore();   /* a render that threw before onAfterRender must not leave the swap in place */
    const inf = mesh.morphTargetInfluences, geo = geometry || mesh.geometry, P = geo.morphAttributes && geo.morphAttributes.position;
    if (!inf || !P || !P.length) return;
    let live = 0; for (let i = 0; i < inf.length && i < P.length; i++) if (inf[i]) live++;
    if (live <= morphLimit(THREE, material)) { S.made[0] = S.made[1] = -1; S.sig = null; return; }   /* three.js draws these itself; a later sum starts fresh, never from an old face */
    const N = material && material.morphNormals && geo.morphAttributes.normal && geo.morphAttributes.normal.length ? geo.morphAttributes.normal : null;
    if (S.geo !== geo || !S.buf.length || S.buf[0].pos.count !== geo.attributes.position.count || !!S.buf[0].nrm !== !!N) make(geo, !!N);
    const frame = renderer && renderer.info && renderer.info.render ? renderer.info.render.frame : S.frame + 1;
    if (S.frame !== frame) {   /* once a frame (each eye and each shadow pass reuses it): a weight changed -> add the keys up into the buffer not on show */
      S.frame = frame;
      if (!S.sig || S.sig.length !== inf.length || inf.some((v, i) => v !== S.sig[i])) {
        const w = S.shown === 0 ? 1 : 0, b = S.buf[w];
        sum(b.pos.array, geo.attributes.position.array, P, inf, geo.morphTargetsRelative); b.pos.needsUpdate = true;
        if (N) { sum(b.nrm.array, geo.attributes.normal.array, N, inf, geo.morphTargetsRelative); b.nrm.needsUpdate = true; }
        S.made[w] = frame; S.sig = Float32Array.from(inf); S.uses++;
      }
      let best = -1; [0, 1].forEach(k => { if (S.made[k] >= 0 && S.made[k] < frame && (best < 0 || S.made[k] > S.made[best])) best = k; }); S.shown = best;
    }
    if (S.shown < 0) return;   /* nothing has reached the graphics card yet: three.js's 8 keys for this one frame */
    const b = S.buf[S.shown];
    if (!S.tmp || S.tmp.length !== inf.length) S.tmp = new Array(inf.length).fill(0);
    S.tmp.fill(0); S.tmp[0] = 1;   /* same length as the real list: three.js keeps a list per geometry and must see the same count */
    S.swap = { inf, P, p0: P[0], N, n0: N ? N[0] : null };
    mesh.morphTargetInfluences = S.tmp; P[0] = b.pos; if (N) N[0] = b.nrm;
  };
  mesh.onAfterRender = function () { restore(); if (after) after.apply(this, arguments); };
  mesh.userData.sculptAllKeys = { get sums() { return S.uses; }, get showing() { return S.shown >= 0; } };
  return true;
}

/* out = the weighted sum of every key, as an offset (relative keys) or as a whole shape (absolute keys, which three.js then draws with the base at weight 0) */
function sum(out, base, keys, inf, relative) {
  if (relative) out.fill(0); else out.set(base);
  for (let k = 0; k < inf.length && k < keys.length; k++) {
    const w = inf[k]; if (!w) continue; const d = keys[k].array, n = Math.min(out.length, d.length);
    if (relative) for (let i = 0; i < n; i++) out[i] += w * d[i];
    else for (let i = 0; i < n; i++) out[i] += w * (d[i] - base[i]);
  }
}
