/* bst_stage.js: the BST workspace (phase 1). Several objects on one stage: select (click, Shift-click to add or remove, Esc clears), Move / Turn / Size handles
   (three's TransformControls 0.186.1), Duplicate, Duplicate as one object (bst_merge.js), Hide, Delete with Recently deleted, Undo and Redo.
   Words and behaviour follow the Atelier's (kit_select.js, kit_trash.js, the one Duplicate and one Delete); the Atelier's own code is tied to couple3d and r128, so this is a separate file.
   An object is {id, name, root, origin, bytes, sources, tris, dirty}; sources is the list of licence sources it was made from (the most restrictive one speaks for the asset),
   bytes is the original .glb while the object is unmodified. Nothing here flashes or animates; the only motion is the orbit camera easing. */
import * as THREE from 'three';
import { TransformControls } from '/pe_lib/bst_three_transformcontrols_0.186.1.js';
import { clone as skClone } from '/pe_lib/bst_three_skeletonutils_0.186.1.js';
import { mergeToOne } from '/pe_lib/bst_merge.js';
import { mergeKeepBones, hasBones } from '/pe_lib/bst_rig.js';

const ORANGE = 0xe8a866;
const triCount = root => { let t = 0; root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return Math.round(t); };
const unionSources = (...lists) => { const out = [], seen = new Set(); lists.flat().forEach(s => { if (!s) return; const k = (s.name || '') + '|' + (s.source || ''); if (!seen.has(k)) { seen.add(k); out.push(Object.assign({}, s)); } }); return out; };

export function createStage({ scene, camera, dom, orbit, onChange, say, withShaded, pickBone }) {
  const shaded = fn => (withShaded ? withShaded(fn) : fn());   /* copies and merges are taken from the real materials, never the Clay or Wireframe look */
  const holder = new THREE.Group(); holder.name = 'stage'; scene.add(holder);
  const pivot = new THREE.Group(); pivot.name = 'pivot'; scene.add(pivot);
  const tc = new TransformControls(camera, dom); tc.setSize(0.8); const tcHelper = tc.getHelper(); scene.add(tcHelper);
  const outlines = new Map();   /* object id -> Box3Helper */
  const st = { objects: [], selected: new Set(), trash: [], mode: 'translate', undoStack: [], redoStack: [], holder, nid: 1 };
  const say_ = t => { try { say && say(t); } catch (e) { /* the page's own status line may not exist */ } };
  const changed = k => { refreshOutlines(); try { onChange && onChange(k); } catch (e) { console.error(e); } };
  const byId = id => st.objects.find(o => o.id === id);
  const selObjs = () => st.objects.filter(o => st.selected.has(o.id));

  /* ---------- undo and redo: every change is a pair of functions ---------- */
  function record(label, doFn, undoFn) { st.undoStack.push({ label, doFn, undoFn }); if (st.undoStack.length > 200) st.undoStack.shift(); st.redoStack.length = 0; changed('sculpt'); }   /* a step that was already done (a sculpt stroke) */
  function setSculpt(on) { st.sculptOn = !!on; attachHandles(); changed('mode'); }
  function run(label, doFn, undoFn) { doFn(); st.undoStack.push({ label, doFn, undoFn }); if (st.undoStack.length > 200) st.undoStack.shift(); st.redoStack.length = 0; changed('run'); }
  const holdBone = keep => { if (keep && keep.parent) { tc.detach(); st.bone = keep; tc.attach(keep); tc.setMode('rotate'); tc.setSpace('local'); tcHelper.visible = true; } };   /* a pose step keeps its bone chosen */
  function undo() { const c = st.undoStack.pop(); if (!c) return false; const keep = st.bone; c.undoFn(); st.redoStack.push(c); prune(); holdBone(keep); say_('Undid: ' + c.label); changed('undo'); return true; }
  function redo() { const c = st.redoStack.pop(); if (!c) return false; const keep = st.bone; c.doFn(); st.undoStack.push(c); prune(); holdBone(keep); say_('Redid: ' + c.label); changed('redo'); return true; }
  const prune = () => { [...st.selected].forEach(id => { if (!byId(id)) st.selected.delete(id); }); attachHandles(); };

  /* ---------- objects ---------- */
  const ownerOf = bone => { let n = bone; while (n) { const o = st.objects.find(x => x.root === n); if (o) return o; n = n.parent; } return null; };
  const bonesOf = o => { const b = []; o.root.traverse(x => { if (x.isBone) b.push(x); }); return b; };
  const snap = o => bonesOf(o).map(b => [b, b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  function insert(o, at) { if (!st.objects.includes(o)) { if (at != null && at >= 0 && at <= st.objects.length) st.objects.splice(at, 0, o); else st.objects.push(o); } if (o.root.parent !== holder) holder.add(o.root); if (!o.rest) o.rest = snap(o); }   /* the pose it arrived in, for Reset pose */
  function detach(o) { const i = st.objects.indexOf(o); if (i >= 0) st.objects.splice(i, 1); if (o.root.parent) o.root.removeFromParent(); st.selected.delete(o.id); }
  function add(root, meta) {
    meta = meta || {};
    const o = { id: 'o' + (st.nid++), name: meta.name || 'Object', root, origin: meta.origin || '', bytes: meta.bytes || null, sources: meta.sources || [], tris: triCount(root), dirty: !!meta.dirty, saved: !!meta.saved };
    run('add ' + o.name, () => { insert(o); st.selected = new Set([o.id]); attachHandles(); }, () => { detach(o); attachHandles(); });
    return o;
  }
  function remove(ids) {
    const list = ids.map(byId).filter(Boolean); if (!list.length) return;
    const was = new Set(st.selected), idxs = list.map(o => st.objects.indexOf(o));
    run('delete ' + (list.length === 1 ? list[0].name : list.length + ' objects'), () => { list.forEach(o => { const i = st.objects.indexOf(o); detach(o); st.trash.unshift({ o, at: Date.now(), idx: i }); }); st.trash.length = Math.min(st.trash.length, 30); st.selected = new Set(); attachHandles(); },
      () => { list.forEach((o, k) => { insert(o, idxs[k]); st.trash = st.trash.filter(t => t.o !== o); }); st.selected = was; attachHandles(); });
  }
  function bringBack(id) {
    const t = st.trash.find(x => x.o.id === id); if (!t) return; const o = t.o;
    run('bring back ' + o.name, () => { insert(o, t.idx); st.trash = st.trash.filter(x => x.o !== o); st.selected = new Set([o.id]); attachHandles(); }, () => { const i = st.objects.indexOf(o); detach(o); st.trash.unshift({ o, at: Date.now(), idx: i }); attachHandles(); });
  }
  function rename(id, name) { const o = byId(id); name = String(name || '').trim().slice(0, 60); if (!o || !name || name === o.name) return; const old = o.name; run('rename', () => { o.name = name; }, () => { o.name = old; }); }
  function setVisible(ids, on) {
    const list = ids.map(byId).filter(Boolean); if (!list.length) return; const prev = list.map(o => o.root.visible);
    run(on ? 'show' : 'hide', () => { list.forEach(o => { o.root.visible = on; }); attachHandles(); }, () => { list.forEach((o, i) => { o.root.visible = prev[i]; }); attachHandles(); });
  }
  function cloneRoot(o) {
    const c = skClone(o.root); c.traverse(m => { if (m.isMesh && m.geometry) m.geometry = m.geometry.clone(); });   /* own geometry (so a later cut cannot touch the original), same materials (same skins) */
    return c;
  }
  function offsetFor(root) { const b = new THREE.Box3().setFromObject(root), s = b.getSize(new THREE.Vector3()); return Math.max(0.05, s.x) + Math.max(0.1, s.x * 0.1); }   /* a copy stands just beside the original, not on it */
  function duplicate(ids) {
    const src = ids.map(byId).filter(Boolean); if (!src.length) return [];
    const made = shaded(() => src.map(o => { const root = cloneRoot(o); root.position.x += offsetFor(o.root); root.updateMatrixWorld(true); return { id: 'o' + (st.nid++), name: o.name.replace(/ copy( \d+)?$/, '') + ' copy', root, origin: o.origin, bytes: null, sources: unionSources(o.sources), priv: !!o.priv, tris: o.tris, dirty: true, saved: false }; }));
    const was = new Set(st.selected);
    run('duplicate', () => { made.forEach(o => insert(o)); st.selected = new Set(made.map(o => o.id)); attachHandles(); }, () => { made.forEach(o => detach(o)); st.selected = was; attachHandles(); });
    return made;
  }
  const base0 = src => src.length === 1 ? src[0].name.replace(/ \(one object\)$/, '') + ' (one object)' : 'Merged (' + src.length + ' objects)';
  function duplicateAsOne(ids, opts) {   /* opts.flatten: the old one-mesh copy with no bones; otherwise a figure keeps all its bones */
    const src = ids.map(byId).filter(Boolean); if (!src.length) return null;
    const rigged = !(opts && opts.flatten) && src.some(o => hasBones(o.root));
    const temp = new THREE.Group(); const merged = shaded(() => { src.forEach(o => { if (o.root.visible) { const c = cloneRoot(o); c.applyMatrix4(holder.matrixWorld); temp.add(c); } }); return rigged ? mergeKeepBones(temp, base0(src)) : mergeToOne(temp, base0(src)); });
    const base = base0(src); const { mesh, report } = merged;
    if (!mesh) { say_((report.warnings || [])[0] || 'Nothing to merge.'); return { report }; }
    let root; if (rigged && merged.root) root = merged.root; else { root = new THREE.Group(); root.add(mesh); } root.name = base;
    { const sb = new THREE.Box3(); src.forEach(x => sb.expandByObject(x.root)); if (!sb.isEmpty()) { const w = sb.max.x - sb.min.x; root.position.x += w + Math.max(0.1, w * 0.1); root.updateMatrixWorld(true); } }   /* the merged copy stands beside its parts, not on them */
    const o = { id: 'o' + (st.nid++), name: base, root, origin: 'made from ' + src.map(s => s.name).join(', '), bytes: null, sources: unionSources(...src.map(s => s.sources)), priv: src.some(s => s.priv), tris: report.tris, dirty: true, saved: false };
    const was = new Set(st.selected);
    run('duplicate as one object', () => { insert(o); st.selected = new Set([o.id]); attachHandles(); }, () => { detach(o); st.selected = was; attachHandles(); });
    say_((rigged ? `${report.parts} part${report.parts === 1 ? '' : 's'} are now 1 mesh on one skeleton (${report.bones} bones${report.keys ? ', ' + report.keys + ' shape keys' : ''}) with` : `${report.parts} part${report.parts === 1 ? '' : 's'} are now 1 mesh with`) + ` ${report.materials} material${report.materials === 1 ? '' : 's'} and ${report.tris.toLocaleString('en-US')} triangles. The original${src.length === 1 ? ' is' : 's are'} still there.` + (report.warnings.length ? ' ' + report.warnings.join(' ') : ''));
    return { object: o, report };
  }

  /* ---------- selection and handles ---------- */
  function select(ids, additive) {
    const next = additive ? new Set(st.selected) : new Set();
    ids.forEach(id => { if (!byId(id)) return; if (additive && next.has(id)) next.delete(id); else next.add(id); });
    st.selected = next; attachHandles(); changed('select');
  }
  function clearSelection() { if (!st.selected.size) return; st.selected = new Set(); attachHandles(); changed('select'); }
  function attachHandles() {
    st.bone = null;
    const list = selObjs().filter(o => o.root.visible);
    tc.detach(); tcHelper.visible = false;
    if (!list.length) { return; }
    if (list.length === 1) { tc.attach(list[0].root); }
    else { const b = new THREE.Box3(); list.forEach(o => b.expandByObject(o.root)); pivot.position.copy(b.getCenter(new THREE.Vector3())); pivot.quaternion.identity(); pivot.scale.set(1, 1, 1); pivot.updateMatrixWorld(true); tc.attach(pivot); }
    tc.setSpace('world'); tc.setMode(st.mode); tcHelper.visible = !st.sculptOn;
  }
  function selectBone(bone) {   /* a bone picked in the Bones view: the handle turns it. Choosing an object again gives the handles back to the objects. */
    if (!bone) { attachHandles(); changed('bone'); return; }
    tc.detach(); st.bone = bone; tc.attach(bone); tc.setMode('rotate'); tc.setSpace('local'); tcHelper.visible = true; changed('bone');
  }
  function resetPose(ids) {
    const list = ids.map(byId).filter(o => o && o.rest); if (!list.length) return;
    const before = list.map(o => snap(o)), after = list.map(o => o.rest);
    const put = arr => arr.forEach(rows => rows.forEach(([b, p, q, sc]) => { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); b.updateMatrixWorld(true); }));
    run('reset pose', () => put(after), () => put(before));
  }
  function setMode(m) { if (st.bone) { say_('A bone can only be turned. Click an object to move or size it.'); return; } st.mode = m; tc.setMode(m); changed('mode'); }
  function refreshOutlines() {
    outlines.forEach((h, id) => { if (!st.selected.has(id) || !byId(id) || !byId(id).root.visible) { scene.remove(h); h.geometry.dispose(); outlines.delete(id); } });
    selObjs().forEach(o => { if (!o.root.visible || outlines.has(o.id)) return; const h = new THREE.Box3Helper(new THREE.Box3(), ORANGE); scene.add(h); outlines.set(o.id, h); });
    updateOutlines();
  }
  function updateOutlines() { outlines.forEach((h, id) => { const o = byId(id); if (!o) return; const b = new THREE.Box3().setFromObject(o.root); if (!b.isEmpty()) h.box.copy(b); }); }

  /* the handles: one object is moved directly; several ride a pivot and go back to the stage when the drag ends */
  let before = null;
  let boneBefore = null;
  tc.addEventListener('dragging-changed', e => {
    orbit.enabled = !e.value;
    const bn = st.bone;
    if (bn && tc.object === bn) {   /* turning one bone: one undo step, and the object counts as changed (a posed figure no longer matches its original file) */
      if (e.value) boneBefore = bn.quaternion.clone();
      else if (boneBefore && !boneBefore.equals(bn.quaternion)) {
        const a = boneBefore, z = bn.quaternion.clone(), ow = ownerOf(bn); if (ow) ow.dirty = true;
        st.undoStack.push({ label: 'pose ' + bn.name, doFn: () => { bn.quaternion.copy(z); bn.updateMatrixWorld(true); }, undoFn: () => { bn.quaternion.copy(a); bn.updateMatrixWorld(true); } }); st.redoStack.length = 0; boneBefore = null; changed('transform');
      }
      return;
    }
    const list = selObjs();
    if (e.value) {
      before = list.map(o => ({ o, m: o.root.matrix.clone() }));
      if (tc.object === pivot) list.forEach(o => pivot.attach(o.root));
    } else {
      if (tc.object === pivot) { list.forEach(o => holder.attach(o.root)); pivot.updateMatrixWorld(true); const b = new THREE.Box3(); list.forEach(o => b.expandByObject(o.root)); pivot.position.copy(b.getCenter(new THREE.Vector3())); pivot.quaternion.identity(); pivot.scale.set(1, 1, 1); }
      const after = (before || []).map(x => ({ o: x.o, m: x.o.root.matrix.clone() }));
      const moved = after.some((x, i) => !x.m.equals(before[i].m));
      if (moved) {
        const shapeChange = tc.mode !== 'translate';   /* moving is placement on the stage; only turning or sizing changes the asset itself */
        const apply = arr => arr.forEach(x => { x.o.root.matrix.copy(x.m); x.o.root.matrix.decompose(x.o.root.position, x.o.root.quaternion, x.o.root.scale); x.o.root.updateMatrixWorld(true); if (shapeChange) x.o.dirty = true; });
        const b4 = before.slice(); after.forEach(x => { if (shapeChange) x.o.dirty = true; });
        st.undoStack.push({ label: tc.mode === 'translate' ? 'move' : tc.mode === 'rotate' ? 'turn' : 'size', doFn: () => { apply(after); attachHandles(); }, undoFn: () => { apply(b4); attachHandles(); } }); st.redoStack.length = 0;
        changed('transform');
      }
      before = null;
    }
  });
  tc.addEventListener('objectChange', () => { updateOutlines(); });

  /* ---------- picking in the view ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, shift: e.shiftKey, btn: e.button, axis: tc.axis }; });
  dom.addEventListener('pointerup', e => {
    if (!down || down.btn !== 0) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4, d = down; down = null;
    if (moved || tc.dragging || d.axis || st.sculptOn) return;
    if (pickBone && pickBone(e, d.shift)) return;
    const r = dom.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const roots = st.objects.filter(o => o.root.visible).map(o => o.root); const hits = ray.intersectObjects(roots, true).filter(h => h.object.isMesh);
    if (!hits.length) { if (!d.shift) clearSelection(); return; }
    let n = hits[0].object; while (n && !st.objects.some(o => o.root === n)) n = n.parent; const o = n && st.objects.find(x => x.root === n); if (!o) return;
    select([o.id], d.shift);
  });
  document.addEventListener('keydown', e => {
    if (document.getElementById('back')?.style.display === 'flex' || document.getElementById('atDlgBack')) return;
    if (e.defaultPrevented) return;   /* a dialog already used this key (Esc closes it, nothing else) */
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === 'y') { e.preventDefault(); redo(); }
    else if (e.key === 'Escape') { if (st.bone) selectBone(null); else if (!st.sculptOn) clearSelection(); }   /* while sculpting Esc only stops sculpting */
    else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selected.size) { e.preventDefault(); remove([...st.selected]); }
    else if (!mod && k === 'w') setMode('translate'); else if (!mod && k === 'e') setMode('rotate'); else if (!mod && k === 'r') setMode('scale');
  });

  const api = Object.assign(st, { record, setSculpt, selectBone, resetPose, add, remove, bringBack, rename, setVisible, duplicate, duplicateAsOne, select, clearSelection, setMode, undo, redo, selObjs, byId, updateOutlines, tc,
    canUndo: () => st.undoStack.length > 0, canRedo: () => st.redoStack.length > 0, markSaved: o => { o.saved = true; }, triCount });
  return api;
}
