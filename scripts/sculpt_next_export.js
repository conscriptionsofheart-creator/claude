/* sculpt_next_export.js: getting the work out (Ruth 2026-10-13). Save puts a .glb in the library from inside the headset, as the current engine does; clay is baked to one plain mesh per layer with
   its colours as vertex colours. A triangle BUDGET thins the COPY that is saved, never the work in the room (her rule: budgets check delivery copies, they never cap the master), and never a person:
   skinned pieces (figures, clothes on figures) keep every triangle (people keep their full design; only props may be thinned).
   Decimate: sculpt_next_decimate.js (quadric error edge collapse), run in the worker when there is one.
   Export: three r128 (the Atelier, GLTFExporter as a global script) and r186 (BST, the module). */
import { decimateArrays } from './sculpt_next_decimate.js';
export function makeExport(THREE, env) {
  const V3 = THREE.Vector3, M4 = THREE.Matrix4, say = t => { try { env.say && env.say(t); } catch (e) { /* optional */ } }, rev = parseInt(THREE.REVISION, 10) || 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), triCount = g => (g.index ? g.index.count : g.attributes.position.count) / 3;

  /* ---------- decimate (the maths is in sculpt_next_decimate.js, so the worker can run it too) ---------- */
  const arraysOf = geo => { const g = geo.index ? geo : geo, P = g.attributes.position, C = g.attributes.color, U = g.attributes.uv, f32 = (a, sz) => { if (!a) return undefined; const o = new Float32Array(a.count * sz); for (let i = 0; i < a.count; i++) for (let k = 0; k < sz; k++) o[i * sz + k] = sz === 2 ? (k ? a.getY(i) : a.getX(i)) : (k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : a.getZ(i)); return o; };
    return { position: f32(P, 3), index: g.index ? Uint32Array.from(g.index.array) : null, color: f32(C, 3), uv: f32(U, 2) }; };
  const geometryOf = r => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(r.position, 3)); if (r.color) g.setAttribute('color', new THREE.BufferAttribute(r.color, 3)); if (r.uv) g.setAttribute('uv', new THREE.BufferAttribute(r.uv, 2)); g.setIndex(new THREE.BufferAttribute(r.position.length / 3 > 65535 ? r.index : Uint16Array.from(r.index), 1)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g; };
  function decimate(geo, target) { const t0 = now(), triN = triCount(geo); if (triN <= target) return { geometry: geo, before: triN, after: triN, ms: 0 }; const r = decimateArrays(arraysOf(geo), target); return { geometry: geometryOf(r), before: r.before, after: r.after, ms: now() - t0 }; }
  /* the same, in the worker when there is one (the headset keeps its frame rate while a copy is thinned) */
  async function decimateAsync(geo, target) {
    const t0 = now(), triN = triCount(geo); if (triN <= target) return { geometry: geo, before: triN, after: triN, ms: 0 };
    const pr = env.clay && env.clay.work ? env.clay.work('decimate', { src: arraysOf(geo), target }) : null, job = pr ? await pr.catch(() => null) : null;   /* no worker: done here */
    if (!job) return decimate(geo, target); return { geometry: geometryOf(job), before: job.before, after: job.after, ms: now() - t0, worker: true };
  }

  /* ---------- what goes into the file ---------- */
  const isClay = o => !!(o && o.userData && o.userData.clayWork);
    /* a copy of the roots for the file: clay baked, objects laid out round their own middle, and thinned to the budget if one is set (never a skinned piece) */
  async function prepare(roots, opts) {
    opts = opts || {}; const grp = new THREE.Group(); grp.name = opts.name || 'Sculpted object'; const box = new THREE.Box3();
    roots.forEach(r => { r.updateMatrixWorld(true); box.expandByObject(r); }); const pv = box.isEmpty() ? new V3() : box.getCenter(new V3()), back = new M4().makeTranslation(-pv.x, -pv.y, -pv.z);
    const inPlace = [];   /* anything with a skeleton is written as it stands: cloning a skinned figure leaves its bones behind and the file would point at bones it does not hold */
    roots.forEach(r => {
      let skin = false; r.traverse(o => { if (o.isSkinnedMesh) skin = true; }); if (skin) { inPlace.push(r); return; }
      let c; if (isClay(r)) { const w = env.clay.works.find(x => x.group === r); c = w ? env.clay.bakedClone(w) : null; } else c = r.clone(true);
      if (!c) return; const M = new M4().multiplyMatrices(back, r.matrixWorld); c.matrix.copy(M); c.matrix.decompose(c.position, c.quaternion, c.scale); c.updateMatrix(); grp.add(c);
    });
    grp.updateMatrixWorld(true); grp.animations = roots.reduce((a, r) => (isClay(r) || !r.isSkinnedMesh) ? a.concat(r.animations || []) : a, []).filter(c => inPlace.every(r => !(r.animations || []).includes(c)));   /* a work's Spin travels with its copy */
    let thinned = 0, people = 0;
    if (opts.budget > 0) {
      const plain = [], all = []; grp.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) { all.push(o); if (o.isSkinnedMesh) people++; else plain.push(o); } });
      let held = 0; inPlace.forEach(r => r.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) { held += triCount(o.geometry); people++; } }));   /* a figure keeps every triangle, its static parts too */
      const fixed = held + all.filter(o => o.isSkinnedMesh).reduce((a, o) => a + triCount(o.geometry), 0), free = plain.reduce((a, o) => a + triCount(o.geometry), 0), room = Math.max(0, opts.budget - fixed);
      if (free > room && free > 0) { const k = room / free; for (const o of plain) { const want = Math.max(12, Math.floor(triCount(o.geometry) * k)); const r = await decimateAsync(o.geometry, want); if (r.after < r.before) { o.geometry = r.geometry; thinned += r.before - r.after; } } }
      if (fixed > opts.budget) say('The budget is ' + opts.budget.toLocaleString('en-US') + ' triangles but the people in it have ' + fixed.toLocaleString('en-US') + ': people keep every triangle, so the copy is over budget.');
    }
    let tris = 0; [grp].concat(inPlace).forEach(r => r.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) tris += triCount(o.geometry); }));
    return { root: inPlace.length ? (grp.children.length ? [grp].concat(inPlace) : inPlace.length === 1 ? inPlace[0] : inPlace) : grp, tris, thinned, people };   /* the exporter takes one object or a list */
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
    const E = await exporter(), ex = new E(), anims = [].concat(root).reduce((a, r) => a.concat((r && r.animations) || []), []), o = { binary: true, embedImages: true, onlyVisible: true };
    if (anims.length) o.animations = anims;   /* expression moves recorded on the figure travel in the file */
    return new Promise((ok, no) => { try { if (rev >= 132) ex.parse(root, ok, no, o); else ex.parse(root, ok, o); } catch (e) { no(e); } });
  }
  /* the glb of some roots (clay works, objects), with the budget applied to the copy */
  async function glb(roots, opts) { const p = await prepare(roots, opts || {}); const buf = await toGlb(p.root); return { buffer: buf, tris: p.tris, thinned: p.thinned }; }
  /* Save to the library, as the current engine does: the figure itself (people are never thinned, so no budget), or objects / clay laid out round their own middle */
  async function save(name, opts) {
    opts = opts || {}; const exp = opts.exportGlb || null; let target, info = { tris: 0, thinned: 0 };
    if (opts.roots && opts.roots.length) { const roots = opts.roots.filter(r => r && r.parent); if (!roots.length) throw new Error('Nothing to save.'); const p = await prepare(roots, { budget: opts.budget, name }); target = p.root; info = p; }
    else if (opts.figure) target = opts.figure; else throw new Error('Nothing to save.');
    const buf = exp ? await exp(target) : await toGlb(target), nm = (name || (opts.roots ? 'Sculpted object' : 'Sculpted figure')).trim(), id = nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sculpt', proj = opts.proj || 'studio';
    const mine = { name: 'Own work', source: 'Sculpted by hand in the headset', restricted: false }, inh = (opts.sources && opts.sources()) || [];
    const card = { name: nm, proj, budget: opts.budget ? { id: 'own', label: 'Own number', limit: opts.budget } : { id: 'none', label: 'No budget picked', limit: 0 }, licence: mine, sources: inh.concat([mine]) };
    const fd = new FormData(); fd.append('glb', new Blob([buf], { type: 'model/gltf-binary' }), id + '.glb'); fd.append('card', JSON.stringify(card));
    const r = await fetch('/pe_assets/item/' + id + '?proj=' + proj, { method: 'POST', body: fd }), j = await r.json().catch(() => ({ ok: false, why: 'The library did not answer.' }));
    if (!j.ok) throw new Error(j.why || 'The library said no.');
    say('Saved "' + nm + '" to the library' + (info.tris ? ' (' + info.tris.toLocaleString('en-US') + ' triangles' + (info.thinned ? ', ' + info.thinned.toLocaleString('en-US') + ' thinned from the copy; the work in the room keeps all of them' : '') + ')' : '') + '.'); return Object.assign({ bytes: buf.byteLength, tris: info.tris, thinned: info.thinned }, j);
  }
  return { decimate, decimateAsync, prepare, glb, toGlb, save };
}
