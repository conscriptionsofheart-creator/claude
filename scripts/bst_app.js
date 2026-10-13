/* BST phase 1: the workspace (several objects, select, handles, undo, Duplicate, Duplicate as one object), the triangle meter, and Send to library. Own three.js (r186, vendored); the Atelier's shapes come from lib/primitives.js.
   Budgets: VRChat's performance-rank tables read from creators.vrchat.com/avatars/avatar-performance-ranking-system on 2026-10-10
   (Mobile/Quest avatars Excellent 7,500, Good 10,000, Medium 15,000, Poor 20,000; PC Excellent 32,000, Good to Poor 70,000). VRChat gives no prop limit,
   so "Your own number" is yours. "Web prop" is the app's own rule (pe_model_upload's badge: green up to 100k, amber up to 250k, red above).
   The meter sentence copies the Atelier's flow budget line (particle_flow_ui.js): "In all: N ... fits / too many".
   Nothing here pulses, blinks or animates in brightness. window.BST holds the state for tests. */
import * as THREE from 'three';
import { OrbitControls } from '/pe_lib/bst_three_orbitcontrols_0.186.1.js';
import { GLTFLoader } from '/pe_lib/bst_three_gltfloader_0.186.1.js';
import { GLTFExporter } from '/pe_lib/bst_three_gltfexporter_0.186.1.js';
import { createStage } from '/pe_lib/bst_stage.js';
import { initSculpt } from '/pe_lib/bst_sculpt_ui.js';
import { initPaint } from '/pe_lib/bst_weights_ui.js';
import { rigInfo, rigLine, hasBones, boneLabel } from '/pe_lib/bst_rig.js';
import { addBoneTo, defaultOffset } from '/pe_lib/bst_addbone.js';

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- budgets ---------- */
const VRC = 'VRChat performance ranks, read from creators.vrchat.com/avatars/avatar-performance-ranking-system/ on 2026-10-10';
const BUDGETS = [
  { id: 'vrc_mobile_good', label: 'VRChat Quest avatar, Good', limit: 10000, tip: VRC + '. Mobile table: Excellent 7,500, Good 10,000, Medium 15,000, Poor 20,000.' },
  { id: 'vrc_mobile_excellent', label: 'VRChat Quest avatar, Excellent', limit: 7500, tip: VRC + '.' },
  { id: 'vrc_mobile_medium', label: 'VRChat Quest avatar, Medium', limit: 15000, tip: VRC + '.' },
  { id: 'vrc_mobile_poor', label: 'VRChat Quest avatar, Poor', limit: 20000, tip: VRC + '.' },
  { id: 'vrc_pc_excellent', label: 'VRChat PC avatar, Excellent', limit: 32000, tip: VRC + '. PC table: Excellent 32,000, Good to Poor 70,000.' },
  { id: 'vrc_pc_poor', label: 'VRChat PC avatar, Poor', limit: 70000, tip: VRC + '.' },
  { id: 'web_prop', label: 'Web prop', limit: 100000, tip: "The app's own rule for Bring in your own .glb: comfortable up to 100,000 triangles, heavy up to 250,000." },
  { id: 'custom', label: 'Your own number', limit: 2000, tip: 'VRChat gives no limit for props or worlds, so this one is yours to pick.' }
];
const S = { budget: BUDGETS[0], custom: 2000, mode: 'shaded', stats: { tris: 0, verts: 0 }, scope: 'all', count: 0, lib: [], libOk: null, figure: false };
window.BST = S;
const PROJ = new URLSearchParams(location.search).get('project') === 'private' ? 'private' : 'studio';   /* the library is split into studio and private like the scene store; a private page never lists, and never writes to, the studio side */
S.proj = PROJ;

/* ---------- three scene ---------- */
const cv = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x120d1b, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 2000);
camera.position.set(1.6, 1.2, 2.2);
const controls = new OrbitControls(camera, cv);
controls.enableDamping = true; controls.dampingFactor = 0.12;
scene.add(new THREE.HemisphereLight(0xfff1de, 0x3a2b4a, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0xb9a0ff, 0.7); rim.position.set(-4, 2, -3); scene.add(rim);
const grid = new THREE.GridHelper(40, 40, 0x5a4a6a, 0x2a2036); scene.add(grid);   /* fixed 1 m tiles: the grid never rescales to the object */
const figure = new THREE.Group();   /* 1.75 m reference figure: a capsule and a ball, plain grey, never a body from the app */
{ const gm = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 1, metalness: 0 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 1.15, 8, 24), gm); body.position.y = 0.765;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), gm); head.position.y = 1.64; figure.add(body, head); figure.visible = false; figure.name = 'scale figure'; scene.add(figure); }
const ORIG = new WeakMap(), WIRES = new WeakSet();   /* kept out of userData: a clone copies userData and the exporter writes it into the file */

function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
  camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(cv.parentElement); resize();
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

/* ---------- views ---------- */
const VIEWS = [['shaded', 'Shaded'], ['wire', 'Wireframe'], ['clay', 'Clay'], ['weights', 'Weights']];
let paint = null;   /* the Paint skin tool (below); the Weights view asks it for the colours */
const weightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
function overrideFor(mode) {
  if (mode === 'clay') return new THREE.MeshStandardMaterial({ color: 0xcfc4b4, roughness: 1, metalness: 0 });
  if (mode === 'wire') return new THREE.MeshStandardMaterial({ color: 0x2a2036, roughness: 1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  return null;
}
function applyView() {
  const ov = overrideFor(S.mode), heavy = ws.objects.reduce((a, o) => a + o.tris, 0) > 300000;
  ws.objects.forEach(({ root }) => {
    const lines = []; root.traverse(o => { if (WIRES.has(o)) lines.push(o); }); lines.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
    const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
    meshes.forEach(m => {
      if (!ORIG.has(m)) ORIG.set(m, m.material);
      if (S.mode !== 'weights' && paint) paint.clearMesh(m);
      if (S.mode === 'weights') { if (m.isSkinnedMesh && paint) { paint.prepareMesh(m); m.material = weightMat; } else m.material = ORIG.get(m); return; }
      if (S.mode === 'shaded') { m.material = ORIG.get(m); return; }
      if (S.mode === 'wire' && heavy) { m.material = new THREE.MeshBasicMaterial({ color: 0xe8a866, wireframe: true }); return; }
      m.material = ov;
      if (S.mode === 'wire') {
        const w = new THREE.LineSegments(new THREE.WireframeGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xe8a866 }));
        WIRES.add(w); m.add(w);
      }
    });
  });
}
const boneHelpers = new Map();   /* object id -> SkeletonHelper; they live in the scene, not in the object, so they are never exported */
function refreshBones() {
  const want = S.bones ? ws.objects.filter(o => o.root.visible && hasBones(o.root)) : [];
  const nBones = r => { let n = 0; r.traverse(x => { if (x.isBone) n++; }); return n; };
  boneHelpers.forEach((h, id) => { if (!want.some(o => o.id === id && h.userData.root === o.root && h.userData.n === nBones(o.root))) { scene.remove(h, h.userData.dots); h.geometry.dispose(); h.material.dispose(); h.userData.dots.geometry.dispose(); h.userData.dots.material.dispose(); boneHelpers.delete(id); } });
  want.forEach(o => { if (boneHelpers.has(o.id)) return; const h = new THREE.SkeletonHelper(o.root); h.material.vertexColors = false; h.material.depthTest = false; h.material.transparent = true; h.material.color.set(0xe8a866); h.material.needsUpdate = true; h.renderOrder = 10; h.userData.root = o.root; h.userData.n = nBones(o.root);
    const dots = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(h.bones.length * 3), 3)), new THREE.PointsMaterial({ color: 0xffd9a8, size: 6, sizeAttenuation: false, depthTest: false, transparent: true }));
    dots.frustumCulled = false; dots.renderOrder = 11; h.userData.dots = dots;
    const upd = h.updateMatrixWorld.bind(h); h.updateMatrixWorld = function (f) { upd(f); const a = dots.geometry.attributes.position, v = new THREE.Vector3(); h.bones.forEach((b, i) => { b.getWorldPosition(v); a.setXYZ(i, v.x, v.y, v.z); }); a.needsUpdate = true; };
    scene.add(h, dots); boneHelpers.set(o.id, h); });
  const b = document.getElementById('bonesBtn'); if (b) { b.classList.toggle('on', !!S.bones); b.setAttribute('aria-pressed', String(!!S.bones)); }
}
function withShaded(fn) {   /* copies, merges and exports are taken from the real materials, then the chosen look comes back */
  const prev = S.mode; if (prev !== 'shaded') { S.mode = 'shaded'; applyView(); }
  try { return fn(); } finally { if (prev !== 'shaded') { S.mode = prev; applyView(); } }
}
function buildViewButtons() {
  const box = $('views');
  VIEWS.forEach(([id, label], i) => { const b = document.createElement('button'); b.textContent = label; b.dataset.v = id; b.title = 'Hotkey ' + (i + 1); b.onclick = () => setMode(id); box.appendChild(b); });
  const bv = document.createElement('button'); bv.textContent = 'Bones'; bv.id = 'bonesBtn'; bv.title = 'Show every bone as an orange line'; bv.setAttribute('aria-pressed', 'false'); bv.onclick = () => { S.bones = !S.bones; refreshBones(); }; box.appendChild(bv);
  const rv = document.createElement('button'); rv.textContent = 'Reset view'; rv.style.marginLeft = '8px'; rv.onclick = () => frame(ws.selObjs().length ? ws.selObjs() : null); box.appendChild(rv);
  setMode('shaded');
}
function setMode(id) { S.mode = id; document.querySelectorAll('#views button[data-v]').forEach(b => { b.classList.toggle('on', b.dataset.v === id); b.setAttribute('aria-pressed', String(b.dataset.v === id)); }); applyView(); }


/* ---------- measuring ---------- */
function measure(roots) {
  let tris = 0, verts = 0, meshes = 0; const box = new THREE.Box3(), mats = new Set();
  roots.forEach(root => {
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh || WIRES.has(o)) return;
      meshes++; const g = o.geometry, pos = g.attributes.position; if (!pos) return;
      verts += pos.count; tris += (g.index ? g.index.count : pos.count) / 3;
      [].concat(ORIG.get(o) || o.material).forEach(m => mats.add(m));
    });
    box.expandByObject(root);
  });
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  return { tris: Math.round(tris), verts, meshes, materials: mats.size, size: [size.x, size.y, size.z] };
}

const stateColour = (t, lim) => !t ? 'var(--fg)' : t > lim ? 'var(--bad)' : t > lim * .85 ? 'var(--warn)' : 'var(--ok)';
function curBudget() { return S.budget.id === 'custom' ? { ...S.budget, limit: S.custom, label: 'Your own number' } : S.budget; }
function chooseBudget(id) {
  S.budget = BUDGETS.find(b => b.id === id) || S.budget; bm.redraw();
  if (id === 'custom') AtelierDialog.prompt({ title: 'Your own number', body: 'How many triangles is this asset allowed?', value: String(S.custom), ok: 'Set' }).then(v => { const n = Math.round(+String(v || '').replace(/[^0-9.]/g, '')); if (n > 0) S.custom = Math.min(n, 5e6); render(); });
  render();
}
function scopeObjs() {   /* the meter counts the selected objects, or everything visible when nothing is selected */
  const sel = ws.selObjs().filter(o => o.root.visible);
  return sel.length ? { objs: sel, scope: 'selected' } : { objs: ws.objects.filter(o => o.root.visible), scope: 'all' };
}
function sendTarget() { const sel = ws.selObjs(); if (sel.length === 1) return sel[0]; if (!sel.length && ws.objects.length === 1) return ws.objects[0]; return null; }
function render() {
  const { objs, scope } = scopeObjs(), has = objs.length > 0, vis = ws.objects.filter(o => o.root.visible).length;
  S.stats = measure(objs.map(o => o.root)); S.scope = scope; S.count = ws.objects.length;
  const t = S.stats.tris, B = curBudget(); S.limit = B.limit; const col = stateColour(has ? t : 0, B.limit);
  $('hudTris').textContent = fmt(t); $('hudTris').style.color = col; $('cnt').textContent = fmt(t); $('cnt').style.color = col;
  $('hudLab').textContent = !has ? 'triangles' : scope === 'selected' ? `triangles selected (${objs.length} of ${vis})` : `triangles on the stage (${objs.length})`;
  const scale = Math.max(t, B.limit) || 1, bar = $('bar'), tick = $('tick');
  bar.style.width = (has ? t / scale * 100 : 0) + '%'; bar.style.background = col === 'var(--fg)' ? 'var(--ok)' : col;
  tick.hidden = !(has && t > B.limit); tick.style.left = (B.limit / scale * 100) + '%';
  const parts = S.stats.meshes || 0, sorted = BUDGETS.filter(b => b.id !== 'custom').sort((x, y) => x.limit - y.limit), next = sorted.find(b => b.limit >= t);
  const lead = scope === 'selected' ? `Selected (${objs.length} of ${vis} object${vis === 1 ? '' : 's'})` : `In all (${objs.length} object${objs.length === 1 ? '' : 's'}${ws.selected.size ? '; the selection is hidden' : ''})`;
  $('barLab').innerHTML = !has ? (ws.objects.length ? 'Everything on the stage is hidden.' : 'Nothing here yet.') : `${lead}: <b>${fmt(t)}</b> triangles in <b>${parts}</b> part${parts === 1 ? '' : 's'}. ${esc(B.label)} (up to ${fmt(B.limit)} triangles): ${t <= B.limit ? '<b class="pass">fits</b>.' : `<b class="fail">too many</b>, ${fmt(t - B.limit)} over.` + (next ? ` Fits ${esc(next.label)} (up to ${fmt(next.limit)}).` : ' Over every budget listed.')}`;
  const rowsList = sorted.map(b => ({ id: b.id, label: b.label, limit: b.limit })).concat(S.budget.id === 'custom' ? [{ id: 'custom', label: 'Your own number', limit: S.custom }] : []);
  $('ladder').innerHTML = rowsList.map(r => {
    const ok = has && t <= r.limit, mine = r.id === S.budget.id;   /* the highlighted row is the budget you picked; the tick says whether this asset fits that row */
    return `<div class="row pick${mine ? ' cur' : ''}" role="button" tabindex="0" data-id="${r.id}" title="Use this budget"><span>${esc(r.label)}</span><span class="v ${!has ? '' : ok ? 'pass' : 'fail'}">${fmt(r.limit)} ${!has ? '' : ok ? '✓' : '✗'}</span></div>`;
  }).join('');
  $('ladder').querySelectorAll('.row').forEach(el => { el.onclick = () => chooseBudget(el.dataset.id); el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseBudget(el.dataset.id); } }; });
  const st = S.stats, sz = st.size || [0, 0, 0], one = objs.length === 1 ? objs[0] : null;
  $('infoTitle').textContent = one ? 'This object' : has ? `These ${objs.length} objects` : 'This object';
  const rig = one ? rigInfo(one.root) : null, rigText = rig && rig.bones ? rigLine(rig) : '', keyText = rig && rig.keys.length ? rig.keys.length + ' shape key' + (rig.keys.length === 1 ? '' : 's') : '';
  const bn = ws.bone, bnText = bn ? `${boneLabel(bn.name)} (${bn.name}): turned ${[bn.rotation.x, bn.rotation.y, bn.rotation.z].map(r => Math.round(r * 57.2958)).join(', ')} degrees` : '';
  const srcLine = one && one.sources.length ? one.sources.map(s => (s.restricted ? 'restricted: ' : '') + s.name).join('; ') : '';
  $('info').innerHTML = has ? `<span>Name</span><span title="${esc(one ? one.name : '')}">${one ? esc(one.name) : objs.length + ' objects'}</span><span>Triangles</span><span>${fmt(st.tris)}</span><span>Vertices</span><span>${fmt(st.verts)}</span><span>Parts</span><span>${st.meshes} mesh${st.meshes === 1 ? '' : 'es'}, ${st.materials} material${st.materials === 1 ? '' : 's'}</span><span>Size</span><span>${sz.map(v => v.toFixed(2)).join(' × ')} m</span>` + (rigText ? `<span>Bones</span><span title="${esc(rigText)}">${esc(rigText)}</span>` : one ? '<span>Bones</span><span>none (a plain mesh)</span>' : '') + (bnText ? `<span>Bone</span><span title="${esc(bnText)}">${esc(bnText)}</span>` : '') + (keyText ? `<span>Shape keys</span><span title="${esc(rig.keys.join(', '))}">${esc(keyText)}</span>` : '') + (one ? `<span>Came from</span><span title="${esc(one.origin)}">${esc(one.origin)}</span>` : '') + (srcLine ? `<span>Sources</span><span title="${esc(srcLine)}">${esc(srcLine)}</span>` : '') : '<span>Nothing loaded.</span><span></span>';
  const tg = sendTarget();
  $('send').disabled = !tg;
  $('sendNote').textContent = !ws.objects.length ? 'Pick or open something first.' : !tg ? 'Pick one object to send. To send several as one, use Duplicate as one object first.' : tg.tris > B.limit ? 'Over this budget. The library keeps it and marks it over budget.' : 'Saved as a .glb with its card.';
  $('empty').style.display = ws.objects.length ? 'none' : 'flex';
}

/* ---------- the workspace ---------- */
function pickBoneAt(e) {   /* in the Bones view a click near a bone dot picks that bone (14 px), not the object under it */
  if (!S.bones || !boneHelpers.size) return false;
  const r = cv.getBoundingClientRect(), v = new THREE.Vector3(); let best = null, bd = 14;
  boneHelpers.forEach(h => h.bones.forEach(b => { b.getWorldPosition(v); v.project(camera); if (v.z > 1) return; const d = Math.hypot(r.left + (v.x + 1) / 2 * r.width - e.clientX, r.top + (1 - v.y) / 2 * r.height - e.clientY); if (d < bd) { bd = d; best = b; } }));
  if (!best) return false; ws.selectBone(best); return true;
}
const ws = createStage({ scene, camera, dom: cv, orbit: controls, onChange: k => onStageChange(k), say: t => { $('opNote').textContent = t; $('skNote').textContent = t; }, withShaded, pickBone: pickBoneAt });
const sculpt = initSculpt({ ws, scene, camera, cv, controls, say: t => { $('opNote').textContent = t; $('skNote').textContent = t; } });
window.BST.sculpt = sculpt;
paint = initPaint({ ws, scene, camera, cv, sculpt, say: t => { $('opNote').textContent = t; $('skNote').textContent = t; $('bnNote').textContent = t; }, setView: id => setMode(id), getView: () => S.mode });
window.BST.paint = paint;
window.BST.ws = ws;
function onStageChange(k) {
  if (k === 'bone') refreshBones();
  if (k === 'run' || k === 'select' || k === 'transform') { $('opNote').textContent = ''; $('skNote').textContent = ''; }   /* a note belongs to the step that made it */
  if (k === 'run' || k === 'undo' || k === 'redo') applyView();
  refreshFigure(); refreshBones(); render(); renderStage(); updateTools(); sculpt.draw(); if (!$('paneBones').hidden) bonesPanel(); if (paint) { paint.draw(); if (S.mode === 'weights') paint.recolour(); }
}
function frame(list) {
  list = list || ws.objects.filter(o => o.root.visible);
  const b = new THREE.Box3(); list.forEach(o => b.expandByObject(o.root)); if (b.isEmpty()) return;
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = (s.length() / 2) || 1;   /* r: the radius of the sphere around everything, so a narrow window still shows all of it */
  const d = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect) * 1.1;
  controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(.7, .5, 1).normalize().multiplyScalar(d));
  camera.near = Math.max(r / 200, 0.001); camera.far = Math.max(r * 60 + d, 200); camera.updateProjectionMatrix();
}
function refreshFigure() {
  figure.visible = S.figure;
  const vis = ws.objects.filter(o => o.root.visible), b = new THREE.Box3(); vis.forEach(o => b.expandByObject(o.root));
  figure.position.set(b.isEmpty() ? -1.2 : b.min.x - 0.7, 0, 0);
}
function place(root) {   /* a new object stands on the floor and goes beside what is already there */
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root); if (b.isEmpty()) return;
  root.position.y -= b.min.y;
  const others = ws.objects.filter(o => o.root.visible);
  if (others.length) { const ob = new THREE.Box3(); others.forEach(o => ob.expandByObject(o.root)); root.position.x += (ob.max.x + Math.max(0.15, (b.max.x - b.min.x) * 0.1)) - b.min.x; }
  root.updateMatrixWorld(true);
}
function addObject(root, meta) { place(root); const o = ws.add(root, meta); frame(); return o; }

/* ---------- loading and generating ---------- */
const cleanName = f => String(f || '').replace(/\.glb$/i, '').replace(/^_+/, '').replace(/^bak[_-]/i, '').replace(/[_-]?\d{4}-\d{2}-\d{2}/g, '').replace(/[_-]before[_-][a-z0-9_-]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'My asset';
async function loadGlbBuffer(buf, name, origin, saved, sources, priv) {
  if (new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength))) !== 'glTF') throw new Error('it does not start with glTF, so it is not a .glb');
  return new Promise((res, rej) => new GLTFLoader().parse(buf, '', g => {
    const root = g.scene; root.traverse(o => { if (o.isMesh && o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; });
    const o = addObject(root, { name, origin, bytes: buf.slice(0), saved: !!saved, sources: sources || [], priv: !!priv }); res(Object.assign({ id: o.id }, S.stats));
  }, rej));
}
function shapeGeometry(kind) {
  const P = window.Primitives; const tmp = new THREE.Scene();
  P.init({ THREE, scene: tmp, renderer, getBodies: () => [], BodyFX: null });
  const m = P.add({ kind, look: 'solid' }); if (!m || !m._mesh) throw new Error('no shape ' + kind);
  const g = m._mesh.geometry.clone(); P.remove(m.id); return g;
}
function makeShape(kind) {
  const info = window.Primitives.KINDS.find(k => k.id === kind);
  const mesh = new THREE.Mesh(shapeGeometry(kind), new THREE.MeshStandardMaterial({ color: 0xd9a07a, roughness: .75, metalness: 0, side: THREE.DoubleSide }));
  mesh.name = info ? info.name : kind;
  const g = new THREE.Group(); g.name = mesh.name; g.add(mesh); return addObject(g, { name: mesh.name, origin: 'a shape from the Atelier (' + mesh.name + ')' }).root;
}
window.BST.camera = camera; window.BST.chooseBudget = id => chooseBudget(id); window.BST.makeShape = makeShape; window.BST.loadGlbBuffer = loadGlbBuffer;

function buildShapeGrid() {
  const grid = $('shapeGrid'); let last = '';
  window.Primitives.KINDS.forEach(k => {
    if (k.g !== last) { const h = document.createElement('div'); h.className = 'grp'; h.textContent = k.g; grid.appendChild(h); last = k.g; }
    const b = document.createElement('button'); b.textContent = k.name; b.onclick = () => { try { makeShape(k.id); } catch (e) { AtelierDialog.alert({ title: 'That shape would not build', body: String(e.message || e) }); } }; grid.appendChild(b);
  });
}

/* ---------- the On stage list, the toolbar ---------- */
function renderStage() {
  $('tabStage').textContent = 'On stage (' + ws.objects.length + ')';
  const list = $('stageList');
  list.innerHTML = ws.objects.length ? ws.objects.map(o => `<div class="orow${ws.selected.has(o.id) ? ' sel' : ''}${o.root.visible ? '' : ' hid'}" role="option" tabindex="0" aria-selected="${ws.selected.has(o.id)}" data-id="${o.id}" title="Click to select, Shift-click to add or remove, double-click to rename"><span class="nm">${esc(o.name)}</span><span class="n">${o.root.visible ? fmt(o.tris) + ' tri' : 'hidden'}</span></div>`).join('') : '<div class="msg">Nothing on the stage. Pick a shape, open a .glb, or open something from the library.</div>';
  list.querySelectorAll('.orow').forEach(el => {
    el.onclick = e => ws.select([el.dataset.id], e.shiftKey);
    el.ondblclick = () => renameObj(el.dataset.id);
    el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ws.select([el.dataset.id], e.shiftKey); } else if (e.key === 'F2') { e.preventDefault(); renameObj(el.dataset.id); } };
  });
  const sel = ws.selObjs(), n = sel.length, allHidden = n > 0 && sel.every(o => !o.root.visible);
  $('opFlat').hidden = !sel.some(o => hasBones(o.root)); $('opPose').hidden = !sel.some(o => hasBones(o.root));
  $('opDup').disabled = !n; $('opOne').disabled = !n; $('opHide').disabled = !n; $('opDel').disabled = !n; $('opClear').disabled = !n;
  $('opHide').textContent = allHidden ? 'Show' : 'Hide';
  $('trashBox').hidden = !ws.trash.length;
  $('trashList').innerHTML = ws.trash.map(t => `<div class="orow"><span class="nm">${esc(t.o.name)}</span><button data-back="${t.o.id}">Bring back</button></div>`).join('');
  $('trashList').querySelectorAll('button').forEach(b => b.onclick = () => ws.bringBack(b.dataset.back));
}
async function renameObj(id) {
  const o = ws.byId(id); if (!o) return;
  const v = await AtelierDialog.prompt({ title: 'Rename', body: 'What should this object be called?', value: o.name, ok: 'Rename' });
  if (v != null) ws.rename(id, v);
}
function updateTools() {
  $('tMove').classList.toggle('on', ws.mode === 'translate'); $('tTurn').classList.toggle('on', ws.mode === 'rotate'); $('tSize').classList.toggle('on', ws.mode === 'scale');
  $('tMove').setAttribute('aria-pressed', String(ws.mode === 'translate')); $('tTurn').setAttribute('aria-pressed', String(ws.mode === 'rotate')); $('tSize').setAttribute('aria-pressed', String(ws.mode === 'scale'));
  $('tUndo').disabled = !ws.canUndo(); $('tRedo').disabled = !ws.canRedo();
  $('tFig').classList.toggle('on', S.figure); $('tFig').setAttribute('aria-pressed', String(S.figure));
}
function wireTools() {
  $('tMove').onclick = () => ws.setMode('translate'); $('tTurn').onclick = () => ws.setMode('rotate'); $('tSize').onclick = () => ws.setMode('scale');
  $('tUndo').onclick = () => ws.undo(); $('tRedo').onclick = () => ws.redo();
  $('tFig').onclick = () => { S.figure = !S.figure; refreshFigure(); updateTools(); };
  $('opDup').onclick = () => { $('opNote').textContent = ''; ws.duplicate([...ws.selected]); };
  $('opOne').onclick = () => { $('opNote').textContent = ''; ws.duplicateAsOne([...ws.selected]); };
  $('opPose').onclick = () => ws.resetPose([...ws.selected]);
  $('opFlat').onclick = () => { $('opNote').textContent = ''; ws.duplicateAsOne([...ws.selected], { flatten: true }); };
  $('opHide').onclick = () => { const sel = ws.selObjs(); ws.setVisible(sel.map(o => o.id), sel.every(o => !o.root.visible)); };
  $('opDel').onclick = () => ws.remove([...ws.selected]);
  $('opClear').onclick = () => ws.clearSelection();
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (document.getElementById('atDlgBack') || $('back').style.display === 'flex') return;
    const i = ['1', '2', '3', '4'].indexOf(e.key); if (i >= 0) setMode(VIEWS[i][0]);
  });
}


/* ---------- menus (no native select) ---------- */
function makeMenu(host, items, getVal, onPick) {
  host.innerHTML = '<button type="button" class="menu-btn" aria-haspopup="listbox"></button><div class="menu-list" role="listbox" hidden></div>';
  const btn = host.firstChild, list = host.lastChild; let hot = 0;
  const cur = () => items.find(i => i.id === getVal()) || items[0];
  const draw = () => { btn.textContent = cur().label; btn.title = cur().tip || ''; list.innerHTML = items.map((i, n) => `<div role="option" id="${host.id || 'm'}-o${n}" aria-selected="${i.id === cur().id}" data-id="${i.id}"${i.tip ? ` title="${esc(i.tip)}"` : ''} class="${i.id === cur().id ? 'sel' : ''}${n === hot ? ' hot' : ''}">${esc(i.label)}${i.note ? `<span class="note">${esc(i.note)}</span>` : ''}</div>`).join(''); };
  const open = () => { hot = Math.max(0, items.findIndex(i => i.id === cur().id)); draw(); list.hidden = false; btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-activedescendant', (host.id || 'm') + '-o' + hot); };
  const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const pick = id => { close(); onPick(id); draw(); btn.focus(); };
  btn.setAttribute('aria-expanded', 'false'); btn.onclick = () => list.hidden ? open() : close();
  list.onclick = e => { const d = e.target.closest('[data-id]'); if (d) pick(d.dataset.id); };
  host.addEventListener('keydown', e => {
    if (list.hidden) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } return; }
    if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowDown') { e.preventDefault(); hot = Math.min(items.length - 1, hot + 1); draw(); btn.setAttribute('aria-activedescendant', (host.id || 'm') + '-o' + hot); } else if (e.key === 'ArrowUp') { e.preventDefault(); hot = Math.max(0, hot - 1); draw(); btn.setAttribute('aria-activedescendant', (host.id || 'm') + '-o' + hot); } else if (e.key === 'Enter') { e.preventDefault(); pick(items[hot].id); }
  });
  document.addEventListener('mousedown', e => { if (!host.contains(e.target)) close(); });
  draw(); return { redraw: draw };
}

/* ---------- library ---------- */
async function refreshLib() {
  const box = $('libList');
  try {
    const r = await fetch('/pe_assets/index?proj=' + PROJ, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status); const j = await r.json(); S.lib = j.items || []; S.libOk = true;
  } catch (e) { S.libOk = false; S.lib = []; box.innerHTML = '<div class="msg">The library is not connected. Saving is off.</div>'; return; }
  if (!S.lib.length) { box.innerHTML = '<div class="msg">Nothing saved yet.</div>'; return; }
  box.innerHTML = S.lib.map(c => `<div class="card" role="button" tabindex="0" data-id="${esc(c.id)}" aria-label="Add ${esc(c.name)} to the stage">${c.thumb ? `<img src="${esc(c.thumb)}" alt="">` : '<div class="noimg"></div>'}<div class="body"><div class="t" title="${esc(c.name)}">${esc(c.name)}</div><div class="m">${fmt(c.tris)} triangles${c.overBudget ? ' · over budget' : ''}</div><span class="tag${c.tag === 'publish_ok' ? '' : ' r'}">${c.tag === 'publish_ok' ? 'publish ok' : 'not for sale or reuse'}</span><div class="act"><button data-open="${esc(c.id)}">Add to stage</button><button data-del="${esc(c.id)}" title="Move to the trash">Remove</button></div></div></div>`).join('');
  box.querySelectorAll('.card').forEach(el => el.onkeydown = ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === el) { ev.preventDefault(); el.click(); } });
  box.querySelectorAll('.card').forEach(el => el.onclick = async ev => {
    const id = el.dataset.id;
    if (ev.target.dataset.del) {
      ev.stopPropagation();
      if (await AtelierDialog.confirm({ title: 'Remove from the library?', body: 'It moves to the trash. Nothing is erased.', ok: 'Remove', cancel: 'Keep' })) { await fetch('/pe_assets/delete/' + id + '?proj=' + PROJ, { method: 'POST' }); refreshLib(); }
      return;
    }
    const buf = await (await fetch('/pe_assets/item/' + id + '?proj=' + PROJ, { cache: 'no-store' })).arrayBuffer(); const c = S.lib.find(x => x.id === id);
    const sources = c ? (Array.isArray(c.sources) && c.sources.length ? c.sources : c.licence ? [c.licence] : []) : [];
    try { await loadGlbBuffer(buf, c ? c.name : id, 'the library', true, sources, c && c.proj === 'private'); } catch (x) { AtelierDialog.alert({ title: 'That asset would not open', body: String(x && x.message || x) }); }
  });
}


/* ---------- Send to library ---------- */
const LICENCES = [
  { id: 'own', label: 'Made by me, no outside source', restricted: false, name: 'Made by me, no outside source' },
  { id: 'cc0', label: 'CC0 or public domain', restricted: false, name: 'CC0 / public domain' },
  { id: 'ccby', label: 'CC BY (credit the maker)', restricted: false, name: 'CC BY' },
  { id: 'free', label: 'Another free licence (say which)', restricted: false, name: 'Other free licence' },
  { id: 'restricted', label: 'Restricted (NC, ND or research only)', restricted: true, name: 'Restricted source' }
];
const COPIES = [['pc', 'PC (same detail as the master)', 70000], ['quest', 'Quest (same detail as the master)', 20000], ['web', 'Web (same detail as the master)', 100000]];
const slug = s => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)) || 'asset';
function thumb(o) {   /* the one object from a fixed three-quarter view, nothing else on the stage, no handles */
  const hidden = [];
  const hide = (obj, v) => { hidden.push([obj, obj.visible]); obj.visible = v; };
  ws.objects.forEach(x => hide(x.root, x === o));
  [grid, figure, ws.tc.getHelper(), ...scene.children.filter(c => c.isBox3Helper || c.isSkeletonHelper || c.isPoints)].forEach(x => hide(x, false));
  const b = new THREE.Box3().setFromObject(o.root), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y, s.z) || 1;
  const cam = camera.clone(); cam.near = Math.max(r / 200, 0.001); cam.far = Math.max(r * 60, 200);
  cam.position.copy(c).add(new THREE.Vector3(.7, .5, 1).normalize().multiplyScalar(r / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.5)); cam.lookAt(c); cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 160; const x = cvs.getContext('2d');
  const w = cv.width, h = cv.height, sq = Math.min(w, h); x.drawImage(cv, (w - sq) / 2, (h - sq) / 2, sq, sq, 0, 0, 160, 160);
  hidden.reverse().forEach(([obj, v]) => { obj.visible = v; });
  const u = cvs.toDataURL('image/webp', 0.8); return u.startsWith('data:image/webp') ? u : null;
}
function exportGlb(o) {   /* the real objects, with their own materials and no wireframe lines; placed at the origin so the file carries no stage offset */
  return new Promise((res, rej) => {
    const prev = S.mode; S.mode = 'shaded'; applyView();
    const root = o.root, pos = root.position.clone(), vis = root.visible; root.position.set(0, 0, 0); root.visible = true; root.updateMatrixWorld(true);
    const back = () => { root.position.copy(pos); root.visible = vis; root.updateMatrixWorld(true); S.mode = prev; applyView(); };
    new GLTFExporter().parse(root, r => { back(); res(r); }, e => { back(); rej(e); }, { binary: true });
  });
}
const mergeSources = (...lists) => { const out = [], seen = new Set(); lists.flat().forEach(s => { if (!s) return; const k = (s.name || '') + '|' + (s.source || ''); if (!seen.has(k)) { seen.add(k); out.push(Object.assign({}, s)); } }); return out; };
async function sendToLibrary() {
  const o = sendTarget();
  if (!o) { AtelierDialog.alert({ title: 'Pick one object', body: 'Send to library sends one object. Select it in the list or in the view. To send several together, select them and use Duplicate as one object first.' }); return; }
  const fromShape = !!(o.origin && o.origin.startsWith('a shape')); const lic = { id: fromShape ? 'own' : '' }; let name = o.name;
  const back = $('back'), box = $('box'); back.style.display = 'flex';
  const B0 = curBudget(), over = o.tris - B0.limit, opener = document.activeElement;
  const inh = o.sources || [], inhRestricted = inh.some(s => s.restricted);
  box.innerHTML = `<h3 id="boxTitle">Send to library</h3><label for="fName">Name</label><input type="text" id="fName" maxlength="80" value="${esc(name)}">
    <label>Licence</label><div class="menu" id="fLic"></div><label for="fSrc">Source (where it came from)</label><input type="text" id="fSrc" maxlength="300">
    <label class="chk"><input type="checkbox" id="fCopies" checked> Also make copies for the BSA: PC, Quest and web (same detail as this one, each checked against its own budget)</label>
    <label class="chk"><input type="checkbox" id="fPriv"${o.priv || PROJ === 'private' ? ' checked' : ''}${o.priv ? ' disabled' : ''}> Private: keep it out of the Studio's and the Atelier's lists${o.priv ? ' (it came from a private asset)' : ''}</label>
    ${inh.length ? `<div class="small" style="margin-top:10px">It also carries: ${esc(inh.map(s => s.name).join('; '))}.${inhRestricted ? ' One of these is restricted, so it stays not for sale or reuse.' : ''}</div>` : ''}
    <div class="small" style="margin-top:10px">${fmt(o.tris)} triangles. ${over > 0 ? `Over ${esc(B0.label)} by ${fmt(over)}.` : `Fits ${esc(B0.label)}.`}</div>
    <div class="small" id="fErr" style="color:var(--bad);margin-top:6px"></div><div class="r"><button id="fNo">Cancel</button><button class="p" id="fOk">Send</button></div>`;
  const src = $('fSrc'); if (fromShape) src.value = "Built in BST from the Atelier's own shapes";
  const m = makeMenu($('fLic'), [{ id: '', label: 'Choose a licence…' }].concat(LICENCES), () => lic.id, id => { lic.id = id; $('fErr').textContent = ''; if (id === 'own' && !src.value && fromShape) src.value = "Built in BST from the Atelier's own shapes"; });
  src.oninput = $('fName').oninput = () => { $('fErr').textContent = ''; };
  const close = () => { back.style.display = 'none'; box.innerHTML = ''; document.removeEventListener('keydown', onKey, true); if (opener && opener.focus) opener.focus(); };
  const onKey = e => {
    if (e.key === 'Escape' && !document.querySelector('#fLic .menu-list:not([hidden])')) { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { const f = [...box.querySelectorAll('button:not([disabled]),input,[tabindex="0"]')].filter(x => x.offsetParent !== null); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
  };
  document.addEventListener('keydown', onKey, true); $('fNo').onclick = close; setTimeout(() => { const f = $('fName'); if (f) f.focus(); }, 20);
  $('fOk').onclick = async () => {
    const L = LICENCES.find(l => l.id === lic.id), nm = $('fName').value.trim(), sv = src.value.trim(), err = $('fErr');
    if (!nm) { err.textContent = 'Give it a name.'; return; } if (!L) { err.textContent = 'Choose a licence.'; return; } if (!sv) { err.textContent = 'Say where it came from.'; return; }
    err.textContent = ''; $('fOk').disabled = true; $('fOk').textContent = 'Sending…';
    try {
      let id = slug(nm); const have = S.libOk === false ? [] : (await (await fetch('/pe_assets/index?proj=' + PROJ, { cache: 'no-store' })).json()).items.map(c => c.id);
      if (have.includes(id)) {
        if (await AtelierDialog.confirm({ title: 'Replace "' + nm + '"?', body: 'An asset with this name is already in the library. Replacing keeps the old copy as a backup. Cancel to save this one under a new name.', ok: 'Replace', cancel: 'New name' })) { /* same id */ }
        else { let n = 2; while (have.includes(id + '-' + n)) n++; id = id + '-' + n; }
      }
      const bytes = o.bytes && !o.dirty ? o.bytes : await exportGlb(o);
      const B = S.budget.id === 'custom' ? { id: 'custom', label: 'Your own number', limit: S.custom } : { id: S.budget.id, label: S.budget.label, limit: S.budget.limit };
      const mine = { name: L.name, source: sv, restricted: L.restricted };
      const priv = $('fPriv').checked, card = { name: nm, proj: priv ? 'private' : 'studio', budget: B, licence: mine, sources: mergeSources(inh, [mine]), thumb: thumb(o) };
      const fd = new FormData(); fd.append('glb', new Blob([bytes], { type: 'model/gltf-binary' }), id + '.glb'); fd.append('card', JSON.stringify(card));
      const r = await fetch('/pe_assets/item/' + id + '?proj=' + (priv ? 'private' : 'studio'), { method: 'POST', body: fd }); const j = await r.json().catch(() => ({ ok: false, why: 'The server did not answer.' }));
      if (!j.ok) throw new Error(j.why || 'The library said no.');
      const copies = [];
      if ($('fCopies').checked) for (const [cid, label, limit] of COPIES) {   /* the BSA's From the library list loads a copy made for its target, never the master; a copy here is the same file, so people keep their design, and the server flags it against that target's limit */
        const cf = new FormData(); cf.append('glb', new Blob([bytes], { type: 'model/gltf-binary' }), id + '.' + cid + '.glb'); cf.append('card', JSON.stringify({ label, limit, from_sha: j.card.sha }));
        const cr = await fetch('/pe_assets/item/' + id + '?proj=' + (priv ? 'private' : 'studio') + '&copy=' + cid, { method: 'POST', body: cf }); const cj = await cr.json().catch(() => ({ ok: false }));
        copies.push(cj.ok && cj.lod ? cj.lod : { id: cid, failed: true });
      }
      j.copies = copies; S.lastSent = j; if (priv) o.priv = true; o.sources = (j.card && j.card.sources) || card.sources; ws.markSaved(o); close(); await refreshLib(); renderStage(); render();
      AtelierDialog.alert({ title: 'In the library', body: `${j.card.name}: ${fmt(j.card.tris)} triangles${j.card.overBudget ? ', over the budget you picked' : ''}. Tag: ${j.card.tag === 'publish_ok' ? 'publish ok' : 'not for sale or reuse'}.` + (copies.length ? ' Copies: ' + copies.map(c => c.failed ? c.id + ' failed' : c.id + (c.overBudget ? ' (over its budget)' : ' (fits)')).join(', ') + '.' : '') });
    } catch (e) { const ok = $('fOk'); if (!ok) { console.error(e); AtelierDialog.alert({ title: 'Sent, but something after it failed', body: String(e.message || e) }); return; } err.textContent = String(e.message || e); ok.disabled = false; ok.textContent = 'Send'; }
  };
}

/* ---------- wiring ---------- */
async function openFile(f) {
  if (!f) return;
  try { await loadGlbBuffer(await f.arrayBuffer(), cleanName(f.name), 'your file ' + f.name); }
  catch (x) { AtelierDialog.alert({ title: 'That file would not open', body: 'It is not a .glb this page can read (' + (x && x.message || x) + ').' }); }
}
async function openFiles(files) { for (const f of [...(files || [])]) await openFile(f); }
$('openGlb').onclick = () => $('glbFile').click();
$('glbFile').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; openFiles(fs); };
/* ---------- Add bone (Ruth, 2026-10-10: "the add bones function") ---------- */
let bnLast = null;   /* the bone the offset fields were last filled for */
const objOfBone = b => ws.objects.find(o => { let n = b; while (n) { if (n === o.root) return true; n = n.parent; } return false; });
const addedBones = () => { const out = []; ws.objects.forEach(o => o.root.traverse(x => { if (x.isBone && x.userData && x.userData.added) out.push({ o, b: x }); })); return out; };
function bonesPanel() {
  const b = ws.bone, o = b && objOfBone(b);
  $('bnParent').textContent = b ? `The new bone grows from: ${boneLabel(b.name)} (${b.name})` : 'Turn on the Bones view and click a bone dot: the new bone grows from it.';
  $('bnAdd').disabled = !b || !o;
  if (b && o && b !== bnLast) { bnLast = b; const d = defaultOffset(THREE, o.root, b); [$('bnX'), $('bnY'), $('bnZ')].forEach((el, i) => { el.value = String(Math.round(d.getComponent(i) * 1000) / 10); }); }
  const r = +$('bnR').value; $('bnRV').textContent = r ? r + ' cm' : '0 (no skin yet)';
  const list = addedBones(); $('bnList').innerHTML = list.length ? list.map(x => `<div class="orow"><span class="nm" title="${x.b.name}">${x.b.name}</span><span class="small">from ${boneLabel(x.b.parent.name)}</span></div>`).join('') : '<div class="msg">None yet.</div>';
}
function addBoneNow(spec) {   /* spec: { parent, name, offsetCm: [x, y, z], radiusCm } */
  const b = spec.parent, o = objOfBone(b); if (!o) return { error: 'That bone is not on the stage.' };
  o.root.updateMatrixWorld(true); const sc = o.root.matrixWorld.getMaxScaleOnAxis() || 1, m = spec.offsetCm.map(v => (+v || 0) / 100 / sc);
  const res = addBoneTo(THREE, o.root, b, { name: spec.name, offset: m, radius: (spec.radiusCm || 0) / 100 / sc });
  if (res.error) return res;
  const row = () => [res.bone, res.bone.position.clone(), res.bone.quaternion.clone(), res.bone.scale.clone()], keep = row();
  if (o.rest) o.rest.push(keep);
  const undo = () => { res.undo(); if (o.rest) o.rest = o.rest.filter(r => r !== keep); }, redo = () => { res.redo(); if (o.rest) o.rest.push(keep); };
  o.dirty = true; ws.record('add bone', redo, undo);
  res.report.sc = sc; return res;
}
function wireBones() {
  ['bnX', 'bnY', 'bnZ'].forEach(id => { $(id).oninput = () => { $(id).style.borderColor = Number.isFinite(parseFloat($(id).value.replace(',', '.'))) || $(id).value === '' || $(id).value === '-' ? '' : 'var(--bad)'; }; });
  $('bnR').oninput = bonesPanel;
  $('bnAdd').onclick = () => {
    const b = ws.bone; if (!b) return;
    const n = id => { const v = parseFloat($(id).value.replace(',', '.')); return Number.isFinite(v) ? v : 0; };
    const res = addBoneNow({ parent: b, name: $('bnName').value, offsetCm: [n('bnX'), n('bnY'), n('bnZ')], radiusCm: +$('bnR').value });
    if (res.error) { $('bnNote').textContent = res.error; return; }
    const r = res.report; $('bnNote').textContent = `Added "${r.name}" under ${boneLabel(r.parent)}${r.vertices ? ', and gave it the skin of ' + r.vertices.toLocaleString('en-US') + ' points' : +$('bnR').value ? ', but no skin was inside ' + $('bnR').value + ' cm of it (a bone sits inside the body, so the radius has to reach the surface: try a bigger one)' : ', with no skin yet'}. Undo takes it back.`;
    $('bnName').value = 'New bone'; bonesPanel();
  };
}
wireBones();
window.BST.addBone = addBoneNow;
const stageEl = $('stage');
['dragenter', 'dragover'].forEach(ev => stageEl.addEventListener(ev, e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); stageEl.classList.add('drop'); } }));
['dragleave', 'drop'].forEach(ev => stageEl.addEventListener(ev, e => { if (ev === 'drop') { e.preventDefault(); openFiles(e.dataTransfer.files); } stageEl.classList.remove('drop'); }));
function tab(which) {
  [['shapes', 'tabShapes', 'paneShapes'], ['stage', 'tabStage', 'paneStage'], ['sculpt', 'tabSculpt', 'paneSculpt'], ['bones', 'tabBones', 'paneBones'], ['lib', 'tabLib', 'paneLib']].forEach(([k, t, p]) => { $(t).classList.toggle('on', k === which); $(t).setAttribute('aria-selected', String(k === which)); $(p).hidden = k !== which; });
  if (which === 'lib') refreshLib(); if (which === 'bones') bonesPanel();
}
$('tabShapes').onclick = () => tab('shapes'); $('tabStage').onclick = () => tab('stage'); $('tabSculpt').onclick = () => tab('sculpt'); $('tabBones').onclick = () => tab('bones'); $('tabLib').onclick = () => tab('lib');
$('send').onclick = sendToLibrary;
const bm = makeMenu($('budgetMenu'), BUDGETS, () => S.budget.id, id => chooseBudget(id));
buildShapeGrid(); buildViewButtons(); wireTools(); render(); renderStage(); updateTools(); refreshLib();
/* the page opens with a figure on the stage (Ruth, 2026-10-10: "put a model in there as the default scene"): the app's own MakeHuman female body, CC0, all its bones. ?empty=1 opens an empty stage. */
if (!/[?&]empty=1/.test(location.search)) fetch('/pe_lib/female.glb', { cache: 'force-cache' }).then(r => r.arrayBuffer()).then(buf => { if (ws.objects.length) return; return loadGlbBuffer(buf, 'Figure', "the app's own figure (lib/female.glb)", false, [{ name: 'MakeHuman female body (CC0)', source: 'The MakeHuman project, lib/female.glb', url: 'https://github.com/makehumancommunity/makehuman', restricted: false }]); }).then(() => { S.figure = true; refreshFigure(); updateTools(); ws.clearSelection(); }).catch(() => { /* an empty stage is fine */ });
