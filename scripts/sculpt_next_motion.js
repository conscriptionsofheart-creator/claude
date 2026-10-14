/* sculpt_next_motion.js: sculpted shapes that MOVE, for the BSA's purpose (human emotion in motion; Ruth 2026-10-13: "not just being able to sculpt but add textures, skins, shaders, micro-expressions,
   and animations, all of these need to feel seamless"). Every sculpt stroke on a figure already lands in a named shape key; here a key becomes an expression you can play:
     PULSE: the key rises and falls once, smoothly (a raised cosine: no snap, no flicker), like a micro-expression: a quick brow lift is about 0.3 s, a slow smile 1.5 s. Never shorter than 0.2 s and never
            more than one rise a second when repeating (Ruth's rule: no flashing animations).
     RECORD: every key's strength is written down each frame while you play pulses or move the Keys sliders; Stop turns it into an animation clip on the figure (three's AnimationClip, morph tracks), which the
            .glb save carries, so the Atelier and the BSA can play it like any other animation.
   makeMotion(THREE, env): env = { targets() (meshes with keys), say, onChange(mesh) (the engine refreshes its posed copy and the skin-shader shells) }. tick(dt) runs every frame. */
export function makeMotion(THREE, env) {
  const say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } };
  const pulses = [];   /* { mesh, k, name, t, dur, peak, base, repeat, gap } */
  let rec = null;      /* { t, frames: Map(mesh -> { names: [], times: [], values: [[]...] }) } */
  const ease = u => (u <= 0 || u >= 1 ? 0 : 0.5 - 0.5 * Math.cos(u * Math.PI * 2));   /* 0 -> 1 -> 0 over u in 0..1, smooth at both ends */
  function meshesWith(name) { return env.targets().filter(m => m.morphTargetDictionary && m.morphTargetDictionary[name] !== undefined); }
  /* play key `name` once (or `repeat` times): seconds dur, peak strength 0..1 */
  function pulse(name, opts) {
    opts = opts || {}; const dur = Math.max(0.2, opts.dur || 0.6), peak = Math.max(0, Math.min(1, opts.peak == null ? 1 : opts.peak)), repeat = Math.max(1, Math.min(20, opts.repeat || 1)), gap = Math.max(1 - dur, opts.gap || 0.3);
    const ms = meshesWith(name); if (!ms.length) { say('There is no shape key called "' + name + '".'); return 0; }
    ms.forEach(m => { const k = m.morphTargetDictionary[name]; for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].mesh === m && pulses[i].k === k) { m.morphTargetInfluences[k] = pulses[i].base; pulses.splice(i, 1); } pulses.push({ mesh: m, k, name, t: 0, dur, peak, base: m.morphTargetInfluences[k] || 0, repeat, gap }); });
    return ms.length;
  }
  function stopAll() { pulses.forEach(p => { p.mesh.morphTargetInfluences[p.k] = p.base; env.onChange && env.onChange(p.mesh); }); pulses.length = 0; }
  function tick(dt) {
    if (pulses.length) {
      const touched = new Set();
      for (let i = pulses.length - 1; i >= 0; i--) { const p = pulses[i]; p.t += dt; const cycle = p.dur + p.gap, n = Math.floor(p.t / cycle), u = (p.t - n * cycle) / p.dur;
        if (n >= p.repeat) { p.mesh.morphTargetInfluences[p.k] = p.base; pulses.splice(i, 1); touched.add(p.mesh); continue; }
        p.mesh.morphTargetInfluences[p.k] = p.base + (p.peak - p.base) * ease(Math.min(1, u)); touched.add(p.mesh); }
      touched.forEach(m => env.onChange && env.onChange(m, true));
    }
    if (rec) { rec.t += dt; if (rec.t - rec.last >= 1 / 30) { rec.last = rec.t; sample(); } }
  }
  function sample() { env.targets().forEach(m => { const d = m.morphTargetDictionary; if (!d || !Object.keys(d).length) return; let f = rec.frames.get(m); if (!f) { f = { names: Object.keys(d).sort((a, b) => d[a] - d[b]), times: [], values: [] }; rec.frames.set(m, f); } f.times.push(rec.t); f.values.push(f.names.map(n => m.morphTargetInfluences[d[n]] || 0)); }); }
  function record() { rec = { t: 0, last: -1, frames: new Map() }; sample(); say('Recording the face: play expressions or move the keys, then Stop.'); }
  /* Stop: one clip per recording, on the figure root, with a track per key that moved */
  function stop(root, name) {
    if (!rec) return null; sample(); const r = rec; rec = null; const tracks = [];
    r.frames.forEach((f, m) => { f.names.forEach((n, j) => { const vals = f.values.map(v => v[j]); if (Math.max(...vals) - Math.min(...vals) < 1e-4) return; tracks.push(new THREE.NumberKeyframeTrack((m.name || m.uuid) + '.morphTargetInfluences[' + n + ']', f.times.slice(), vals)); }); });
    if (!tracks.length) { say('Nothing moved while recording, so no animation was made.'); return null; }
    const clip = new THREE.AnimationClip(name || ('Expression ' + ((root && root.animations ? root.animations.length : 0) + 1)), r.t, tracks);
    if (root) { root.animations = root.animations || []; root.animations.push(clip); }
    say('"' + clip.name + '" is an animation now (' + clip.duration.toFixed(1) + ' s, ' + tracks.length + ' key' + (tracks.length === 1 ? '' : 's') + '). Save figure keeps it in the .glb.'); return clip;
  }
  /* play a recorded clip once, through three's own mixer (the same way the Atelier plays animations) */
  let mixer = null, mixRoot = null;
  function play(root, clip) { if (!root || !clip) return false; if (!mixer || mixRoot !== root) { mixer = new THREE.AnimationMixer(root); mixRoot = root; } mixer.stopAllAction(); const a = mixer.clipAction(clip); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.reset().play(); return true; }
  function mix(dt) { if (mixer) mixer.update(dt); }
  /* SPIN (a turntable): an object turns slowly round its own upright, live, and gets a looping clip that the .glb carries. Comfort: never faster than one turn in 4 s, it starts and stops gently. */
  const spins = new Map();   /* object -> { T (s a turn), base (quaternion at the start), a (angle), k (0..1 ease in or out) } */
  function spin(obj, T) { if (!obj) return; T = Math.max(4, T || 10); let sp = spins.get(obj); if (!sp) { sp = { base: obj.quaternion.clone(), a: 0, k: 0, T, stopping: false }; spins.set(obj, sp); } sp.T = T; sp.stopping = false; obj.animations = (obj.animations || []).filter(c => c.name !== 'Spin').concat([spinClip(obj, T, sp.base)]); }
  function stopSpin(obj) { const sp = spins.get(obj); if (sp) sp.stopping = true; if (obj) obj.animations = (obj.animations || []).filter(c => c.name !== 'Spin'); }
  function spinClip(obj, T, base) { const times = [], vals = [], q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0); for (let i = 0; i <= 8; i++) { times.push(T * i / 8); q.copy(base || obj.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(ax, Math.PI * 2 * i / 8)); vals.push(q.x, q.y, q.z, q.w); } return new THREE.AnimationClip('Spin', T, [new THREE.QuaternionKeyframeTrack(obj.name + '.quaternion', times, vals)]); }
  function spinTick(dt) { spins.forEach((sp, obj) => { sp.k = Math.max(0, Math.min(1, sp.k + (sp.stopping ? -dt : dt) / 1.2)); sp.a += dt * sp.k * Math.PI * 2 / sp.T; obj.quaternion.copy(sp.base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.a)); obj.updateMatrixWorld(true); if (sp.stopping && sp.k <= 0) spins.delete(obj); }); }
  /* a save or an export writes the object as it rests, not caught mid-turn */
  function atRest(fn) { const was = []; spins.forEach((sp, obj) => { was.push([obj, obj.quaternion.clone()]); obj.quaternion.copy(sp.base); obj.updateMatrixWorld(true); }); const back = () => was.forEach(([o, q]) => { o.quaternion.copy(q); o.updateMatrixWorld(true); }); let r; try { r = fn(); } catch (e) { back(); throw e; } if (r && r.then) return r.then(v => { back(); return v; }, e => { back(); throw e; }); back(); return r; }
  return { pulse, stopAll, spin, stopSpin, spinning: obj => spins.has(obj) && !spins.get(obj).stopping, atRest, tick: dt => { tick(dt); mix(dt); spinTick(dt); }, record, stop, play, get recording() { return !!rec; }, get playing() { return pulses.length > 0; } };
}
