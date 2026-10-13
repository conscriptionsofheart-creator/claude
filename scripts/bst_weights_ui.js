/* bst_weights_ui.js: the Paint skin tool on the desktop page (Ruth, 2026-10-10: the bones come in with the figures and she can add bones; painting is how she says what each bone moves).
   Pick a bone (Bones view, click a dot), press Paint skin, and drag on the figure: Add gives the skin under the brush to that bone, Remove takes it away (to the bone's parent if it
   held the skin alone), Smooth evens it out. The view turns to Weights while you paint: blue where the bone owns none of the skin, green half, red all. One stroke is one undo step.
   The maths is bst_weights.js. The point under the cursor comes from the sculpt tool's pick(), which finds it on the posed figure and maps it back to rest space. */
import * as THREE from 'three';
import { makeWeights } from '/pe_lib/bst_weights.js';

export function initPaint({ ws, scene, camera, cv, sculpt, say, setView, getView }) {
  const W = makeWeights(THREE, sculpt.S), $ = id => document.getElementById(id), V3 = THREE.Vector3;
  const cfg = { on: false, mode: 'add', size: 6, strength: 50 };
  let bone = null, prevView = 'shaded', stroke = null, lastPt = null, raf = 0;
  const ringGeo = (() => { const p = []; for (let i = 0; i <= 48; i++) p.push(new V3(Math.cos(i / 48 * Math.PI * 2), Math.sin(i / 48 * Math.PI * 2), 0)); return new THREE.BufferGeometry().setFromPoints(p); })();
  const ring = new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: 0xffd9a8, depthTest: false, transparent: true, opacity: 0.9 })); ring.renderOrder = 12; ring.visible = false; ring.frustumCulled = false; scene.add(ring);

  const meshesOf = () => { const out = []; ws.objects.forEach(o => { if (!o.root.visible) return; o.root.traverse(x => { if (x.isSkinnedMesh && x.skeleton && x.visible) out.push(x); }); }); return out; };
  const indexIn = (mesh, b) => (b && mesh.skeleton) ? mesh.skeleton.bones.indexOf(b) : -1;
  function recolour() { const b = cfg.on ? bone : ws.bone; meshesOf().forEach(m => { if (m.geometry.userData.weightColours || getView() === 'weights') W.colourise(m, indexIn(m, b)); }); }
  const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; recolour(); }); };

  function begin(e) {
    if (!cfg.on || e.button !== 0 || e.altKey) return;
    const h = sculpt.pick(e); if (!h || !h.mesh.isSkinnedMesh) return;
    const bi = indexIn(h.mesh, bone); if (bi < 0) { say('This part of the figure does not have that bone.'); return; }
    e.stopImmediatePropagation(); e.preventDefault(); cv.setPointerCapture(e.pointerId);
    stroke = { mesh: h.mesh, bi, st: sculpt.stateOf(h.mesh), rec: new Map(), owner: ws.objects.find(o => { let n = h.mesh; while (n) { if (n === o.root) return true; n = n.parent; } return false; }) };
    lastPt = null; dab(h);
  }
  const scaleOf = m => { m.updateMatrixWorld(true); return m.matrixWorld.getMaxScaleOnAxis() || 1; };
  function dab(h) {
    const s = stroke, r = cfg.size / 100 / scaleOf(s.mesh); if (lastPt && lastPt.distanceTo(h.c) < r * 0.3) return; lastPt = h.c.clone();
    const pa = bone.parent && bone.parent.isBone ? indexIn(s.mesh, bone.parent) : -1;
    W.dab(s.st, s.mesh, s.bi, h.c, { mode: cfg.mode, radius: r, strength: cfg.strength / 100, parentIdx: pa }, s.rec); later();
  }
  function move(e) {
    const h = cfg.on ? sculpt.pick(e) : null;
    if (!h) { if (!stroke) ring.visible = false; return; }
    ring.position.copy(h.world); ring.scale.setScalar(cfg.size / 100); ring.quaternion.setFromUnitVectors(new V3(0, 0, 1), h.wn); ring.visible = true;
    if (stroke && h.mesh === stroke.mesh) dab(h);
  }
  function end(e) {
    if (!stroke) return; const s = stroke; stroke = null;
    try { cv.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ }
    if (!s.rec.size) return;
    let m = s.rec; const flip = () => { m = W.swap(s.mesh, m); recolour(); };
    if (s.owner) s.owner.dirty = true;
    ws.record('paint skin', flip, flip);
    say(`${cfg.mode[0].toUpperCase() + cfg.mode.slice(1)} skin: ${s.rec.size.toLocaleString('en-US')} points changed for "${bone.name}". Undo takes the whole stroke back.`);
    recolour(); draw();
  }

  function setOn(on) {
    if (on === cfg.on) return;
    if (on) {
      if (!ws.bone) { say('Pick a bone first: turn on the Bones view and click a bone dot.'); draw(); return; }
      if (sculpt.cfg.on) sculpt.setOn(false);
      bone = ws.bone; cfg.on = true; ws.setSculpt(true); prevView = getView() === 'weights' ? 'shaded' : getView(); setView('weights'); cv.style.cursor = 'crosshair';
      say(`Painting the skin for "${bone.name}". Drag on the figure. Red is where it owns the skin, blue where it owns none. Alt-drag turns the view.`);
    } else {
      cfg.on = false; ring.visible = false; cv.style.cursor = ''; if (!sculpt.cfg.on) ws.setSculpt(false); setView(prevView);
    }
    draw();
  }
  function draw() {
    const seg = (id, val) => document.querySelectorAll('#' + id + ' button').forEach(b => { const on = b.dataset.v === String(val); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    seg('pnBrush', cfg.mode);
    $('pnOn').textContent = cfg.on ? 'Stop painting' : 'Paint skin'; $('pnOn').classList.toggle('on', cfg.on); $('pnOn').setAttribute('aria-pressed', String(cfg.on));
    $('pnSizeV').textContent = cfg.size + ' cm'; $('pnStrV').textContent = cfg.strength + '%';
    $('pnBone').textContent = cfg.on ? `Painting: ${bone.name}` : ws.bone ? `Ready to paint: ${ws.bone.name}` : 'Pick a bone first (Bones view, click a dot).';
  }
  function wire() {
    $('pnOn').onclick = () => setOn(!cfg.on);
    $('pnBrush').onclick = e => { const b = e.target.closest('button'); if (b) { cfg.mode = b.dataset.v; draw(); } };
    $('pnSize').oninput = e => { cfg.size = +e.target.value; draw(); }; $('pnStr').oninput = e => { cfg.strength = +e.target.value; draw(); };
    cv.addEventListener('pointerdown', begin, true); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { if (!stroke) ring.visible = false; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && cfg.on && !document.getElementById('atDlgBack')) setOn(false); });
  }
  wire(); draw();
  return { cfg, setOn, draw, recolour, W, prepareMesh: m => W.colourise(m, indexIn(m, cfg.on ? bone : ws.bone)), clearMesh: m => W.clearColours(m) };
}
